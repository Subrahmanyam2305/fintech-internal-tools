import os

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

MOCK_USERS = [
    {"id": 1, "name": "Alice Chen", "role": "analyst"},
    {"id": 2, "name": "Bob Martinez", "role": "support_agent"},
    {"id": 3, "name": "Charlie Kim", "role": "engineer"},
    {"id": 4, "name": "Diana Patel", "role": "manager"},
]


MOCK_AUTH_DISABLED_DETAIL = (
    "Mock authentication is disabled. Set OPSDASH_MOCK_AUTH=1 to run the demo "
    "with simulated identities. No production authentication is implemented."
)


def mock_auth_enabled() -> bool:
    return os.environ.get("OPSDASH_MOCK_AUTH") == "1"


def current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    if not mock_auth_enabled():
        raise HTTPException(status_code=503, detail=MOCK_AUTH_DISABLED_DETAIL)
    if x_user_id is None:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        uid = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid X-User-Id header")
    user = db.get(User, uid)
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            label = " or ".join(roles)
            raise HTTPException(
                status_code=403, detail=f"Only {label} can perform this action"
            )
        return user

    return dep
