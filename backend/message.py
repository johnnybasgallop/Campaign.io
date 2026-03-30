import asyncio
import logging
import os
import random

from telethon import TelegramClient
from telethon.errors import FloodWaitError, InputUserDeactivatedError, UserIsBlockedError

from db import Recipient

logger = logging.getLogger(__name__)

SESSION = "campaign_session"
BATCH_SIZE = 50
BATCH_PAUSE = 60   # seconds to pause after every BATCH_SIZE messages
MIN_DELAY = 3      # minimum seconds between individual messages
MAX_DELAY = 8      # maximum seconds between individual messages


async def messaging_campaign(recipients: list[Recipient], message: str) -> dict:
    api_id = int(os.getenv("TELEGRAM_API_ID"))
    api_hash = os.getenv("TELEGRAM_API_HASH")

    sent = 0
    failed = 0

    async with TelegramClient(SESSION, api_id, api_hash) as client:
        for i, recipient in enumerate(recipients):
            try:
                await client.send_message(recipient.tele_id, message)
                sent += 1
                logger.info(f"[{i+1}/{len(recipients)}] Sent to {recipient.tele_id}")

            except FloodWaitError as e:
                wait = e.seconds + 10
                logger.warning(f"FloodWait — sleeping {wait}s")
                await asyncio.sleep(wait)
                try:
                    await client.send_message(recipient.tele_id, message)
                    sent += 1
                except Exception as retry_err:
                    logger.error(f"Retry failed for {recipient.tele_id}: {retry_err}")
                    failed += 1

            except (UserIsBlockedError, InputUserDeactivatedError) as e:
                logger.info(f"Skipping {recipient.tele_id}: {type(e).__name__}")
                failed += 1

            except Exception as e:
                logger.error(f"Failed for {recipient.tele_id}: {e}")
                failed += 1

            if (i + 1) % BATCH_SIZE == 0:
                logger.info(f"Batch pause — {BATCH_PAUSE}s")
                await asyncio.sleep(BATCH_PAUSE)
            else:
                await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    result = {"total": len(recipients), "sent": sent, "failed": failed}
    logger.info(f"Campaign complete: {result}")
    return result
