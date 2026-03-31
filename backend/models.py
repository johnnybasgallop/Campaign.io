from pydantic import BaseModel


class CampaignRequest(BaseModel):
    group_name: str
    message: str
