from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.approval import Approval
from app.schemas.approval import ApprovalDecision, ApprovalOut
from app.services.approval_service import approval_to_dict

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalOut])
def list_approvals(status: str | None = "PENDING", ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    query = db.query(Approval).filter(Approval.business_id == ctx.business.id)
    if status:
        query = query.filter(Approval.status == status)
    approvals = query.order_by(Approval.created_at.desc()).all()
    return [approval_to_dict(a) for a in approvals]


@router.get("/{approval_id}", response_model=ApprovalOut)
def get_approval(approval_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    approval = db.query(Approval).filter(Approval.id == approval_id, Approval.business_id == ctx.business.id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval_to_dict(approval)


@router.post("/{approval_id}/approve", response_model=ApprovalOut)
def approve(approval_id: str, payload: ApprovalDecision, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    from app.agent.orchestrator import resume_run_after_approval

    approval = db.query(Approval).filter(Approval.id == approval_id, Approval.business_id == ctx.business.id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "PENDING":
        raise HTTPException(status_code=400, detail="Approval already decided")

    import json as _json

    if payload.edited_input is not None:
        approval.status = "EDITED_APPROVED"
        approval.edited_input_json = _json.dumps(payload.edited_input)
    else:
        approval.status = "APPROVED"
    approval.decided_by = ctx.member.user_id
    approval.decision_notes = payload.notes
    db.add(approval)
    db.commit()
    db.refresh(approval)

    if approval.run_id:
        resume_run_after_approval(db, approval.run_id, ctx)

    return approval_to_dict(approval)


@router.post("/{approval_id}/reject", response_model=ApprovalOut)
def reject(approval_id: str, payload: ApprovalDecision, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    from app.agent.orchestrator import resume_run_after_approval

    approval = db.query(Approval).filter(Approval.id == approval_id, Approval.business_id == ctx.business.id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "PENDING":
        raise HTTPException(status_code=400, detail="Approval already decided")

    approval.status = "REJECTED"
    approval.decided_by = ctx.member.user_id
    approval.decision_notes = payload.notes
    db.add(approval)
    db.commit()
    db.refresh(approval)

    if approval.run_id:
        resume_run_after_approval(db, approval.run_id, ctx)

    return approval_to_dict(approval)
