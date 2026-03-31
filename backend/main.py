import logging
import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel

load_dotenv()

from db import fetch_recipients
from message import messaging_campaign

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI()


class CampaignRequest(BaseModel):
    group_name: str = "Testinggc"
    message: str


@app.post("/campaign/send")
async def send_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    recipients = await fetch_recipients(request.group_name)

    if not recipients:
        return {"error": "No recipients found for the given group_name"}

    background_tasks.add_task(messaging_campaign, recipients, request.message)

    return {"status": "started", "recipients": len(recipients)}
