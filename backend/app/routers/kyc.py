from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..audit import utcnow, write_audit
from ..auth import current_user, require_roles
from ..db import get_db
from ..models import KycSubmission, User
from ..schemas import KycActionBody, KycOut, KycRejectBody, KycRequestInfoBody

router = APIRouter(prefix="/api/kyc", tags=["kyc"])

REVIEWABLE = ("pending", "in_review", "needs_more_info")
REVIEW_ROLES = ("analyst", "manager")


def _get_or_404(db: Session, kyc_id: int) -> KycSubmission:
    row = db.get(KycSubmission, kyc_id)
    if row is None:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    return row


def _check_reviewable(row: KycSubmission):
    if row.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=409, detail=f"Submission already {row.status} (terminal)"
        )


def _append_note(existing: str | None, line: str) -> str:
    return f"{existing}\n{line}" if existing else line


@router.get("", response_model=list[KycOut])
def list_kyc(
    status: str | None = None,
    risk_level: str | None = None,
    sort: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    q = select(KycSubmission)
    if status:
        q = q.where(KycSubmission.status.in_(status.split(",")))
    if risk_level:
        q = q.where(KycSubmission.risk_level.in_(risk_level.split(",")))
    col = KycSubmission.submitted_at
    q = q.order_by(col.asc() if sort == "asc" else col.desc())
    return db.scalars(q).all()


@router.get("/stats")
def kyc_stats(db: Session = Depends(get_db)):
    rows = db.scalars(select(KycSubmission)).all()
    total_pending = sum(1 for r in rows if r.status == "pending")
    in_review = sum(1 for r in rows if r.status == "in_review")
    needs_more_info = sum(1 for r in rows if r.status == "needs_more_info")

    decided = [r for r in rows if r.status in ("approved", "rejected") and r.reviewed_at]
    avg_hours = None
    if decided:
        secs = [
            (r.reviewed_at - r.submitted_at).total_seconds()
            for r in decided
            if r.reviewed_at >= r.submitted_at
        ]
        if secs:
            avg_hours = round(sum(secs) / len(secs) / 3600, 2)

    today = utcnow().date()
    approved_today = sum(
        1
        for r in rows
        if r.status == "approved" and r.reviewed_at and r.reviewed_at.date() == today
    )
    rejected_today = sum(
        1
        for r in rows
        if r.status == "rejected" and r.reviewed_at and r.reviewed_at.date() == today
    )
    decided_today = approved_today + rejected_today
    approval_rate_today = (
        round(approved_today / decided_today, 4) if decided_today else None
    )

    return {
        "total_pending": total_pending,
        "in_review": in_review,
        "needs_more_info": needs_more_info,
        "avg_review_time_hours": avg_hours,
        "approval_rate_today": approval_rate_today,
        "decided_today": decided_today,
        "approved_today": approved_today,
    }


@router.get("/{kyc_id}", response_model=KycOut)
def get_kyc(kyc_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, kyc_id)


@router.post("/{kyc_id}/claim", response_model=KycOut)
def claim_kyc(
    kyc_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, kyc_id)
    if user.role == "analyst" and row.status == "pending":
        changes = [
            ("status", row.status, "in_review"),
            ("reviewed_by", row.reviewed_by, user.name),
        ]
        row.status = "in_review"
        row.reviewed_by = user.name
        write_audit(db, user, "kyc.claim", "kyc_submission", row.id, changes)
        db.commit()
        db.refresh(row)
    return row


@router.post("/{kyc_id}/approve", response_model=KycOut)
def approve_kyc(
    kyc_id: int,
    body: KycActionBody,
    user: User = Depends(require_roles(*REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, kyc_id)
    _check_reviewable(row)
    new_notes = row.notes
    if body.notes:
        new_notes = _append_note(row.notes, f"[Approved by {user.name}] {body.notes}")
    changes = [
        ("status", row.status, "approved"),
        ("reviewed_by", row.reviewed_by, user.name),
        ("reviewed_at", row.reviewed_at, utcnow()),
        ("notes", row.notes, new_notes),
    ]
    now = utcnow()
    row.status = "approved"
    row.reviewed_by = user.name
    row.reviewed_at = now
    row.notes = new_notes
    # align audited reviewed_at with stored value
    changes[2] = ("reviewed_at", changes[2][1], now)
    write_audit(db, user, "kyc.approve", "kyc_submission", row.id, changes)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{kyc_id}/reject", response_model=KycOut)
def reject_kyc(
    kyc_id: int,
    body: KycRejectBody,
    user: User = Depends(require_roles(*REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    reason = body.reason.strip() if body.reason else ""
    if not reason:
        raise HTTPException(status_code=422, detail="reason is required")
    row = _get_or_404(db, kyc_id)
    _check_reviewable(row)
    new_notes = _append_note(row.notes, f"[Rejected by {user.name}] {reason}")
    now = utcnow()
    changes = [
        ("status", row.status, "rejected"),
        ("reviewed_by", row.reviewed_by, user.name),
        ("reviewed_at", row.reviewed_at, now),
        ("notes", row.notes, new_notes),
    ]
    row.status = "rejected"
    row.reviewed_by = user.name
    row.reviewed_at = now
    row.notes = new_notes
    write_audit(db, user, "kyc.reject", "kyc_submission", row.id, changes)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{kyc_id}/request-info", response_model=KycOut)
def request_info_kyc(
    kyc_id: int,
    body: KycRequestInfoBody,
    user: User = Depends(require_roles(*REVIEW_ROLES)),
    db: Session = Depends(get_db),
):
    row = _get_or_404(db, kyc_id)
    _check_reviewable(row)
    new_notes = row.notes
    if body.message:
        new_notes = _append_note(
            row.notes, f"[Info requested by {user.name}] {body.message}"
        )
    changes = [
        ("status", row.status, "needs_more_info"),
        ("reviewed_by", row.reviewed_by, user.name),
        ("notes", row.notes, new_notes),
    ]
    row.status = "needs_more_info"
    row.reviewed_by = user.name
    row.notes = new_notes
    write_audit(db, user, "kyc.request_info", "kyc_submission", row.id, changes)
    db.commit()
    db.refresh(row)
    return row
