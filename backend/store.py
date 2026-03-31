import asyncio
import json
from datetime import datetime, timezone


class CampaignStore:
    """Holds all runtime campaign state and manages SSE log queues."""

    def __init__(self):
        self.campaigns: dict[str, dict] = {}
        # Maps campaign_id to a list of queues, one per connected SSE client
        self.log_queues: dict[str, list[asyncio.Queue]] = {}

    def create(self, campaign_id: str, total: int):
        self.campaigns[campaign_id] = {
            "status": "running",
            "total": total,
            "sent": 0,
            "failed": 0,
            "cancelled": False,
        }
        self.log_queues[campaign_id] = []

    def get(self, campaign_id: str) -> dict | None:
        return self.campaigns.get(campaign_id)

    def cancel(self, campaign_id: str):
        state = self.campaigns[campaign_id]
        state["cancelled"] = True
        state["status"] = "cancelled"

    async def publish_log(self, campaign_id: str, event: str, message: str, level: str = "info"):
        """Push a log entry to every SSE client connected to this campaign."""
        payload = {
            "campaign_id": campaign_id,
            "event": event,
            "level": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        for q in self.log_queues.get(campaign_id, []):
            await q.put(payload)

    def subscribe(self, campaign_id: str) -> asyncio.Queue:
        """Register a new SSE listener and return its queue."""
        q = asyncio.Queue()
        self.log_queues.setdefault(campaign_id, []).append(q)
        return q

    def unsubscribe(self, campaign_id: str, q: asyncio.Queue):
        """Remove an SSE listener when its connection closes."""
        queues = self.log_queues.get(campaign_id, [])
        if q in queues:
            queues.remove(q)
        if not queues:
            self.log_queues.pop(campaign_id, None)


# Single shared instance used across routes and the messaging task
store = CampaignStore()
