import base64
import html
import os
import quopri
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

TOKEN_PATH = Path(__file__).resolve().parents[1] / "data" / "gmail_token.json"
URL_REGEX = re.compile(r'https?://[^\s)>"]+', re.I)
HREF_REGEX = re.compile(r'href=["\'](https?://[^"\']+)["\']', re.I)
HTML_MARKUP_REGEX = re.compile(r"<(?:!doctype|html|head|body|div|span|p|table|tr|td|a)\b", re.I)


def _oauth_client_config() -> Dict[str, Dict[str, str]]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback").strip()

    if not client_id or not client_secret:
        raise ValueError("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend/.env")

    return {
        "web": {
            "client_id": client_id,
            "project_id": "agentic-email-triage",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": [redirect_uri],
            "javascript_origins": [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
        }
    }


def _create_flow(state: Optional[str] = None) -> Flow:
    config = _oauth_client_config()
    flow = Flow.from_client_config(config, scopes=SCOPES, state=state)
    flow.redirect_uri = config["web"]["redirect_uris"][0]
    return flow


def get_google_auth_url() -> str:
    flow = _create_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


def exchange_google_code(code: str) -> None:
    flow = _create_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")


def _load_credentials() -> Optional[Credentials]:
    if not TOKEN_PATH.exists():
        return None

    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    return creds


def gmail_connection_status() -> Dict[str, Optional[str]]:
    creds = _load_credentials()
    if not creds:
        return {
            "connected": False,
            "email": None,
            "reason": "No Gmail OAuth token found. Connect Gmail first.",
        }

    if not creds.valid:
        return {
            "connected": False,
            "email": None,
            "reason": "Stored Gmail token is invalid or expired. Reconnect Gmail.",
        }

    try:
        service = build("gmail", "v1", credentials=creds)
        profile = service.users().getProfile(userId="me").execute()
        return {
            "connected": True,
            "email": profile.get("emailAddress"),
            "reason": None,
        }
    except Exception as exc:
        return {
            "connected": False,
            "email": None,
            "reason": f"Gmail API access failed: {exc}",
        }


def _looks_like_html(text: str) -> bool:
    return bool(text and HTML_MARKUP_REGEX.search(text))


def _html_to_text(raw_html: str) -> str:
    if not raw_html:
        return ""

    text = raw_html
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?is)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)</(p|div|li|tr|h[1-6])>", "\n", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html.unescape(text)

    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)


def _extract_body(payload: Dict) -> str:
    # Prefer plain text body, then HTML body; include nested multipart sections.
    if not payload:
        return ""

    def decode_data(data: str) -> str:
        if not data:
            return ""
        pad = len(data) % 4
        if pad:
            data += "=" * (4 - pad)
        decoded = base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
        decoded = quopri.decodestring(decoded.encode("utf-8", errors="ignore")).decode("utf-8", errors="ignore")
        return html.unescape(decoded)

    plain_segments: List[str] = []
    html_segments: List[str] = []

    def walk(part: Dict) -> None:
        mime = part.get("mimeType", "")
        part_data = part.get("body", {}).get("data")

        if part_data:
            decoded = decode_data(part_data)
            if mime == "text/plain":
                plain_segments.append(decoded)
            elif mime == "text/html":
                html_segments.append(decoded)

        for child in part.get("parts", []) or []:
            walk(child)

    walk(payload)

    plain_text = "\n".join(plain_segments).strip()
    html_text = _html_to_text("\n".join(html_segments)).strip()

    if plain_text and not _looks_like_html(plain_text):
        return plain_text

    if html_text:
        return html_text

    if plain_text:
        return _html_to_text(plain_text)

    fallback_data = payload.get("body", {}).get("data")
    if fallback_data:
        decoded = decode_data(fallback_data)
        if _looks_like_html(decoded):
            return _html_to_text(decoded)
        return decoded

    return ""


def _extract_links(payload: Dict, snippet: str = "") -> List[str]:
    links: List[str] = []
    seen = set()

    def add(link: str) -> None:
        normalized = html.unescape((link or "").strip()).strip("'\".,);>")
        if not normalized:
            return
        if normalized not in seen:
            seen.add(normalized)
            links.append(normalized)

    def walk(part: Dict) -> None:
        body_data = part.get("body", {}).get("data")
        if body_data:
            text = body_data
            pad = len(text) % 4
            if pad:
                text += "=" * (4 - pad)
            decoded = base64.urlsafe_b64decode(text.encode("utf-8")).decode("utf-8", errors="ignore")
            decoded = quopri.decodestring(decoded.encode("utf-8", errors="ignore")).decode("utf-8", errors="ignore")
            decoded = html.unescape(decoded)

            for match in URL_REGEX.findall(decoded):
                add(match)
            for href in HREF_REGEX.findall(decoded):
                add(href)

        for child in part.get("parts", []) or []:
            walk(child)

    walk(payload)

    for match in URL_REGEX.findall(snippet or ""):
        add(match)

    return links


def list_gmail_emails(max_results: int = 15) -> List[Dict[str, str]]:
    creds = _load_credentials()
    if not creds or not creds.valid:
        raise ValueError("Gmail is not connected. Complete OAuth first.")

    service = build("gmail", "v1", credentials=creds)
    listed = service.users().messages().list(userId="me", maxResults=max_results).execute()
    messages = listed.get("messages", [])

    result: List[Dict[str, str]] = []
    for item in messages:
        msg_id = item.get("id")
        if not msg_id:
            continue

        raw = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        payload = raw.get("payload", {})
        headers = payload.get("headers", [])

        def header_value(name: str) -> str:
            for h in headers:
                if h.get("name", "").lower() == name.lower():
                    return h.get("value", "")
            return ""

        from_email = header_value("From") or "Unknown sender"
        subject = header_value("Subject") or "(No Subject)"
        body = _extract_body(payload).strip() or raw.get("snippet", "") or "(No content)"
        links = _extract_links(payload, raw.get("snippet", ""))
        internal_date_ms = raw.get("internalDate")
        received_at = None
        if internal_date_ms:
            try:
                received_at = datetime.fromtimestamp(int(internal_date_ms) / 1000, tz=timezone.utc).isoformat()
            except (TypeError, ValueError, OSError):
                received_at = None

        result.append(
            {
                "id": f"gmail-{msg_id}",
                "from_email": from_email,
                "subject": subject,
                "body": body,
                "links": links,
                "received_at": received_at,
                "thread": [],
            }
        )

    return result
