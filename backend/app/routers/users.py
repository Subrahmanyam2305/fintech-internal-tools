from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import MOCK_AUTH_DISABLED_DETAIL, current_user, mock_auth_enabled
from ..db import get_db
from ..models import User
from ..schemas import UserOut

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    if not mock_auth_enabled():
        raise HTTPException(status_code=503, detail=MOCK_AUTH_DISABLED_DETAIL)
    return db.scalars(select(User).order_by(User.id)).all()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
