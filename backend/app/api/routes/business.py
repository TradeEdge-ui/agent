from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business, require_role
from app.database.session import get_db
from app.schemas.business import BusinessOut, BusinessUpdate
from app.services.demo_data_service import populate_demo_data

router = APIRouter(prefix="/api/business", tags=["business"])


@router.get("", response_model=BusinessOut)
def get_business(ctx: BusinessContext = Depends(get_current_business)):
    return ctx.business


@router.patch("", response_model=BusinessOut)
def update_business(
    payload: BusinessUpdate,
    ctx: BusinessContext = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(ctx.business, field, value)
    db.add(ctx.business)
    db.commit()
    db.refresh(ctx.business)
    return ctx.business


@router.post("/demo-data")
def load_demo_data(ctx: BusinessContext = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    """Populates the current business with sample customers, leads, tasks,
    a quotation and an invoice draft -- used by the onboarding flow's
    optional 'load demo data' step. Safe to call on an empty business only;
    real records are never touched or duplicated-over."""
    summary = populate_demo_data(db, ctx.business)
    return {"loaded": True, "summary": summary}
