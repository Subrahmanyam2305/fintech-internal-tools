from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import utcnow, write_audit
from ..auth import current_user, require_roles
from ..db import get_db
from ..models import FeatureFlag, User
from ..schemas import FlagOut, FlagPatchBody, FlagRuntimeOut

router = APIRouter(prefix="/api", tags=["flags"])

ENVS = ("production", "staging", "dev")


@router.get("/flags", response_model=list[FlagRuntimeOut])
def runtime_flags(
    env: str = Query(...),
    db: Session = Depends(get_db),
):
    if env not in ENVS:
        raise HTTPException(status_code=422, detail="invalid environment")
    rows = db.scalars(
        select(FeatureFlag)
        .where(FeatureFlag.environment == env, FeatureFlag.enabled.is_(True))
        .order_by(FeatureFlag.key)
    ).all()
    return rows


@router.get("/feature-flags", response_model=list[FlagOut])
def list_flags(
    environment: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = select(FeatureFlag).order_by(FeatureFlag.key, FeatureFlag.environment)
    if environment:
        q = q.where(FeatureFlag.environment == environment)
    return db.scalars(q).all()


@router.patch("/feature-flags/{flag_id}", response_model=FlagOut)
def patch_flag(
    flag_id: int,
    body: FlagPatchBody,
    user: User = Depends(require_roles("engineer", "manager")),
    db: Session = Depends(get_db),
):
    row = db.get(FeatureFlag, flag_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    if body.rollout_percent is not None and not (0 <= body.rollout_percent <= 100):
        raise HTTPException(status_code=422, detail="rollout_percent must be 0..100")

    changed = False
    if body.enabled is not None and body.enabled != row.enabled:
        write_audit(
            db, user, "flag.toggle", "feature_flag", row.id,
            [("enabled", row.enabled, body.enabled)],
        )
        row.enabled = body.enabled
        changed = True
    if body.rollout_percent is not None and body.rollout_percent != row.rollout_percent:
        write_audit(
            db, user, "flag.rollout", "feature_flag", row.id,
            [("rollout_percent", row.rollout_percent, body.rollout_percent)],
        )
        row.rollout_percent = body.rollout_percent
        changed = True
    if changed:
        row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    return row
