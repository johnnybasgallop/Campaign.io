import json
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from db import fetch_recipients
from messaging import run_campaign
from models import CampaignRequest
from store import store

router = APIRouter(prefix="/campaign")


@router.post("/send")
async def send_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    recipients = await fetch_recipients(request.group_name)

    if not recipients:
        raise HTTPException(status_code=404, detail="No recipients found for that group")

    campaign_id = str(uuid.uuid4())
    store.create(campaign_id, total=len(recipients))

    background_tasks.add_task(
        run_campaign,
        recipients,
        request.message,
        campaign_id,
        store.campaigns,
        store.publish_log,
    )

    return {"status": "started", "campaign_id": campaign_id, "recipients": len(recipients)}


@router.get("/{campaign_id}/status")
async def campaign_status(campaign_id: str):
    state = store.get(campaign_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return state


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str):
    state = store.get(campaign_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if state["status"] != "running":
        raise HTTPException(status_code=400, detail="Campaign is not running")
    store.cancel(campaign_id)
    return {"status": "cancelled"}


@router.get("/{campaign_id}/logs")
async def campaign_logs(campaign_id: str):
    if store.get(campaign_id) is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    q = store.subscribe(campaign_id)

    async def event_stream():
        try:
            while True:
                entry = await q.get()
                yield f"data: {json.dumps(entry)}\n\n"
                # Stop streaming once the campaign reaches a terminal state
                if entry.get("event") in ("complete", "cancelled"):
                    break
        finally:
            store.unsubscribe(campaign_id, q)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
