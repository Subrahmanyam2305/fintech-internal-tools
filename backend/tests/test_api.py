from tests.conftest import ANALYST, ENGINEER, MANAGER, SUPPORT


def _pending_kyc(client):
    rows = client.get("/api/kyc?status=pending", headers=ANALYST).json()
    return rows[0]


def test_claim_pending_by_analyst(client):
    row = _pending_kyc(client)
    r = client.post(f"/api/kyc/{row['id']}/claim", headers=ANALYST)
    assert r.status_code == 200
    assert r.json()["status"] == "in_review"
    audit = client.get(
        f"/api/audit?entity_type=kyc_submission&entity_id={row['id']}",
        headers=ANALYST,
    ).json()
    status_rows = [a for a in audit if a["field"] == "status" and a["action"] == "kyc.claim"]
    assert status_rows[0]["previous_value"] == "pending"
    assert status_rows[0]["new_value"] == "in_review"


def test_claim_by_non_analyst_noop(client):
    row = _pending_kyc(client)
    r = client.post(f"/api/kyc/{row['id']}/claim", headers=SUPPORT)
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    audit = client.get(
        f"/api/audit?entity_type=kyc_submission&entity_id={row['id']}",
        headers=ANALYST,
    ).json()
    assert audit == []


def test_reject_without_reason_422(client):
    row = _pending_kyc(client)
    r = client.post(f"/api/kyc/{row['id']}/reject", headers=ANALYST, json={})
    assert r.status_code == 422
    r = client.post(
        f"/api/kyc/{row['id']}/reject", headers=ANALYST, json={"reason": "   "}
    )
    assert r.status_code == 422


def test_approve_terminal_409(client):
    approved = client.get("/api/kyc?status=approved", headers=ANALYST).json()[0]
    r = client.post(
        f"/api/kyc/{approved['id']}/approve", headers=ANALYST, json={}
    )
    assert r.status_code == 409


def test_kyc_approve_forbidden_for_support(client):
    row = _pending_kyc(client)
    r = client.post(f"/api/kyc/{row['id']}/approve", headers=SUPPORT, json={})
    assert r.status_code == 403


def test_no_header_401(client):
    assert client.get("/api/me").status_code == 401
    row = _pending_kyc(client)
    assert client.post(f"/api/kyc/{row['id']}/claim").status_code == 401


def test_protected_reads_require_auth(client):
    kyc_id = _pending_kyc(client)["id"]
    for path in (
        "/api/kyc",
        "/api/kyc/stats",
        f"/api/kyc/{kyc_id}",
        "/api/refunds",
        "/api/audit",
        "/api/feature-flags",
    ):
        assert client.get(path).status_code == 401, path


def test_public_endpoints_no_auth(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/users").status_code == 200
    assert client.get("/api/flags?env=dev").status_code == 200
    assert client.get("/api/documents/passport_1.svg").status_code == 200


def test_users_public(client):
    r = client.get("/api/users")
    assert r.status_code == 200
    assert len(r.json()) == 4


def test_refund_create_over_threshold(client):
    r = client.post(
        "/api/refunds",
        headers=SUPPORT,
        json={
            "customer_name": "Test Person",
            "order_id": "ORD-99999",
            "original_amount": 1000.0,
            "refund_amount": 600.0,
            "reason": "damaged_item",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending_approval"
    assert body["requires_manager_approval"] is True


def test_refund_create_validation(client):
    r = client.post(
        "/api/refunds",
        headers=SUPPORT,
        json={
            "customer_name": "Test Person",
            "order_id": "ORD-1",
            "original_amount": 100.0,
            "refund_amount": 200.0,
            "reason": "other",
        },
    )
    assert r.status_code == 422


def test_refund_approve_roles(client):
    pending = client.get("/api/refunds?needs_approval=true", headers=MANAGER).json()[0]
    r = client.post(f"/api/refunds/{pending['id']}/approve", headers=SUPPORT)
    assert r.status_code == 403
    r = client.post(f"/api/refunds/{pending['id']}/approve", headers=MANAGER)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    assert r.json()["approved_by"] == "Diana Patel"
    audit = client.get(
        f"/api/audit?entity_type=refund_request&entity_id={pending['id']}",
        headers=MANAGER,
    ).json()
    assert any(a["action"] == "refund.approve" for a in audit)


def test_refund_needs_approval_filter(client):
    rows = client.get("/api/refunds?needs_approval=true", headers=SUPPORT).json()
    assert len(rows) >= 4
    assert all(r["status"] == "pending_approval" for r in rows)
    assert all(r["refund_amount"] > 500 for r in rows)


def test_refund_date_filter(client):
    all_rows = client.get("/api/refunds", headers=SUPPORT).json()
    a_date = all_rows[0]["requested_at"][:10]
    rows = client.get(
        f"/api/refunds?date_from={a_date}&date_to={a_date}", headers=SUPPORT
    ).json()
    assert all(r["requested_at"][:10] == a_date for r in rows)


def test_flag_patch_roles_and_audit(client):
    flags = client.get("/api/feature-flags", headers=ENGINEER).json()
    flag = next(f for f in flags if f["environment"] == "production")
    r = client.patch(
        f"/api/feature-flags/{flag['id']}", headers=ANALYST, json={"enabled": True}
    )
    assert r.status_code == 403
    new_val = not flag["enabled"]
    r = client.patch(
        f"/api/feature-flags/{flag['id']}", headers=ENGINEER, json={"enabled": new_val}
    )
    assert r.status_code == 200
    assert r.json()["enabled"] == new_val
    audit = client.get(
        f"/api/audit?entity_type=feature_flag&entity_id={flag['id']}",
        headers=ENGINEER,
    ).json()
    row = next(a for a in audit if a["action"] == "flag.toggle")
    assert row["previous_value"] == str(flag["enabled"])
    assert row["new_value"] == str(new_val)


def test_flag_rollout_audit(client):
    flags = client.get("/api/feature-flags", headers=ENGINEER).json()
    flag = flags[0]
    new_rollout = 90 if flag["rollout_percent"] != 90 else 55
    r = client.patch(
        f"/api/feature-flags/{flag['id']}",
        headers=ENGINEER,
        json={"rollout_percent": new_rollout},
    )
    assert r.status_code == 200
    audit = client.get(
        f"/api/audit?entity_type=feature_flag&entity_id={flag['id']}&user_id=3",
        headers=ENGINEER,
    ).json()
    assert any(
        a["action"] == "flag.rollout" and a["new_value"] == str(new_rollout)
        for a in audit
    )


def test_flag_rollout_range(client):
    flags = client.get("/api/feature-flags", headers=ENGINEER).json()
    r = client.patch(
        f"/api/feature-flags/{flags[0]['id']}",
        headers=ENGINEER,
        json={"rollout_percent": 150},
    )
    assert r.status_code == 422


def test_runtime_flags_public(client):
    all_flags = client.get("/api/feature-flags", headers=ENGINEER).json()
    expected = sorted(
        [f for f in all_flags if f["environment"] == "staging" and f["enabled"]],
        key=lambda f: f["key"],
    )
    r = client.get("/api/flags?env=staging")
    assert r.status_code == 200
    keys = [f["key"] for f in r.json()]
    assert keys == [f["key"] for f in expected]
    assert r.status_code == 200
    assert client.get("/api/flags?env=bogus").status_code == 422


def test_kyc_stats(client):
    r = client.get("/api/kyc/stats", headers=ANALYST)
    assert r.status_code == 200
    s = r.json()
    for key in (
        "total_pending",
        "in_review",
        "needs_more_info",
        "avg_review_time_hours",
        "approval_rate_today",
        "decided_today",
        "approved_today",
    ):
        assert key in s
    assert s["total_pending"] == 7
    assert s["approval_rate_today"] is not None
    assert 0 <= s["approval_rate_today"] <= 1


def test_documents_public(client):
    r = client.get("/api/documents/passport_7.svg")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/svg+xml"
    assert "Passport" in r.text


def test_kyc_list_filters_and_sort(client):
    rows = client.get("/api/kyc?status=pending,in_review", headers=ANALYST).json()
    assert all(r["status"] in ("pending", "in_review") for r in rows)
    dates = [r["submitted_at"] for r in rows]
    assert dates == sorted(dates, reverse=True)
    rows = client.get("/api/kyc?risk_level=high", headers=ANALYST).json()
    assert all(r["risk_level"] == "high" for r in rows)


def test_timestamps_z_suffix(client):
    row = _pending_kyc(client)
    assert row["submitted_at"].endswith("Z")


def test_date_to_inclusive_end_of_day(client):
    from datetime import datetime

    from app.db import SessionLocal
    from app.models import RefundRequest

    db = SessionLocal()
    row = RefundRequest(
        customer_name="Late Night",
        order_id="ORD-2330",
        original_amount=200.0,
        refund_amount=50.0,
        reason="other",
        status="requested",
        requested_by="Bob Martinez",
        requested_at=datetime(2024, 6, 15, 23, 30),
    )
    db.add(row)
    db.commit()
    rid = row.id
    db.close()

    rows = client.get(
        "/api/refunds?date_from=2024-06-15&date_to=2024-06-15",
        headers=SUPPORT,
    ).json()
    assert rid in [r["id"] for r in rows]


def test_flag_patch_noop(client):
    flags = client.get("/api/feature-flags", headers=ENGINEER).json()
    flag = flags[0]
    r = client.patch(
        f"/api/feature-flags/{flag['id']}",
        headers=ENGINEER,
        json={"enabled": flag["enabled"], "rollout_percent": flag["rollout_percent"]},
    )
    assert r.status_code == 200
    assert r.json()["updated_at"] == flag["updated_at"]
    audit = client.get(
        f"/api/audit?entity_type=feature_flag&entity_id={flag['id']}&user_id=3",
        headers=ENGINEER,
    ).json()
    assert audit == []
