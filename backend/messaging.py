import asyncio
import logging
import os
import random
from typing import Awaitable, Callable

from telethon import TelegramClient
from telethon.errors import FloodWaitError, PeerFloodError, InputUserDeactivatedError, UserIsBlockedError
from telethon.sessions import StringSession
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.tl.types import ChannelParticipantsSearch

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


async def fetch_all_participants(client: TelegramClient, group_id: int) -> dict:
    """
    Manually paginate GetParticipantsRequest to bypass Telethon's 200-member cap.
    As a channel admin, Telegram allows full pagination via offset.
    Returns a dict of {user_id: user_entity}.
    """
    entity_map = {}
    offset = 0
    limit = 200

    while True:
        result = await client(GetParticipantsRequest(
            channel=group_id,
            filter=ChannelParticipantsSearch(q=''),
            offset=offset,
            limit=limit,
            hash=0,
        ))
        if not result.users:
            break
        for user in result.users:
            entity_map[user.id] = user
        offset += len(result.participants)
        if len(result.participants) < limit:
            break
        await asyncio.sleep(1)  # avoid hitting rate limits during fetch

    return entity_map


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

    async def log(event: str, msg: str, level: str = "info"):
        await publish(campaign_id, event, msg, level)

    await log("started", f"Campaign started — {len(recipients)} recipients")

    async with TelegramClient(SESSION, api_id, api_hash) as client:
        group_id = recipients[0].group_id
        await log("info", f"Fetching all participants from group {group_id}...")
        try:
            entity_map = await fetch_all_participants(client, group_id)
        except Exception as e:
            await log("failed", f"Could not fetch participants: {e}", "error")
            state["status"] = "complete"
            return
        await log("info", f"Cached {len(entity_map)} entities, sending messages...")

        for i, recipient in enumerate(recipients):
            if state.get("cancelled"):
                await log("cancelled", "Campaign cancelled by user")
                break

            entity = entity_map.get(recipient.telegram_id)
            if entity is None:
                state["failed"] += 1
                await log("skipped", f"Skipped {recipient.telegram_id}: not found in group", "warning")
                continue

            try:
                await client.send_message(entity, message)
                state["sent"] += 1
                await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id}")

            except FloodWaitError as e:
                wait = e.seconds + 10
                await log("flood_wait", f"Flood wait — pausing {wait}s", "warning")
                await asyncio.sleep(wait)
                try:
                    await client.send_message(entity, message)
                    state["sent"] += 1
                    await log("sent", f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id} (retry)")
                except Exception as retry_err:
                    state["failed"] += 1
                    await log("failed", f"Retry failed for {recipient.telegram_id}: {retry_err}", "error")

            except PeerFloodError:
                state["failed"] += 1
                await log("failed", f"Skipped {recipient.telegram_id}: account restricted from messaging non-contacts (PeerFlood)", "error")

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

    logger.info(f"Campaign {campaign_id} finished: {state['sent']} sent, {state['failed']} failed")
