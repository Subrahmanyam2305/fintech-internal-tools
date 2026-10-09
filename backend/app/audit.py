from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import AuditLog, User


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def write_audit(
    db: Session,
    user: User,
    action: str,
    entity_type: str,
    entity_id: int,
    changes: list[tuple[str, object, object]],
) -> None:
    """Write one audit row per changed field. Skips no-op changes.
    Caller commits; rows are part of the same transaction."""
    for field, prev, new in changes:
        prev_s = None if prev is None else str(prev)
        new_s = None if new is None else str(new)
        if prev_s == new_s:
            continue
        db.add(
            AuditLog(
                user_id=user.id,
                user_name=user.name,
                user_role=user.role,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                field=field,
                previous_value=prev_s,
                new_value=new_s,
                created_at=utcnow(),
            )
        )
