# OpsDash

Internal tools platform for a fintech operations team. OpsDash bundles four
ops workflows behind a mock sign-in:

- **KYC Review** — a review queue for customer identity submissions with
  claiming, approve/reject/request-info decisions and per-submission documents.
- **Refunds** — refund request intake and a two-stage payout pipeline with
  manager approval for amounts over $500.
- **Feature Flags** — a runtime flag endpoint plus an admin console for
  toggling flags and rollout percentages per environment.
- **Audit Log** — an append-only record of every mutation, one row per
  changed field.

## Running

### Backend (Python 3.10+, FastAPI + SQLite)

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python seed.py            # drops & recreates tables, loads demo data
.venv/bin/uvicorn app.main:app --reload --port 8000
```

The database file defaults to `backend/opsdash.db`; override with the
`OPSDASH_DB_PATH` environment variable.

### Frontend (Node 20/22, Vite + React + Tailwind + shadcn/ui)

```bash
cd frontend
npm install
npm run dev                         # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000`, so all API calls are
relative and the seeded document URLs (`/api/documents/*.svg`) work as-is.

## Architecture

```
backend/
  app/
    main.py         FastAPI app, CORS, create_all on startup
    db.py           engine/session, OPSDASH_DB_PATH
    models.py       users, kyc_submissions, refund_requests, feature_flags, audit_log
    schemas.py      pydantic response/request models (ISO-8601 UTC "Z" timestamps)
    auth.py         X-User-Id dependency + require_roles
    audit.py        write_audit(): one audit row per changed field
    routers/        users, kyc, refunds, flags, audit, documents
  seed.py           deterministic demo data (random.Random(42))
  tests/            pytest + TestClient against a tmp DB
frontend/
  src/lib/api.ts    typed fetch wrapper (adds X-User-Id, throws ApiError)
  src/types.ts      TS types mirroring backend schemas
  src/auth/         AuthContext (localStorage opsdash.userId) + permission map
  src/pages/        Login + placeholder KYC/Refunds/Flags/Audit pages
  src/components/   layout/AppLayout (sidebar) + ui/ (shadcn)
```

### Auth

Mock auth: every request sends `X-User-Id: <id>` for one of four seeded users.

| User          | Role           |
| ------------- | -------------- |
| Alice Chen    | analyst        |
| Bob Martinez  | support_agent  |
| Charlie Kim   | engineer       |
| Diana Patel   | manager        |

Public endpoints (no header): `GET /api/health`, `GET /api/users`,
`GET /api/flags`, `GET /api/documents/*`. Everything else requires
`X-User-Id`; missing/unknown → 401.

### Permissions

| Capability                    | Roles                  |
| ----------------------------- | ---------------------- |
| Review KYC (approve/reject…)  | analyst, manager       |
| Claim KYC (pending→in_review) | any analyst; others no-op |
| Create refund                 | support_agent, manager |
| Approve/reject refund         | manager                |
| Process/complete refund       | support_agent, manager |
| Edit feature flags            | engineer, manager      |

A refund with `refund_amount > 500` (`APPROVAL_THRESHOLD`) is created in
`pending_approval` and requires manager approval.

### Audit log

Mutations write rows to `audit_log` in the same transaction — one row per
changed field (`field`, `previous_value`, `new_value`), never for no-ops.
Query with `GET /api/audit?entity_type=&entity_id=&user_id=&limit=100`
(newest first).

### API endpoints

```
GET    /api/health
GET    /api/users                       (public)
GET    /api/me
GET    /api/kyc?status=&risk_level=&sort=
GET    /api/kyc/stats
GET    /api/kyc/{id}
POST   /api/kyc/{id}/claim|approve|reject|request-info
GET    /api/refunds?status=&date_from=&date_to=&needs_approval=
POST   /api/refunds
POST   /api/refunds/{id}/approve|reject|process|complete
GET    /api/flags?env=production|staging|dev   (public runtime endpoint, enabled only)
GET    /api/feature-flags?environment=
PATCH  /api/feature-flags/{id}   {enabled?, rollout_percent?}
GET    /api/audit?entity_type=&entity_id=&user_id=&limit=
GET    /api/documents/{name}.svg        (generated placeholder images)
```

Runtime flag lookup (e.g. from another service):

```bash
curl 'http://localhost:8000/api/flags?env=production'
# [{"key":"instant_payouts","name":"Instant Payouts","rollout_percent":50, ...}]
```

## Tests

```bash
cd backend
.venv/bin/pytest -q
```

Tests run against a temp SQLite database seeded via `seed.seed()`.

## Screenshots

TODO
