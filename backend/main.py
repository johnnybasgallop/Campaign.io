import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from db import fetch_recipients
from message import messaging_campaign

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory campaign state and log queues
campaigns: dict[str, dict] = {}
log_queues: dict[str, list[asyncio.Queue]] = {}


async def publish_log(campaign_id: str, event: str, message: str, level: str = "info"):
    payload = {
        "campaign_id": campaign_id,
        "event": event,
        "level": level,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    for q in log_queues.get(campaign_id, []):
        await q.put(payload)


class CampaignRequest(BaseModel):
    group_name: str = "Testinggc"
    message: str


@app.get("/groups")
async def get_groups():
    conn = await __import__("asyncpg").connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
    )
    try:
        rows = await conn.fetch('SELECT DISTINCT group_name FROM "group-backup" ORDER BY group_name')
        return {"groups": [row["group_name"] for row in rows]}
    finally:
        await conn.close()


@app.post("/campaign/send")
async def send_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    recipients = await fetch_recipients(request.group_name)

    if not recipients:
        return {"error": "No recipients found for the given group_name"}

    campaign_id = str(uuid.uuid4())
    campaigns[campaign_id] = {
        "status": "running",
        "total": len(recipients),
        "sent": 0,
        "failed": 0,
        "cancelled": False,
    }
    log_queues[campaign_id] = []

    background_tasks.add_task(
        messaging_campaign, recipients, request.message, campaign_id, campaigns, publish_log
    )

    return {"status": "started", "campaign_id": campaign_id, "recipients": len(recipients)}


@app.get("/campaign/{campaign_id}/status")
async def campaign_status(campaign_id: str):
    if campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaigns[campaign_id]


@app.post("/campaign/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str):
    if campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")
    state = campaigns[campaign_id]
    if state["status"] != "running":
        raise HTTPException(status_code=400, detail="Campaign is not running")
    state["cancelled"] = True
    state["status"] = "cancelled"
    return {"status": "cancelled"}


@app.get("/campaign/{campaign_id}/logs")
async def campaign_logs(campaign_id: str):
    if campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")

    q: asyncio.Queue = asyncio.Queue()
    log_queues.setdefault(campaign_id, []).append(q)

    async def event_stream():
        try:
            while True:
                entry = await q.get()
                yield f"data: {json.dumps(entry)}\n\n"
                if entry.get("event") in ("complete", "cancelled"):
                    break
        finally:
            log_queues[campaign_id].remove(q)
            if not log_queues[campaign_id]:
                log_queues.pop(campaign_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
