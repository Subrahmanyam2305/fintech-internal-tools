"""Seed the OpsDash database. Run: cd backend && python seed.py"""
import random
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.audit import utcnow
from app.auth import MOCK_USERS
from app.db import Base, SessionLocal, engine
from app.models import FeatureFlag, KycSubmission, RefundRequest, User

FIRST = ["Marcus", "Priya", "Jonas", "Fatima", "Diego", "Mei", "Omar", "Ingrid",
         "Tunde", "Sofia", "Kenji", "Amara", "Lukas", "Nadia", "Pablo", "Yuki",
         "Elena", "Raj", "Chloe", "Viktor"]
LAST = ["Okafor", "Sharma", "Larsen", "Haddad", "Reyes", "Tanaka", "Diallo",
        "Berg", "Adeyemi", "Rossi", "Sato", "Osei", "Weber", "Khan", "Silva",
        "Morozov", "Petrov", "Nakamura", "Laurent", "Novak"]
COUNTRIES = ["US", "GB", "DE", "NG", "BR", "JP", "IN", "FR", "CA", "KE"]
DOC_TYPES = ["passport", "proof_of_address", "selfie", "id_card", "bank_statement"]
REASONS = ["damaged_item", "not_received", "wrong_item", "duplicate_charge",
           "service_issue", "other"]

FLAG_DEFS = [
    ("instant_payouts", "Instant Payouts", "Enable same-day payouts to bank accounts"),
    ("new_kyc_flow", "New KYC Flow", "Redesigned KYC document upload flow"),
    ("crypto_wallet_beta", "Crypto Wallet Beta", "Beta access to crypto custody wallet"),
    ("dark_mode", "Dark Mode", "Dark theme for the dashboard"),
    ("fraud_ml_v2", "Fraud ML v2", "Route scoring through v2 fraud model"),
    ("two_factor_enforcement", "2FA Enforcement", "Require 2FA for all customer accounts"),
]


def seed(db_path: str | None = None):
    rng = random.Random(42)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()
    now = utcnow()

    for u in MOCK_USERS:
        db.add(User(**u))

    # --- KYC submissions ---
    statuses = (
        ["pending"] * 7
        + ["in_review"] * 3
        + ["approved"] * 4
        + ["rejected"] * 3
        + ["needs_more_info"] * 3
    )
    rng.shuffle(statuses)
    risk_levels = ["low", "medium", "high"]
    # ensure statuses decided today: force first two approved & first rejected to today
    approved_idx = [i for i, s in enumerate(statuses) if s == "approved"]
    rejected_idx = [i for i, s in enumerate(statuses) if s == "rejected"]

    kyc_rows = []
    for i, status in enumerate(statuses):
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        submitted = now - timedelta(
            days=rng.randint(0, 13), hours=rng.randint(0, 20), minutes=rng.randint(0, 59)
        )
        reviewed_by = None
        reviewed_at = None
        notes = None
        if status in ("in_review", "needs_more_info"):
            reviewed_by = "Alice Chen"
        if status in ("approved", "rejected"):
            reviewed_by = rng.choice(["Alice Chen", "Diana Patel"])
            reviewed_at = submitted + timedelta(
                hours=rng.randint(4, 72), minutes=rng.randint(0, 59)
            )
            notes = (
                f"[Approved by {reviewed_by}] Documents verified"
                if status == "approved"
                else f"[Rejected by {reviewed_by}] Document quality insufficient"
            )
        elif status == "needs_more_info":
            notes = f"[Info requested by Alice Chen] Please re-upload proof of address"

        docs = rng.sample(DOC_TYPES, rng.randint(2, 3))
        doc_urls = [f"/api/documents/{d}_{i + 1}.svg" for d in docs]

        row = KycSubmission(
            customer_name=name,
            customer_email=f"{name.split()[0].lower()}.{name.split()[1].lower()}@example.com",
            country=rng.choice(COUNTRIES),
            status=status,
            risk_level=rng.choice(risk_levels),
            submitted_at=submitted,
            reviewed_by=reviewed_by,
            reviewed_at=reviewed_at,
            notes=notes,
            document_urls=doc_urls,
        )
        kyc_rows.append(row)
        db.add(row)

    # force reviewed_today for first two approved and first rejected
    for idx in approved_idx[:2]:
        r = kyc_rows[idx]
        r.submitted_at = now - timedelta(hours=rng.randint(5, 30))
        r.reviewed_at = now - timedelta(hours=rng.randint(1, 4))
    for idx in rejected_idx[:1]:
        r = kyc_rows[idx]
        r.submitted_at = now - timedelta(hours=rng.randint(5, 30))
        r.reviewed_at = now - timedelta(hours=rng.randint(1, 3))

    # --- Refunds ---
    # >=4 pending_approval (>500), requested <=500, approved (all >500),
    # processing, completed, rejected. Approved rows are >500 and low-value
    # rows never carry an approver (matches the $500 approval rule).
    refund_specs = (
        [("pending_approval", 650.0), ("pending_approval", 999.0),
         ("pending_approval", 720.5), ("pending_approval", 540.0)]
        + [("requested", 120.0), ("requested", 85.0), ("requested", 450.0)]
        + [("approved", 780.0), ("approved", 860.0), ("approved", 610.0)]
        + [("processing", 150.0), ("processing", 300.0)]
        + [("completed", 199.0), ("completed", 75.0)]
        + [("rejected", 400.0)]
    )
    for i, (status, amount) in enumerate(refund_specs):
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        orig = round(amount * rng.uniform(1.0, 2.5), 2)
        req_by = rng.choice(["Bob Martinez", "Diana Patel"])
        requested_at = now - timedelta(
            days=rng.randint(0, 13), hours=rng.randint(0, 20)
        )
        approved_by = None
        completed_at = None
        rejection_reason = None
        if status in ("approved", "processing", "completed") and amount > 500:
            approved_by = "Diana Patel"
        if status == "completed":
            completed_at = requested_at + timedelta(hours=rng.randint(6, 48))
        if status == "rejected":
            rejection_reason = "Refund does not meet policy criteria"
        db.add(
            RefundRequest(
                customer_name=name,
                order_id=f"ORD-{10000 + i * 7 + rng.randint(0, 6)}",
                original_amount=orig,
                refund_amount=round(amount, 2),
                reason=rng.choice(REASONS),
                status=status,
                requested_by=req_by,
                approved_by=approved_by,
                rejection_reason=rejection_reason,
                requested_at=requested_at,
                completed_at=completed_at,
            )
        )

    # --- Feature flags: 10 rows across 3 envs ---
    envs = ["production", "staging", "dev"]
    flag_rows = []
    i = 0
    for key, name, desc in FLAG_DEFS:
        env = envs[i % 3]
        flag_rows.append((key, name, desc, env))
        i += 1
    # add 4 more duplicating keys in other envs
    flag_rows += [
        ("instant_payouts", "Instant Payouts", "Enable same-day payouts to bank accounts", "staging"),
        ("instant_payouts", "Instant Payouts", "Enable same-day payouts to bank accounts", "dev"),
        ("new_kyc_flow", "New KYC Flow", "Redesigned KYC document upload flow", "dev"),
        ("crypto_wallet_beta", "Crypto Wallet Beta", "Beta access to crypto custody wallet", "production"),
    ]
    for key, name, desc, env in flag_rows:
        db.add(
            FeatureFlag(
                key=key,
                name=name,
                description=desc,
                enabled=rng.random() < 0.6,
                rollout_percent=rng.choice([0, 10, 25, 50, 75, 100]),
                environment=env,
                created_by=rng.choice(["Charlie Kim", "Diana Patel"]),
                updated_at=now - timedelta(days=rng.randint(0, 10)),
            )
        )

    db.commit()
    counts = {
        "users": db.query(User).count(),
        "kyc_submissions": db.query(KycSubmission).count(),
        "refund_requests": db.query(RefundRequest).count(),
        "feature_flags": db.query(FeatureFlag).count(),
    }
    db.close()
    return counts


if __name__ == "__main__":
    counts = seed()
    print("Seeded OpsDash:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
