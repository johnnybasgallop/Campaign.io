import asyncio
import logging
import os
import random
from typing import Awaitable, Callable

from telethon import TelegramClient
from telethon.errors import FloodWaitError, InputUserDeactivatedError, UserIsBlockedError
from telethon.sessions import StringSession

from db import Recipient

logger = logging.getLogger(__name__)

# Use StringSession from env var in production, fall back to file-based session locally
SESSION = StringSession(os.getenv("TELEGRAM_SESSION").strip()) if os.getenv("TELEGRAM_SESSION") else "campaign_session"
BATCH_SIZE = 50
BATCH_PAUSE = 60  # seconds between batches to avoid Telegram rate limits
MIN_DELAY = 3     # min seconds between individual messages
MAX_DELAY = 8     # max seconds between individual messages

# Type alias for the publish callable passed in from the store
Publish = Callable[[str, str, str, str], Awaitable[None]]


async def run_campaign(
    recipients: list[Recipient],
    message: str,
    campaign_id: str,
    campaigns: dict,
    publish: Publish,
) -> None:
    api_id = int(os.getenv("TELEGRAM_API_ID"))
    api_hash = os.getenv("TELEGRAM_API_HASH")
    state = campaigns[campaign_id]

    # Shorthand so call sites aren't verbose
    async def log(event: str, msg: str, level: str = "info"):
        await publish(campaign_id, event, msg, level)

    await log("started", f"Campaign started — {len(recipients)} recipients")

    async with TelegramClient(SESSION, api_id, api_hash) as client:
        # Fetch all participants and build a lookup by user_id so we can
        # send using the resolved entity rather than a bare integer ID.
        # StringSession has no local cache so bare IDs fail without this.
        group_id = recipients[0].group_id
        await log("info", f"Caching entities from group {group_id}...")
        try:
            participants = await client.get_participants(group_id)
        except ValueError:
            await log("failed", "The messenger account is not a member of the target group — please join the group and retry.", "error")
            state["status"] = "complete"
            return
        entity_map = {p.id: p for p in participants}
        await log("info", f"Cached {len(entity_map)} entities, sending messages...")

        for i, recipient in enumerate(recipients):
            if state.get("cancelled"):
                await log("cancelled", "Campaign cancelled by user")
                break

            entity = entity_map.get(recipient.telegram_id)
            if entity is None:
                state["failed"] += 1
                await log("skipped", f"Skipped {recipient.telegram_id}: not found in group cache", "warning")
                continue

            try:
                await client.send_message(entity, message)
                state["sent"] += 1
                await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id}")

            except FloodWaitError as e:
                wait = e.seconds + 10
                await log("flood_wait", f"Flood wait — pausing {wait}s", "warning")
                await asyncio.sleep(wait)
                # Retry once after the flood wait clears
                try:
                    await client.send_message(entity, message)
                    state["sent"] += 1
                    await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id} (retry)")
                except Exception as retry_err:
                    state["failed"] += 1
                    await log("failed", f"Retry failed for {recipient.telegram_id}: {retry_err}", "error")

            except (UserIsBlockedError, InputUserDeactivatedError) as e:
                state["failed"] += 1
                await log("skipped", f"Skipped {recipient.telegram_id}: {type(e).__name__}", "warning")

            except Exception as e:
                state["failed"] += 1
                await log("failed", f"Failed for {recipient.telegram_id}: {e}", "error")

            # Pause between batches to stay within Telegram's rate limits
            if (i + 1) % BATCH_SIZE == 0:
                await log("batch_pause", f"Batch of {BATCH_SIZE} done — pausing {BATCH_PAUSE}s", "warning")
                await asyncio.sleep(BATCH_PAUSE)
            else:
                await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    if not state.get("cancelled"):
        state["status"] = "complete"
        await log("complete", f"Campaign complete — {state['sent']} sent, {state['failed']} failed")

    logger.info(f"Campaign {campaign_id} finished: {state['sent']} sent, {state['failed']} failed")
