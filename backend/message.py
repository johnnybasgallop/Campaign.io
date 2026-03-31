import asyncio
import logging
import os
import random
from typing import Callable, Awaitable

from telethon import TelegramClient
from telethon.errors import FloodWaitError, InputUserDeactivatedError, UserIsBlockedError

from db import Recipient

logger = logging.getLogger(__name__)

SESSION = "campaign_session"
BATCH_SIZE = 50
BATCH_PAUSE = 60
MIN_DELAY = 3
MAX_DELAY = 8

Publish = Callable[[str, str, str, str], Awaitable[None]]


async def messaging_campaign(
    recipients: list[Recipient],
    message: str,
    campaign_id: str,
    campaigns: dict,
    publish: Publish,
) -> dict:
    api_id = int(os.getenv("TELEGRAM_API_ID"))
    api_hash = os.getenv("TELEGRAM_API_HASH")

    state = campaigns[campaign_id]

    async def log(event: str, msg: str, level: str = "info"):
        await publish(campaign_id, event, msg, level)

    await log("started", f"Campaign started — {len(recipients)} recipients")

    async with TelegramClient(SESSION, api_id, api_hash) as client:
        group_id = recipients[0].group_id
        await log("info", f"Caching entities from group {group_id}...")
        await client.get_participants(group_id)
        await log("info", "Entity cache ready, sending messages...")

        for i, recipient in enumerate(recipients):
            if state.get("cancelled"):
                await log("cancelled", "Campaign cancelled by user")
                break

            try:
                await client.send_message(recipient.telegram_id, message)
                state["sent"] += 1
                await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id}")

            except FloodWaitError as e:
                wait = e.seconds + 10
                await log("flood_wait", f"Flood wait — pausing {wait}s", "warning")
                await asyncio.sleep(wait)
                try:
                    await client.send_message(recipient.telegram_id, message)
                    state["sent"] += 1
                    await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id} (after retry)")
                except Exception as retry_err:
                    state["failed"] += 1
                    await log("failed", f"Retry failed for {recipient.telegram_id}: {retry_err}", "error")

            except (UserIsBlockedError, InputUserDeactivatedError) as e:
                state["failed"] += 1
                await log("skipped", f"Skipped {recipient.telegram_id}: {type(e).__name__}", "warning")

            except Exception as e:
                state["failed"] += 1
                await log("failed", f"Failed for {recipient.telegram_id}: {e}", "error")

            if (i + 1) % BATCH_SIZE == 0:
                await log("batch_pause", f"Batch of {BATCH_SIZE} done — pausing {BATCH_PAUSE}s", "warning")
                await asyncio.sleep(BATCH_PAUSE)
            else:
                await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    if not state.get("cancelled"):
        state["status"] = "complete"
        await log("complete", f"Campaign complete — {state['sent']} sent, {state['failed']} failed")

    result = {"total": len(recipients), "sent": state["sent"], "failed": state["failed"]}
    logger.info(f"Campaign complete: {result}")
    return result
