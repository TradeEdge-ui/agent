"""Notifications API (spec #36): the frontend polls this to decide when to
fire a real browser desktop notification (Notification API) -- the backend
never pretends to have pushed anything to the OS itself; it just records
what happened and lets the client surface it."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.business_id == ctx.business.id)
    if unread_only:
        query = query.filter(Notification.read == False)  # noqa: E712
    return query.order_by(Notification.created_at.desc()).limit(min(limit, 200)).all()


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    note = db.query(Notification).filter(
        Notification.id == notification_id, Notification.business_id == ctx.business.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.read = True
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/read-all")
def mark_all_read(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.business_id == ctx.business.id, Notification.read == False  # noqa: E712
    ).update({"read": True})
    db.commit()
    return {"ok": True}
