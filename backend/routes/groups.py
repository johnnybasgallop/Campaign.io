from fastapi import APIRouter

from db import fetch_group_names

router = APIRouter()


@router.get("/groups")
async def get_groups():
    groups = await fetch_group_names()
    return {"groups": groups}
