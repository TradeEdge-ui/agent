from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    level: str
    link: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
