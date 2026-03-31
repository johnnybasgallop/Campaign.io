import json
import logging
import os
import uuid

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = "campaign-logs"

# In-memory campaign state store
campaigns: dict[str, dict] = {}

producer: AIOKafkaProducer | None = None


@app.on_event("startup")
async def startup():
    global producer
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP)
    await producer.start()


@app.on_event("shutdown")
async def shutdown():
    if producer:
        await producer.stop()


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

    background_tasks.add_task(
        messaging_campaign, recipients, request.message, campaign_id, campaigns, producer
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

    async def event_stream():
        consumer = AIOKafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP,
            auto_offset_reset="earliest",
            group_id=f"frontend-{campaign_id}-{uuid.uuid4()}",
        )
        await consumer.start()
        try:
            async for msg in consumer:
                data = json.loads(msg.value)
                if data.get("campaign_id") != campaign_id:
                    continue
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("event") in ("complete", "cancelled"):
                    break
        finally:
            await consumer.stop()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
