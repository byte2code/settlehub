# SettleHub 3.0 — Handoff Notes

Work in progress on branch **`ccr-10df20d2-y17nyo`**. The full plan and audit is in
[`docs/settlehub_3.0_plan.md`](settlehub_3.0_plan.md). Its checkboxes describe the target; this
file says what is actually done.

## Get it locally

```bash
cd antigravity-ide/settlehub
git fetch origin
git checkout ccr-10df20d2-y17nyo
```

Requirements: Java 21, Maven 3.9+, Node 22+.

```bash
# Backend: in-memory H2 + demo users alice@/bob@settlehub.com (password: password123)
cd backend && mvn test && mvn spring-boot:run          # http://localhost:8080

# Frontend: proxies /api and /ws to :8080
cd frontend && npm ci && npm test && npm run dev        # http://localhost:3000
```

## Done

### Backend (committed, 40/40 tests passing)
- Spring Boot 3.3.4 → **4.1.2** (Hibernate 7, Jackson 3), Java 21, virtual threads.
- **Flyway**: `V1__baseline_2_0_schema.sql` (the 2.0 schema; existing DBs get baselined) and
  `V2__settlehub_3_0.sql`. `ddl-auto=validate`. **Checked against a real 2.0 PostgreSQL DB**:
  balances unchanged, receipts migrated, 2.0 tokens still valid.
- Membership authorization on every endpoint (non-members get 404). Admin-only actions get 403.
- Authenticated STOMP (JWT on CONNECT, membership checked on SUBSCRIBE).
- 401 for bad login (2.0 returned 500), rate limiting on auth, 8-character minimum password.
- `JWT_SECRET` is required against Postgres. Demo seeding only runs on H2.
- Fixes: settle direction (`payerId` honoured), settlements no longer duplicated as expenses and
  can be undone, invited placeholder accounts can be claimed, expenses must be in the group
  currency (the original amount is kept), receipts in their own table, aggregate balance queries,
  Neon-friendly pool (`minimumIdle=0`).
- New: activity feed, remove/leave/promote members, invite-code reset, profile + UPI ID,
  password change, notes, `/api/v1/health/ready`.

### Frontend (committed as WIP: typecheck, lint, 20/20 Vitest tests and build pass)
- React Router (`/`, `/groups/:id`, `/join/:code`, legacy `/?join=` redirect), TanStack Query,
  live socket that invalidates queries, Android back button (`@capacitor/app`).
- Components split up: `src/components/{ui,layout,group,modals}`, `src/pages`, `src/lib`, `src/hooks`.
- Accessible Modal, toasts, confirm dialog (no more `alert`/`confirm`). Light/dark/system theme
  via CSS tokens in `src/index.css`.
- `vite-plugin-pwa` replaces the broken hand-written service worker, with an update prompt.
- Per-currency dashboard totals, `Intl` money formatting, foreign-currency conversion
  (Frankfurter API with a manual rate), UPI pay links, CSV export, group settings and member
  management UI.
- Two-user browser E2E confirmed: login, group page, quick entry, and **live sync between users**.

## Next steps

1. **Settle-from-debt E2E check.** In a two-user browser test, Bob's page received a live update,
   then he clicked a debt's “Settle” button. The settle modal opened with an **empty amount**
   (`repayment` looked null). Opened without a prior live update, the same flow prefills
   correctly (₹900). Find out whether the test clicked the wrong button or whether there is a
   real state/race bug in `GroupPage.tsx` → `BalancesPanel` → `SettleUpModal`
   (keyed by from-to ids). Then finish the E2E flow: settle → “All settled up” → undo → settings
   → deep-link reload → light theme screenshots.
2. **Deployment (plan Phase E):**
   - `render.yaml`: use Neon `DATABASE_URL` (`sync: false`) instead of the Render DB, which is
     deleted after 30 days. Keep `JWT_SECRET` generated.
   - `backend/Dockerfile`: Spring Boot CDS training run (it works offline because the app
     falls back to H2), SerialGC, `-XX:TieredStopAtLevel=1`, for Render 0.1 CPU / 512 MB.
   - GitHub Actions: CI (backend `mvn verify`; frontend lint/test/build), APK build + GitHub
     Release on `v*` tags (set `VITE_API_URL` at build time), optional keep-warm ping of
     `/api/v1/health`, which does not touch the DB so Neon can still sleep.
   - Remove the committed `SettleHub.apk` once the release workflow exists.
3. **Docs:** rewrite README for 3.0 (features, $0 deployment table, new env vars
   `JWT_SECRET`, `APP_CORS_ALLOWED_ORIGINS`, `APP_SEED_DEMO_DATA`, `APP_AUTH_RATE_LIMIT`,
   `APP_RECEIPT_MAX_CHARS`), update `docs/deployment.md`, add 2.0 → 3.0 upgrade notes (section 5
   of the plan). Update the plan checkboxes to match reality.
4. `npx cap sync android` and a device smoke test of the APK.

## Gotchas
- Frankfurter (`api.frankfurter.dev`) could not be reached from the cloud sandbox, so the FX
  fetch is untested live. The UI falls back to a manually entered rate.
- Demo quick-fill buttons in the sign-in modal only appear in `npm run dev`.
- When killing processes, don't `pkill -f` a pattern that also appears in your own shell command.
