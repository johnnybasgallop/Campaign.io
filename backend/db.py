import os
import asyncpg
from dataclasses import dataclass


@dataclass
class Recipient:
    tele_id: int
    group_name: str


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
                'SELECT tele_id, groupname FROM "group-backup" WHERE groupname = $1',
                group_name,
            )
        else:
            rows = await conn.fetch('SELECT tele_id, groupname FROM "group-backup"')

        return [Recipient(tele_id=row["tele_id"], group_name=row["groupname"]) for row in rows]
    finally:
        await conn.close()
