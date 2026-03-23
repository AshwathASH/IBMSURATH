import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

try:
    from .models import ActionApprovalRequest, EmailAssistRequest, EmailRecord, TriageRequest
    from .services.gmail_service import (
        exchange_google_code,
        get_google_auth_url,
        gmail_connection_status,
        list_gmail_emails,
    )
    from .services.gemini_service import assist_with_gemini, triage_with_gemini
except ImportError:
    # Support running this file directly: python .\main.py
    from models import ActionApprovalRequest, EmailAssistRequest, EmailRecord, TriageRequest
    from services.gmail_service import (
        exchange_google_code,
        get_google_auth_url,
        gmail_connection_status,
        list_gmail_emails,
    )
    from services.gemini_service import assist_with_gemini, triage_with_gemini

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

app = FastAPI(title="Agentic Email Triage API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your frontend URL instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent / "data" / "mock_emails.json"
CALENDAR_EVENTS_PATH = Path(__file__).parent / "data" / "calendar_events.json"
MEETING_HINTS = ["meeting", "kickoff", "schedule", "calendar", "invite", "call", "sync"]
TIME_HINT = re.compile(r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", re.I)
DATE_ISO_HINT = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
DATE_SLASH_HINT = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")
DATE_MONTH_HINT = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b",
    re.I,
)
ONLINE_MEETING_PATTERNS = {
    "Google Meet": re.compile(r'(?:https?://)?meet\.google\.com/[^\s)>"\']+', re.I),
    "Zoom": re.compile(r'(?:https?://)?([\w.-]+\.)?zoom\.us/[^\s)>"\']+', re.I),
    "Microsoft Teams": re.compile(r'(?:https?://)?([\w.-]+\.)?teams\.microsoft\.com/[^\s)>"\']+', re.I),
    "Webex": re.compile(r'(?:https?://)?([\w.-]+\.)?webex\.com/[^\s)>"\']+', re.I),
}
PROVIDER_KEYWORD_PATTERNS = {
    "Google Meet": re.compile(r"\b(google\s*meet|gmeet|meet\s*link)\b", re.I),
    "Zoom": re.compile(r"\b(zoom\s*meet(?:ing)?|zoom\s*call|zoom)\b", re.I),
    "Microsoft Teams": re.compile(r"\b(microsoft\s*teams|ms\s*teams|teams\s*meeting|teams)\b", re.I),
    "Webex": re.compile(r"\b(webex\s*meeting|cisco\s*webex|webex)\b", re.I),
}


def load_mock_emails() -> List[EmailRecord]:
    if not DATA_PATH.exists():
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [EmailRecord(**item) for item in raw]


def load_calendar_events() -> List[Dict[str, Any]]:
    if not CALENDAR_EVENTS_PATH.exists():
        return []
    with open(CALENDAR_EVENTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_calendar_events(events: List[Dict[str, Any]]) -> None:
    CALENDAR_EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CALENDAR_EVENTS_PATH, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2)


def detect_meeting_providers(text: str) -> List[str]:
    if not text:
        return []

    found: List[str] = []
    for provider, pattern in PROVIDER_KEYWORD_PATTERNS.items():
        if pattern.search(text):
            found.append(provider)
    return found


def is_meeting_email(email: Dict[str, Any]) -> bool:
    text = f"{email.get('subject', '')} {email.get('body', '')}"
    text_lower = text.lower()
    if any(token in text_lower for token in MEETING_HINTS):
        return True
    if detect_meeting_providers(text):
        return True
    links = email.get("links", []) or []
    if any(any(domain in link.lower() for domain in ["meet.google.com", "zoom.us", "teams.microsoft.com", "webex.com"]) for link in links):
        return True
    return bool(extract_online_meeting_links(email.get("body", "")))


def extract_online_meeting_links(text: str) -> List[Dict[str, str]]:
    if not text:
        return []

    found: List[Dict[str, str]] = []
    seen_links = set()
    for provider, pattern in ONLINE_MEETING_PATTERNS.items():
        matches = pattern.findall(text)
        if not matches:
            continue

        for match in pattern.finditer(text):
            link = match.group(0)
            if not link.lower().startswith(("http://", "https://")):
                link = f"https://{link}"
            if link in seen_links:
                continue
            seen_links.add(link)
            found.append({"provider": provider, "link": link})

    return found


def _extract_date_from_text(text: str) -> str:
    if not text:
        return ""

    iso_match = DATE_ISO_HINT.search(text)
    if iso_match:
        return iso_match.group(0)

    slash_match = DATE_SLASH_HINT.search(text)
    if slash_match:
        parts = slash_match.group(0).split("/")
        if len(parts) == 3:
            try:
                month = int(parts[0])
                day = int(parts[1])
                year = int(parts[2])
                if year < 100:
                    year += 2000
                return datetime(year, month, day).strftime("%Y-%m-%d")
            except ValueError:
                pass

    month_match = DATE_MONTH_HINT.search(text)
    if month_match:
        date_text = month_match.group(0)
        formats = ["%B %d, %Y", "%b %d, %Y", "%B %d", "%b %d"]
        for fmt in formats:
            try:
                parsed = datetime.strptime(date_text, fmt)
                if "%Y" not in fmt:
                    parsed = parsed.replace(year=datetime.now().year)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return ""


def _extract_time_from_text(text: str) -> str:
    if not text:
        return ""

    for match in TIME_HINT.finditer(text):
        start, end = match.span()
        prev_char = text[start - 1] if start > 0 else " "
        next_char = text[end] if end < len(text) else " "
        if prev_char in "/-" or next_char in "/-":
            continue

        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        meridiem = (match.group(3) or "").upper()

        if minute > 59:
            continue

        if meridiem:
            if hour < 1 or hour > 12:
                continue
            return f"{hour}:{minute:02d} {meridiem}"

        if hour > 23:
            continue

        normalized = datetime(2000, 1, 1, hour, minute)
        return normalized.strftime("%I:%M %p").lstrip("0")

    return ""


def _parse_received_datetime(email: Dict[str, Any]) -> Optional[datetime]:
    raw_value = email.get("received_at")
    if not raw_value:
        return None
    try:
        return datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _derive_calendar_date_time(email: Dict[str, Any], text: str) -> Dict[str, str]:
    received_dt = _parse_received_datetime(email)

    detected_date = _extract_date_from_text(text)
    if not detected_date and received_dt:
        detected_date = received_dt.strftime("%Y-%m-%d")

    detected_time = _extract_time_from_text(text)
    if not detected_time and received_dt:
        detected_time = received_dt.strftime("%I:%M %p").lstrip("0")

    return {
        "date": detected_date or "TBD",
        "time": detected_time or "TBD",
    }


def build_calendar_event_from_email(email: Dict[str, Any]) -> Dict[str, Any]:
    subject = email.get("subject", "")
    body = email.get("body", "")
    combined_text = f"{subject} {body}"
    calendar_when = _derive_calendar_date_time(email, combined_text)
    online_meetings = extract_online_meeting_links(body)
    mentioned_providers = detect_meeting_providers(combined_text)

    # Also use links extracted directly from Gmail payload to avoid missing HTML-only invites.
    provider_from_domain = {
        "meet.google.com": "Google Meet",
        "zoom.us": "Zoom",
        "teams.microsoft.com": "Microsoft Teams",
        "webex.com": "Webex",
    }
    for link in email.get("links", []) or []:
        lower = link.lower()
        provider = None
        for domain, name in provider_from_domain.items():
            if domain in lower:
                provider = name
                break
        if provider and not any(item.get("link") == link for item in online_meetings):
            online_meetings.append({"provider": provider, "link": link})
    meeting_provider = online_meetings[0]["provider"] if online_meetings else (mentioned_providers[0] if mentioned_providers else "Unknown")

    return {
        "source_email_id": email.get("id"),
        "title": subject or "Meeting",
        "date": calendar_when["date"],
        "time": calendar_when["time"],
        "attendees": [email.get("from_email")] if email.get("from_email") else [],
        "online_meetings": online_meetings,
        "meeting_provider": meeting_provider,
        "meeting_link": online_meetings[0]["link"] if online_meetings else None,
        "notes": "Auto-created from meeting-related email",
    }


@app.get("/health")
def health() -> Dict[str, str]:
    using_gemini = bool(os.getenv("GEMINI_API_KEY", "").strip())
    return {
        "status": "ok",
        "llm_mode": "gemini" if using_gemini else "fallback",
    }


@app.get("/emails")
def list_emails(source: str = "gmail") -> List[EmailRecord]:
    if source == "mock":
        return load_mock_emails()

    try:
        return [EmailRecord(**item) for item in list_gmail_emails()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load Gmail inbox: {exc}")


@app.get("/gmail/status")
def gmail_status() -> Dict[str, Any]:
    try:
        return gmail_connection_status()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to check Gmail connection: {exc}")


@app.get("/gmail/auth-url")
def gmail_auth_url() -> Dict[str, str]:
    try:
        return {"auth_url": get_google_auth_url()}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/calendar-events")
def get_calendar_events() -> List[Dict[str, Any]]:
    return load_calendar_events()


@app.post("/calendar-events/generate")
def generate_calendar_events(source: str = "gmail") -> Dict[str, Any]:
    if source == "mock":
        emails = [email.model_dump() for email in load_mock_emails()]
    else:
        try:
            emails = list_gmail_emails()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to load Gmail inbox: {exc}")

    meeting_emails = [email for email in emails if is_meeting_email(email)]
    existing = load_calendar_events()
    existing_map = {item.get("source_email_id"): item for item in existing if item.get("source_email_id")}
    existing_ids = {item.get("source_email_id") for item in existing}

    added: List[Dict[str, Any]] = []
    added_online = 0
    updated_events = 0
    for email in meeting_emails:
        source_id = email.get("id")
        if not source_id:
            continue

        if source_id in existing_ids:
            # Refresh event metadata each run so previously missing links become available.
            refreshed = build_calendar_event_from_email(email)
            current = existing_map.get(source_id, {})
            old_links = current.get("online_meetings") or []
            current["online_meetings"] = refreshed.get("online_meetings", [])
            current["meeting_provider"] = refreshed.get("meeting_provider")
            current["meeting_link"] = refreshed.get("meeting_link")
            current["date"] = refreshed.get("date", current.get("date", "TBD"))
            current["time"] = refreshed.get("time", current.get("time", "TBD"))
            if old_links != current.get("online_meetings"):
                updated_events += 1
            continue

        event = build_calendar_event_from_email(email)
        if event.get("online_meetings"):
            added_online += 1
        existing.append(event)
        added.append(event)
        existing_ids.add(source_id)

    save_calendar_events(existing)
    return {
        "status": "ok",
        "processed_meeting_emails": len(meeting_emails),
        "created_events": len(added),
        "created_online_meeting_events": added_online,
        "updated_events": updated_events,
        "total_events": len(existing),
        "new_events": added,
    }


@app.get("/auth/google/callback")
def google_callback(code: str):
    # Use a default redirect URL since frontend_origin is no longer defined
    default_url = "http://localhost:5173"
    success_url = f"{default_url}?gmail_connected=1"
    error_url = f"{default_url}?gmail_error=1"

    try:
        exchange_google_code(code)
        return RedirectResponse(url=success_url)
    except Exception:
        return RedirectResponse(url=error_url)


@app.post("/triage")
def triage_email(payload: TriageRequest) -> Dict[str, Any]:
    record: Dict[str, Any] = {}
    has_inline_payload = bool(payload.from_email or payload.subject or payload.body or payload.thread)

    if payload.email_id:
        email = None
        if payload.email_id.startswith("gmail-"):
            try:
                email = next(
                    (e for e in list_gmail_emails() if e.get("id") == payload.email_id),
                    None,
                )
            except Exception as exc:
                if not has_inline_payload:
                    raise HTTPException(status_code=502, detail=f"Failed to fetch Gmail message: {exc}")
        else:
            email = next((e for e in load_mock_emails() if e.id == payload.email_id), None)

        if not email and not has_inline_payload:
            raise HTTPException(status_code=404, detail="Email not found")

        if isinstance(email, EmailRecord):
            record = email.model_dump()
        elif email:
            record = dict(email)

    # Request-level values override dataset values when provided.
    for field in ["from_email", "subject", "body", "thread"]:
        value = getattr(payload, field)
        if value:
            record[field] = value

    if "body" not in record or not record["body"]:
        raise HTTPException(status_code=400, detail="Email body is required")

    triage_result = triage_with_gemini(record)
    return {
        "email": record,
        "triage": triage_result,
    }


@app.post("/assist")
def assist_email(payload: EmailAssistRequest) -> Dict[str, Any]:
    record: Dict[str, Any] = {}
    has_inline_payload = bool(payload.from_email or payload.subject or payload.body or payload.thread)

    if payload.email_id:
        email = None
        if payload.email_id.startswith("gmail-"):
            try:
                email = next(
                    (e for e in list_gmail_emails() if e.get("id") == payload.email_id),
                    None,
                )
            except Exception as exc:
                if not has_inline_payload:
                    raise HTTPException(status_code=502, detail=f"Failed to fetch Gmail message: {exc}")
        else:
            email = next((e for e in load_mock_emails() if e.id == payload.email_id), None)

        if not email and not has_inline_payload:
            raise HTTPException(status_code=404, detail="Email not found")

        if isinstance(email, EmailRecord):
            record = email.model_dump()
        elif email:
            record = dict(email)

    for field in ["from_email", "subject", "body", "thread"]:
        value = getattr(payload, field)
        if value:
            record[field] = value

    if "body" not in record or not record["body"]:
        raise HTTPException(status_code=400, detail="Email body is required")

    answer = assist_with_gemini(record, payload.prompt)
    return {
        "email": record,
        "prompt": payload.prompt,
        "answer": answer,
    }


@app.post("/approve-action")
def approve_action(payload: ActionApprovalRequest) -> Dict[str, Any]:
    # For hackathon prototype this simulates execution.
    return {
        "status": "approved_and_executed",
        "email_id": payload.email_id,
        "action_type": payload.action_type,
        "executed_payload": payload.payload,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
