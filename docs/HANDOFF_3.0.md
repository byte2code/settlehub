# SettleHub 3.0 — Handoff Notes

Work in progress on branch **`ccr-10df20d2-y17nyo`**. The full plan and audit is in
[`docs/settlehub_3.0_plan.md`](settlehub_3.0_plan.md). Its checkboxes describe the target; this
file says what is actually done and verified.

## Get it locally

```bash
cd antigravity-ide/settlehub
git fetch origin
git checkout ccr-10df20d2-y17nyo
```

Requirements: Java 21, Maven 3.9+, Node 22+.

```bash
# Backend: in-memory H2 + demo users alice@/bob@settlehub.com (password: password123)
cd backend && mvn test
mvn spring-boot:run -Dspring-boot.run.jvmArguments=-Dapp.database-url.enabled=false   # http://localhost:8080

# Frontend: proxies /api and /ws to :8080
cd frontend && npm ci && npm test && npm run dev        # http://localhost:3000
```

The `-Dapp.database-url.enabled=false` flag matters if you have a `.env.local` with a Neon
`DATABASE_URL` (see Gotchas).

## Done

### Backend (40/40 tests passing, locally and in the cloud sandbox)
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
- Tests are pinned to H2 (`app.database-url.enabled=false` in the surefire config), so a
  developer's `.env.local` can no longer point `mvn test` at a real database.

### Frontend (typecheck, lint, 20/20 Vitest tests and build pass)
- React Router (`/`, `/groups/:id`, `/join/:code`, legacy `/?join=` redirect), TanStack Query,
  live socket that invalidates queries, Android back button (`@capacitor/app`, now registered in
  the Android project by `cap sync`).
- Components split up: `src/components/{ui,layout,group,modals}`, `src/pages`, `src/lib`, `src/hooks`.
- Accessible Modal, toasts, confirm dialog (no more `alert`/`confirm`). Light/dark/system theme
  via CSS tokens in `src/index.css`.
- `vite-plugin-pwa` replaces the broken hand-written service worker, with an update prompt.
- Per-currency dashboard totals, `Intl` money formatting, foreign-currency conversion
  (Frankfurter API with a manual rate; live fetch verified from a browser), UPI pay links,
  CSV export, group settings and member management UI.
- **Browser E2E verified**: login, group page, quick entry, live sync between users, settle from a
  debt after a live update (prefills correctly), "All settled up", undo payment, settings dialog,
  deep-link reload (`/groups/:id?tab=stats`), light/dark theme.
  The earlier "empty settle amount" report was the test clicking the header's **Settle up**
  button (blank by design), not the debt's **Settle** button. No bug.

### Deployment & delivery (plan Phase E)
- `render.yaml`: Neon `DATABASE_URL` (`sync: false`) instead of the 30-day Render DB;
  `JWT_SECRET` generated.
- `backend/Dockerfile`: jar extracted + CDS training run at build time, SerialGC,
  `TieredStopAtLevel=1`. The extract/training/`-Xshare:on` steps were run with a local JVM;
  **the Docker image itself has not been built** (no Docker on the dev machine).
- `.github/workflows/ci.yml` (backend `mvn verify`; frontend lint/test/build),
  `release-apk.yml` (APK + GitHub Release on `v*` tags, version from the tag, optional release
  signing from `ANDROID_KEYSTORE_*` secrets, falls back to debug signing),
  `keep-warm.yml` (opt-in via `SETTLEHUB_BACKEND_URL`). **Not yet run on GitHub.**
- Committed `SettleHub.apk` removed; 2.0's APK stays available on the v2.0.0 release.
- The APK build was checked locally: version name/code come from Gradle properties and the API
  URL is baked in.

### Docs
- README rewritten for 3.0 (features, $0 table, env vars, workflow variables/secrets, upgrade
  notes, API reference). `docs/deployment.md` rewritten (Neon, Render→Neon data move, signing
  key, keep-warm caveats, verification checklist). Plan has a status note.

## Next steps

1. Push, open a PR, and check that **CI** passes on GitHub.
2. Build the backend image on Render (or anywhere with Docker) and compare cold-start time with 2.0.
3. Set `SETTLEHUB_API_URL` (and ideally the `ANDROID_KEYSTORE_*` secrets), push `v3.0.0`, and
   smoke-test the released APK on a device (sign in, live update, back button, UPI link).
4. If production still uses Render's free Postgres from 2.0, move the data to Neon before it
   expires (`docs/deployment.md` §1).

## Gotchas
- A `.env.local` / `.env` in `backend/` or the repo root with `DATABASE_URL` is picked up by
  `mvn spring-boot:run`, which then needs `JWT_SECRET`. Use the flag above for H2, and a Neon
  branch rather than production for Postgres testing.
- Demo quick-fill buttons in the sign-in modal only appear in `npm run dev`.
- Each own action triggers a second refetch when its socket echo arrives (harmless, small
  extra load).
- A settle dialog that is already open keeps its prefilled amount if a live update changes the
  debt meanwhile.
- When killing processes, don't `pkill -f` a pattern that also appears in your own shell command.
