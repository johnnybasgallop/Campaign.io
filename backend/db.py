import os
from dataclasses import dataclass

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_pool():
    global _pool
    _pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
    )


async def close_pool():
    if _pool:
        await _pool.close()


@dataclass
class Recipient:
    telegram_id: int
    group_name: str
    group_id: int


async def fetch_recipients(group_name: str) -> list[Recipient]:
    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            'SELECT telegram_id, group_name, group_id FROM "group-backup" WHERE group_name = $1',
            group_name,
        )
    return [
        Recipient(telegram_id=r["telegram_id"], group_name=r["group_name"], group_id=r["group_id"])
        for r in rows
    ]


async def fetch_group_names() -> list[str]:
    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            'SELECT DISTINCT group_name FROM "group-backup" ORDER BY group_name'
        )
    return [r["group_name"] for r in rows]
