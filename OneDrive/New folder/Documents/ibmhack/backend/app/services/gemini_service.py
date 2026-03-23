import json
import os
import re
from typing import Any, Dict, List

import google.generativeai as genai


PRIORITY_URGENT_HINTS = ["asap", "urgent", "today", "ceo", "before", "immediately"]
PRIORITY_ACTION_HINTS = ["schedule", "confirm", "please", "can we", "need", "action"]


def _normalize_priority(priority_value: Any, fallback_text: str) -> str:
    raw = str(priority_value or "").strip().lower()

    if "urgent" in raw or "critical" in raw or "high" == raw:
        return "Urgent"
    if "requires action" in raw or "action" in raw or raw == "medium":
        return "Requires Action"
    if raw in {"fyi", "info", "informational", "low"}:
        return "FYI"

    return _heuristic_priority(fallback_text)


def _heuristic_priority(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in PRIORITY_URGENT_HINTS):
        return "Urgent"
    if any(token in lowered for token in PRIORITY_ACTION_HINTS):
        return "Requires Action"
    return "FYI"


def _fallback_triage(email_payload: Dict[str, Any]) -> Dict[str, Any]:
    body = email_payload.get("body", "")
    subject = email_payload.get("subject", "")
    from_email = email_payload.get("from_email", "")

    summary = [
        f"Sender: {from_email or 'Unknown sender'}",
        f"Main request: {subject or 'No subject provided'}",
        "Suggested next step: review and approve generated actions."
    ]

    priority = _heuristic_priority(f"{subject} {body} {from_email}")

    actions = [
        {
            "type": "draft_reply",
            "subject": f"Re: {subject}" if subject else "Re: Your email",
            "body": "Thanks for your email. We reviewed your request and will proceed with the next steps. Please let us know if there are constraints we should consider."
        },
        {
            "type": "calendar_event",
            "title": "Follow-up meeting",
            "date": "TBD",
            "time": "TBD",
            "attendees": [from_email] if from_email else [],
            "notes": "Confirm exact slot with participants."
        },
        {
            "type": "task_list",
            "tasks": [
                "Review email context and dependencies",
                "Align owner and due date",
                "Send confirmation response"
            ]
        }
    ]

    return {"summary": summary, "priority": priority, "actions": actions}


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}

    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.S)
    if fenced:
        cleaned = fenced.group(1)
    else:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]

    return json.loads(cleaned)


def triage_with_gemini(email_payload: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    if not api_key:
        return _fallback_triage(email_payload)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    prompt = f"""
You are an enterprise email triage assistant.
Analyze the email and return JSON only with this exact schema:
{{
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "priority": "Urgent|Requires Action|FYI",
  "actions": [
    {{"type":"draft_reply","subject":"...","body":"..."}},
    {{"type":"calendar_event","title":"...","date":"...","time":"...","attendees":["..."],"notes":"..."}},
    {{"type":"task_list","tasks":["...","..."]}}
  ]
}}

Rules:
- Always provide exactly 3 concise summary bullets.
- Priority must be one of: Urgent, Requires Action, FYI.
- Actions must include all three action types.
- If date/time is unknown, use "TBD".

Email payload:
{json.dumps(email_payload, indent=2)}
""".strip()

    response = model.generate_content(prompt)
    parsed = _extract_json(getattr(response, "text", ""))

    # Keep backend robust if model output drifts.
    if not parsed or not isinstance(parsed, dict):
        return _fallback_triage(email_payload)

    fallback = _fallback_triage(email_payload)
    parsed.setdefault("summary", fallback["summary"])
    parsed.setdefault("actions", fallback["actions"])
    parsed["priority"] = _normalize_priority(parsed.get("priority"), str(email_payload))

    return parsed


def assist_with_gemini(email_payload: Dict[str, Any], user_prompt: str) -> str:
    subject = email_payload.get("subject", "")
    body = email_payload.get("body", "")
    from_email = email_payload.get("from_email", "")

    prompt_clean = (user_prompt or "").strip()
    if not prompt_clean:
        prompt_clean = "Summarize this email"

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    if not api_key:
        return (
            f"Sender: {from_email or 'Unknown sender'}\n"
            f"Subject: {subject or 'No subject'}\n"
            "AI service is unavailable. Please try again after configuring Gemini API key."
        )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    composed_prompt = f"""
You are an enterprise email assistant. Answer the user's request based on the email below.

User request:
{prompt_clean}

Email sender:
{from_email}

Email subject:
{subject}

Email body:
{body}

Rules:
- If the user asks for a reply or says 'suggest a reply', always generate a complete, ready-to-send professional reply email. Include a greeting, body, and closing signature. Do NOT just suggest or outline—write the full reply as if the user will copy and send it directly.
- If the user asks to summarize, provide 2-4 concise, actionable bullet points summarizing the main points of the email.
- If the user asks for next steps, list clear, actionable next steps as bullet points.
- Use bullet points for lists, but write full sentences for replies.
- Always be clear, practical, and professional.
""".strip()

    response = model.generate_content(composed_prompt)
    text = getattr(response, "text", "")
    clean_text = str(text or "").strip()
    if clean_text:
        return clean_text

    return (
        f"Sender: {from_email or 'Unknown sender'}\n"
        f"Subject: {subject or 'No subject'}\n"
        "Unable to generate an assistant response for this request."
    )
