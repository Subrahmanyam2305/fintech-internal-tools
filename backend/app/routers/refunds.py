from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..audit import utcnow, write_audit
from ..auth import current_user, require_roles
from ..db import get_db
from ..models import RefundRequest, User
from ..schemas import RefundCreateBody, RefundOut, RefundRejectBody

router = APIRouter(
    prefix="/api/refunds", tags=["refunds"], dependencies=[Depends(current_user)]
)

APPROVAL_THRESHOLD = 500
REASONS = {
    "damaged_item",
    "not_received",
    "wrong_item",
    "duplicate_charge",
    "service_issue",
    "other",
}
APPROVABLE = ("requested", "pending_approval")


def _get_or_404(db: Session, refund_id: int) -> RefundRequest:
    row = db.get(RefundRequest, refund_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Refund request not found")
    return row


def _out(row: RefundRequest) -> RefundOut:
    data = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    data["requires_manager_approval"] = row.refund_amount > APPROVAL_THRESHOLD
    return RefundOut(**data)


@router.get("", response_model=list[RefundOut])
def list_refunds(
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    needs_approval: bool = False,
    db: Session = Depends(get_db),
):
    q = select(RefundRequest)
    if needs_approval:
        q = q.where(RefundRequest.status == "pending_approval")
    elif status:
        q = q.where(RefundRequest.status.in_(status.split(",")))
    if date_from:
        q = q.where(func.date(RefundRequest.requested_at) >= date_from.isoformat())
    if date_to:
        q = q.where(func.date(RefundRequest.requested_at) <= date_to.isoformat())
    rows = db.scalars(q.order_by(RefundRequest.requested_at.desc())).all()
    return [_out(r) for r in rows]


@router.post("", response_model=RefundOut, status_code=201)
def create_refund(
    body: RefundCreateBody,
    user: User = Depends(require_roles("support_agent", "manager")),
    db: Session = Depends(get_db),
):
    if body.reason not in REASONS:
        raise HTTPException(status_code=422, detail="invalid reason")
    if body.refund_amount <= 0 or body.refund_amount > body.original_amount:
        raise HTTPException(
            status_code=422,
            detail="refund_amount must be > 0 and <= original_amount",
        )
    status = (
        "pending_approval"
        if body.refund_amount > APPROVAL_THRESHOLD
        else "requested"
    )
    row = RefundRequest(
        customer_name=body.customer_name,
        order_id=body.order_id,
        original_amount=round(body.original_amount, 2),
        refund_amount=round(body.refund_amount, 2),
        reason=body.reason,
        status=status,
        requested_by=user.name,
        requested_at=utcnow(),
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        user,
        "refund.create",
        "refund_request",
        row.id,
        [("status", None, status)],
    )
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/{refund_id}/approve", response_model=RefundOut)
def approve_refund(
    refund_id: int,
    user: User = Depends(require_roles("manager")),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, refund_id)
    if row.status not in APPROVABLE:
        raise HTTPException(
            status_code=409, detail=f"Cannot approve refund in status {row.status}"
        )
    changes = [
        ("status", row.status, "approved"),
        ("approved_by", row.approved_by, user.name),
    ]
    row.status = "approved"
    row.approved_by = user.name
    write_audit(db, user, "refund.approve", "refund_request", row.id, changes)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/{refund_id}/reject", response_model=RefundOut)
def reject_refund(
    refund_id: int,
    body: RefundRejectBody,
    user: User = Depends(require_roles("manager")),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, refund_id)
    if row.status not in APPROVABLE:
        raise HTTPException(
            status_code=409, detail=f"Cannot reject refund in status {row.status}"
        )
    changes = [
        ("status", row.status, "rejected"),
        ("rejection_reason", row.rejection_reason, body.reason),
    ]
    row.status = "rejected"
    row.rejection_reason = body.reason
    write_audit(db, user, "refund.reject", "refund_request", row.id, changes)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/{refund_id}/process", response_model=RefundOut)
def process_refund(
    refund_id: int,
    user: User = Depends(require_roles("support_agent", "manager")),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, refund_id)
    if row.status != "approved":
        raise HTTPException(
            status_code=409, detail=f"Cannot process refund in status {row.status}"
        )
    changes = [("status", row.status, "processing")]
    row.status = "processing"
    write_audit(db, user, "refund.process", "refund_request", row.id, changes)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/{refund_id}/complete", response_model=RefundOut)
def complete_refund(
    refund_id: int,
    user: User = Depends(require_roles("support_agent", "manager")),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, refund_id)
    if row.status != "processing":
        raise HTTPException(
            status_code=409, detail=f"Cannot complete refund in status {row.status}"
        )
    now = utcnow()
    changes = [
        ("status", row.status, "completed"),
        ("completed_at", row.completed_at, now),
    ]
    row.status = "completed"
    row.completed_at = now
    write_audit(db, user, "refund.complete", "refund_request", row.id, changes)
    db.commit()
    db.refresh(row)
    return _out(row)
