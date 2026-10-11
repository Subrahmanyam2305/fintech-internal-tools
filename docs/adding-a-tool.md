# Adding a fourth tool

OpsDash has no plugin system and no configuration-only way to add a tool.
A new tool is ordinary code: backend models, schemas, routes and tests, plus a
React page. This guide lists what that code can reuse and what you still have to
write. "Chargebacks" is used as the example tool.

## What you can reuse

| Concern | Existing piece | How a new tool uses it |
| --- | --- | --- |
| DB engine/session | `backend/app/db.py` (`Base`, `engine`, `get_db`) | Subclass `Base`. `main.py` runs `Base.metadata.create_all` on startup; there are no migrations. |
| Identity | `backend/app/auth.py` (`current_user`, `mock_auth_enabled`) | `dependencies=[Depends(current_user)]` on the router gives the same `OPSDASH_MOCK_AUTH` gate, 401 and 503 behavior. |
| Role checks | `require_roles(*roles)` in `auth.py` | `user: User = Depends(require_roles("support_agent", "manager"))` on each mutation. |
| Audit | `backend/app/audit.py::write_audit(db, user, action, entity_type, entity_id, changes)` | Call it before `db.commit()` with `[(field, old, new), ...]`. It writes one row per changed field and skips no-ops. `GET /api/audit?entity_type=...` and the Audit Log page work for any `entity_type` string. |
| Timestamps | `utcnow()` in `audit.py`; `ORMModel` in `schemas.py` (UTC "Z" output) | Reuse both in models and response schemas. |
| Test harness | `backend/tests/conftest.py` (`client` fixture: temp DB, seeded, mock auth on) and the role header constants | New test files get a fresh seeded DB for each test. |
| API client | `frontend/src/lib/api.ts::api<T>()` | Adds `X-User-Id` and throws `ApiError` with the server's `detail`. |
| Permissions (UI only) | `frontend/src/auth/permissions.ts` (`Permission`, `PERMISSION_ROLES`), `useAuth().can()` | Used to hide or disable controls. The backend `require_roles` remains the enforcement point. |
| Layout/navigation | `NAV` array in `frontend/src/components/layout/AppLayout.tsx`; routes in `frontend/src/App.tsx` | Add one `NAV` item and one `<Route>` inside the authenticated layout. The demo banner and sidebar come for free. |
| UI building blocks | `components/PageHeader.tsx` (`PageHeader`, `StatCard`), `StatusBadge.tsx`, `ActionDialog.tsx` (reason/notes prompt), `AuditTrail.tsx` (per-entity history), `lib/format.ts`, shadcn `components/ui/*` | Compose the page from these. |

## What still requires new code

1. **Model**: a class in `backend/app/models.py` (e.g. `Chargeback`, `__tablename__ = "chargebacks"`).
   Existing SQLite files won't get new columns from `create_all` on old tables.
   For a new table, `create_all` is enough. For column changes, run `seed.py` (destructive) or add a migration tool.
2. **Schemas**: request and response models in `backend/app/schemas.py`, with
   input validation (see `RefundCreateBody`: `Decimal`, `decimal_places=2`,
   `allow_inf_nan=False` for money).
3. **Router**: `backend/app/routers/chargebacks.py`, registered with
   `app.include_router(...)` in `main.py`. The state machine is
   tool-specific. Follow the refunds pattern:
   - check the current status and raise 409 **before** mutating anything;
   - collect `changes`;
   - mutate;
   - call `write_audit`;
   - commit once.
4. **Seed data**: add synthetic rows in `backend/seed.py` if the demo needs them.
5. **Tests**: `backend/tests/test_chargebacks.py`. Cover the role matrix (403),
   every allowed transition, invalid/repeated transitions (409, with status and
   audit count unchanged), and validation (422).
6. **Frontend types/API**: TS types in `frontend/src/types.ts` and fetch
   helpers in `frontend/src/lib/api.ts`.
7. **Page**: `frontend/src/pages/Chargebacks.tsx` using React Query
   (`useQuery`/`useMutation`). After a mutation, invalidate both the tool's
   queries and `["audit"]`.
8. **Permissions**: new `Permission` keys in `permissions.ts`, kept in sync
   by hand with the backend `require_roles` calls. Nothing generates one from
   the other.
9. **Audit page links**: `frontend/src/pages/AuditLog.tsx` maps
   `entity_type` to a tool filter label and a record link. Add the new type
   there, and to the `EntityType` union in `types.ts`.

## Not provided

There is no shared workflow/state-machine engine, no form generator, no
role-to-permission config file, and no production auth. Each of those would
be new design work, not configuration.
