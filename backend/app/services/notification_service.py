"""Notification abstraction.

`NotificationProvider` is the interface; `InAppNotificationProvider` (writes
to the DB, read by the frontend) is the only implementation wired up for
the MVP. An `EmailNotificationProvider` can be added later by implementing
the same interface -- nothing else in the app needs to change.
"""
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationProvider(ABC):
    @abstractmethod
    def notify(self, db: Session, *, business_id: str, user_id: str | None, title: str,
               body: str = "", level: str = "info", link: str = "") -> Notification:
        ...


class InAppNotificationProvider(NotificationProvider):
    def notify(self, db: Session, *, business_id: str, user_id: str | None, title: str,
               body: str = "", level: str = "info", link: str = "") -> Notification:
        note = Notification(
            business_id=business_id, user_id=user_id, title=title, body=body, level=level, link=link
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note


default_notification_provider: NotificationProvider = InAppNotificationProvider()
