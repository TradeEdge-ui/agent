from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    actor: str | None = None,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).filter(AuditLog.business_id == ctx.business.id)
    if actor:
        query = query.filter(AuditLog.actor == actor)
    return query.order_by(AuditLog.created_at.desc()).limit(min(limit, 500)).all()
