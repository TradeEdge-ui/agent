from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.schemas.dashboard import DailyBriefOut, DashboardOut
from app.services.dashboard_service import generate_daily_brief, get_dashboard_data

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return get_dashboard_data(db, ctx.business)


@router.get("/daily-brief", response_model=DailyBriefOut)
def daily_brief(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return generate_daily_brief(db, ctx.business)
