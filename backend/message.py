import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer
from telethon import TelegramClient
from telethon.errors import FloodWaitError, InputUserDeactivatedError, UserIsBlockedError

from db import Recipient

logger = logging.getLogger(__name__)

SESSION = "campaign_session"
BATCH_SIZE = 50
BATCH_PAUSE = 60   # seconds to pause after every BATCH_SIZE messages
MIN_DELAY = 3      # minimum seconds between individual messages
MAX_DELAY = 8      # maximum seconds between individual messages
KAFKA_TOPIC = "campaign-logs"


async def publish(producer: AIOKafkaProducer, campaign_id: str, event: str, message: str, level: str = "info"):
    payload = {
        "campaign_id": campaign_id,
        "event": event,
        "level": level,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await producer.send(KAFKA_TOPIC, json.dumps(payload).encode())


async def messaging_campaign(
    recipients: list[Recipient],
    message: str,
    campaign_id: str,
    campaigns: dict,
    producer: AIOKafkaProducer,
) -> dict:
    api_id = int(os.getenv("TELEGRAM_API_ID"))
    api_hash = os.getenv("TELEGRAM_API_HASH")

    state = campaigns[campaign_id]

    await publish(producer, campaign_id, "started", f"Campaign started — {len(recipients)} recipients")

    async with TelegramClient(SESSION, api_id, api_hash) as client:
        group_id = recipients[0].group_id
        await publish(producer, campaign_id, "info", f"Caching entities from group {group_id}...")
        await client.get_participants(group_id)
        await publish(producer, campaign_id, "info", "Entity cache ready, sending messages...")

        for i, recipient in enumerate(recipients):
            if state.get("cancelled"):
                await publish(producer, campaign_id, "cancelled", "Campaign cancelled by user")
                break

            try:
                await client.send_message(recipient.telegram_id, message)
                state["sent"] += 1
                await publish(
                    producer, campaign_id, "sent",
                    f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id}"
                )

            except FloodWaitError as e:
                wait = e.seconds + 10
                await publish(
                    producer, campaign_id, "flood_wait",
                    f"Flood wait — pausing {wait}s", level="warning"
                )
                await asyncio.sleep(wait)
                try:
                    await client.send_message(recipient.telegram_id, message)
                    state["sent"] += 1
                    await publish(
                        producer, campaign_id, "sent",
                        f"[{i+1}/{len(recipients)}] Sent to {recipient.telegram_id} (after retry)"
                    )
                except Exception as retry_err:
                    state["failed"] += 1
                    await publish(
                        producer, campaign_id, "failed",
                        f"Retry failed for {recipient.telegram_id}: {retry_err}", level="error"
                    )

            except (UserIsBlockedError, InputUserDeactivatedError) as e:
                state["failed"] += 1
                await publish(
                    producer, campaign_id, "skipped",
                    f"Skipped {recipient.telegram_id}: {type(e).__name__}", level="warning"
                )

            except Exception as e:
                state["failed"] += 1
                await publish(
                    producer, campaign_id, "failed",
                    f"Failed for {recipient.telegram_id}: {e}", level="error"
                )

            if (i + 1) % BATCH_SIZE == 0:
                await publish(
                    producer, campaign_id, "batch_pause",
                    f"Batch of {BATCH_SIZE} done — pausing {BATCH_PAUSE}s", level="warning"
                )
                await asyncio.sleep(BATCH_PAUSE)
            else:
                await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    if not state.get("cancelled"):
        state["status"] = "complete"
        await publish(
            producer, campaign_id, "complete",
            f"Campaign complete — {state['sent']} sent, {state['failed']} failed"
        )

    result = {"total": len(recipients), "sent": state["sent"], "failed": state["failed"]}
    logger.info(f"Campaign complete: {result}")
    return result
