from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_business, get_current_user, BusinessContext
from app.database.session import get_db
from app.models.business import Business, BusinessMember
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse, UserOut
from app.security.passwords import hash_password, verify_password
from app.security.tokens import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()

    business = Business(name=payload.business_name)
    db.add(business)
    db.flush()

    membership = BusinessMember(business_id=business.id, user_id=user.id, role="OWNER")
    db.add(membership)
    db.commit()

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    ctx: BusinessContext = Depends(get_current_business),
):
    return MeResponse(
        user=UserOut.model_validate(current_user),
        business_id=ctx.business.id,
        business_name=ctx.business.name,
        role=ctx.role,
        onboarding_completed=ctx.business.onboarding_completed,
    )
