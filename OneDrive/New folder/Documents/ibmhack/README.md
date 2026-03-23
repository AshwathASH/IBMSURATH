# Agentic AI Email Triage Workflow (FastAPI + React + Gemini)

This project is a hackathon-ready prototype for AI-driven email triage with a human approval loop.

## What it demonstrates

- Contextual 3-bullet thread summary
- Priority tagging (`Urgent`, `Requires Action`, `FYI`)
- Three automated action types prepared for approval:
  - Draft reply
  - Calendar event suggestion
  - Task list extraction
- Human-in-the-loop `Approve and Execute` simulation

## Stack

- Backend: FastAPI (Python)
- Frontend: React + Vite
- LLM: Gemini API (with a local fallback mode when no API key is set)

## Folder structure

- `backend/` FastAPI API server
- `frontend/` React app

## 1) Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Set your Gemini key in `backend/.env`:

```env
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-1.5-flash
FRONTEND_ORIGIN=http://localhost:5173

# For real Gmail inbox integration
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

Run backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

## 2) Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend starts at `http://localhost:5173`.

## 3) Demo flow

1. Open the React app.
2. Select an email from Inbox.
3. Click **Run Agent Triage**.
4. Review summary, priority, and generated actions.
5. Click **Approve and Execute** on any action.

## Connect real Gmail

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Add authorized redirect URI: `http://localhost:8000/auth/google/callback`.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`.
4. Restart backend.
5. In the frontend click **Connect Gmail**, complete Google login, then click **Use Real Inbox**.

## API endpoints

- `GET /health` - server health and whether Gemini mode is active
- `GET /emails` - mock inbox list
- `GET /emails?source=gmail` - real Gmail inbox list (requires OAuth)
- `GET /gmail/status` - Gmail connection status
- `GET /gmail/auth-url` - OAuth URL to connect Gmail
- `GET /auth/google/callback` - Google OAuth callback endpoint
- `POST /triage` - generate triage output for an email
- `POST /approve-action` - simulate approved execution

## Notes

- If `GEMINI_API_KEY` is missing, backend returns deterministic fallback triage so the UI still works for demos.
- Replace mock data in `backend/app/data/mock_emails.json` with your own test emails.
