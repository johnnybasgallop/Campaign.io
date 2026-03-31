# DMOCampaigns

A internal tool for sending bulk Telegram messaging campaigns to specific groups. Built for a single client, it provides a clean UI for composing and publishing messages, with real-time progress tracking as the campaign runs.

---

## What it does

- Select a Telegram group from a dropdown (populated from a PostgreSQL database)
- Write a campaign message and publish it to all members of that group
- Watch live progress — sent count, failed count, estimated time remaining
- Stream backend logs in real time as each message is dispatched
- Cancel a running campaign at any point
- Resumes tracking automatically if the page is refreshed mid-campaign

Access is restricted to a single authorised user via Clerk's email allowlist.

---

## Tech stack

**Frontend**
- React 19 + TypeScript, built with Vite
- Tailwind CSS with dark mode support
- Clerk for authentication
- Server-Sent Events (SSE) for real-time log streaming

**Backend**
- Python + FastAPI
- Telethon for Telegram messaging via the MTProto API
- asyncpg with a connection pool for PostgreSQL
- In-memory campaign state and asyncio queues for SSE log delivery

---

## Project structure

```
campaign/
  frontend/
    src/
      api/          # All fetch calls to the backend
      components/   # Header, CampaignForm, ProgressCard, LogPanel
      hooks/        # useCampaignStatus, useCampaignLogs, useDarkMode
      pages/        # Dashboard (main page)
      types/        # Shared TypeScript types
      constants.ts  # Shared timing constants mirrored from the backend
  backend/
    routes/         # FastAPI route handlers (campaigns, groups)
    messaging.py    # Telegram sending logic with flood wait + batch handling
    store.py        # In-memory campaign state and SSE log queue management
    db.py           # Connection pool and database queries
    models.py       # Pydantic request models
    auth.py         # One-time Telethon session setup script
```

---

## How the messaging works

Campaigns run as a FastAPI background task. Telethon sends messages one at a time with a randomised delay (3–8s) between each to stay within Telegram's rate limits. Every 50 messages, the campaign pauses for 60 seconds. Flood wait errors are caught and retried automatically. Blocked or deactivated users are skipped.

As messages are dispatched, log events are pushed into per-campaign asyncio queues. Any connected browser receives these instantly via SSE.

---

## Running locally

**Prerequisites:** Python 3.11+, Node 18+, a running PostgreSQL database, and a Telegram API account.

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# First time only — generates the Telethon session file
python auth.py

uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Environment variables**

Backend `.env`:
```
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASS=
ALLOWED_ORIGINS=http://localhost:5173
```

Frontend `.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=http://localhost:8000
```

---

## Deployment

- **Frontend** — Vercel (set `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY`)
- **Backend** — Railway (set all backend env vars, upload the `.session` file via a Railway volume)
