"""Shared FastAPI dependencies: current user, current business context, role checks.

Authorization is enforced here -- server-side -- not merely hidden in the
frontend. Every business-scoped endpoint depends on `get_current_business`,
which guarantees the caller is an actual member of that business before any
query touches its data.
"""
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.business import Business, BusinessMember
from app.models.user import User
from app.security.tokens import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ROLE_RANK = {"USER": 1, "ADMIN": 2, "OWNER": 3}


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error
    user_id = decode_access_token(token)
    if not user_id:
        raise credentials_error
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_error
    return user


class BusinessContext:
    def __init__(self, business: Business, member: BusinessMember):
        self.business = business
        self.member = member
        self.role = member.role


def get_current_business(
    x_business_id: str | None = Header(default=None, alias="X-Business-Id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BusinessContext:
    """Resolve which business the request is scoped to.

    If the user belongs to exactly one business (the common MVP case) that
    is used automatically. Otherwise an explicit X-Business-Id header is
    required. In both cases we verify membership server-side.
    """
    memberships = (
        db.query(BusinessMember).filter(BusinessMember.user_id == current_user.id).all()
    )
    if not memberships:
        raise HTTPException(status_code=404, detail="No business found for this user")

    member = None
    if x_business_id:
        member = next((m for m in memberships if m.business_id == x_business_id), None)
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of that business")
    else:
        member = memberships[0]

    business = db.get(Business, member.business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return BusinessContext(business=business, member=member)


def require_role(minimum_role: str):
    def _dep(ctx: BusinessContext = Depends(get_current_business)) -> BusinessContext:
        if ROLE_RANK.get(ctx.role, 0) < ROLE_RANK.get(minimum_role, 99):
            raise HTTPException(status_code=403, detail=f"Requires role >= {minimum_role}")
        return ctx

    return _dep
