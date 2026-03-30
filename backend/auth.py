"""
Run this once to generate the Telethon session file before starting the API.
    python auth.py
"""
import asyncio
import os

from dotenv import load_dotenv
from telethon import TelegramClient

load_dotenv()


async def main():
    async with TelegramClient(
        "campaign_session",
        int(os.getenv("TELEGRAM_API_ID")),
        os.getenv("TELEGRAM_API_HASH"),
    ) as client:
        me = await client.get_me()
        print(f"Authenticated as: {me.first_name} (@{me.username})")


asyncio.run(main())
