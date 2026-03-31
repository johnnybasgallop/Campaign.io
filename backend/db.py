import os
import asyncpg
from dataclasses import dataclass


@dataclass
class Recipient:
    telegram_id: int
    group_name: str
    group_id: int


async def fetch_recipients(group_name: str) -> list[Recipient]:
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
    )
    try:
        if group_name:
            rows = await conn.fetch(
                'SELECT telegram_id, group_name, group_id FROM "group-backup" WHERE group_name = $1',
                group_name,
            )
        else:
            rows = await conn.fetch('SELECT telegram_id, group_name, group_id FROM "group-backup"')

        return [Recipient(telegram_id=row["telegram_id"], group_name=row["group_name"], group_id=row["group_id"]) for row in rows]
    finally:
        await conn.close()
