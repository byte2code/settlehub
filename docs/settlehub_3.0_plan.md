# SettleHub 3.0 — Audit & Improvement Plan

> **Hard constraint:** the full stack must deploy and run end to end at **$0/month**.
> Every item below was chosen to stay inside free tiers (Render Free, Neon Free,
> Cloudflare Pages Free, GitHub Actions on a public repo) and adds no paid SaaS.

---

## 1. Audit of 2.0 — what was found

The 2.0 code base works on the happy path but has several problems that matter for a
real multi-user deployment. They are grouped by severity.

### 1.1 Critical (security)

| # | Finding | Where | Impact |
|---|---|---|---|
| C1 | **No authorization on any group resource.** Every endpoint loads a group/expense/settlement by UUID without checking that the caller is a member. | `GroupService`, `ExpenseService`, `BalanceService`, `SettlementController`, `ExportController` | Any signed-in user can read, edit or delete any other group's data if they learn its id (IDOR). `GET /settlements/groups/{id}` does not even take the principal. |
| C2 | **WebSocket topics are unauthenticated.** `/ws/**` is `permitAll` and STOMP `SUBSCRIBE` is never checked. | `SecurityConfig`, `WebSocketConfig` | Anyone can subscribe to `/topic/groups/{id}` and receive every expense, including receipt images. |
| C3 | **Hard-coded JWT signing secret** is the fallback in `application.properties` and `JwtTokenProvider`. The repo is public. | `application.properties`, `JwtTokenProvider` | Any deployment that forgets `JWT_SECRET` accepts forged tokens for any user. |
| C4 | **Demo users (`alice@`/`bob@` / `password123`) are seeded into any empty database**, including a fresh production Neon DB. | `DataInitializer` | Known credentials in production. |
| C5 | `GET /groups/invite/{code}` **joins** the caller to the group as a side effect of a GET. | `GroupController` | Link prefetchers / crawlers can add members. |
| C6 | No rate limiting on `/auth/login` and `/auth/register`; 6-char minimum password. | `AuthController`, `RegisterRequest` | Credential stuffing / brute force. |
| C7 | CORS configured three times (`SecurityConfig`, `WebConfig` x2, every `@CrossOrigin`) with `*` + `allowCredentials=true`. | config | Hard to reason about; overly permissive. |

### 1.2 High (functional bugs users will hit)

| # | Finding | Where |
|---|---|---|
| H1 | **"Settle" records the payment in the wrong direction.** The UI sends `payerId`, but the backend always uses the *caller* as payer. When Alice taps *Settle* on "Bob owes Alice", the server records *Alice paid Bob*, doubling the debt. | `SettlementService.recordSettlement` |
| H2 | **Invited members can never sign up.** Adding someone by email creates a placeholder user with an empty password; when that person registers, they get "Email is already registered". | `GroupService.createGroup/addMemberByEmail`, `AuthService.register` |
| H3 | **Wrong password returns HTTP 500**, not 401 (`BadCredentialsException` falls into the generic `Exception` handler, which also leaks internal messages). | `GlobalExceptionHandler` |
| H4 | **Settlements are written twice** — a `Settlement` row and a `PAYMENT` expense. Deleting the payment from the feed soft-deletes the expense but leaves the settlement, so the balance does not change. There is no way to undo a settlement. | `SettlementService`, `GroupDetail.tsx` |
| H5 | **Mixed-currency math.** An expense can be entered in USD inside an INR group; balances add the raw minor units together. The dashboard also sums balances from groups in different currencies and formats the total in the navbar currency. | `ExpenseService`, `BalanceService`, `Dashboard.tsx` |
| H6 | **Stale Settle-Up form.** `SettleUpModal` seeds `useState` from props once; the modal stays mounted, so picking a second debt shows the first debt's values. | `SettleUpModal.tsx` |
| H7 | **The service worker serves `index.html` cache-first under a fixed cache name**, so installed PWAs never pick up new deployments. | `public/sw.js` |
| H8 | No routing: browser/Android back button leaves the app, groups can't be deep-linked or refreshed. | `App.tsx` |

### 1.3 Medium (performance, cost and maintainability)

| # | Finding |
|---|---|
| M1 | Schema managed by `ddl-auto=update` — no migrations, no rollback story, silent drift. |
| M2 | Receipt images are base64 `TEXT` on the `expenses` row and are returned **in every expense list response** and every WebSocket event. This burns Neon egress/storage and makes the group screen slow. |
| M3 | N+1 queries: `getUserGroups` recomputes balances group by group with lazy loading of members, payers and splits. |
| M4 | HikariCP `minimumIdle=2` keeps connections open forever, so **Neon can never scale to zero** and the free compute allowance is consumed 24/7. |
| M5 | Two parallel `DATABASE_URL` parsers (an `EnvironmentPostProcessor` *and* a `DataSource` bean) plus three `.env` scanners. |
| M6 | Spring Boot 3.3.4 is out of support. |
| M7 | Frontend: 950-line `GroupDetail`, 800-line `AddExpenseModal`, `alert()/confirm()` everywhere, no data cache (every WS event refetches 4 endpoints), dead Vite template files, no tests. |
| M8 | A 4 MB `SettleHub.apk` is committed to git; there is no CI at all. |
| M9 | `render.yaml` provisions a Render free Postgres, which Render deletes after 30 days — while the docs say Neon is the database. |

---

## 2. 3.0 goals

1. **Safe for real groups** — every resource is scoped to its members, over REST and WebSocket.
2. **Correct money** — balances are always single-currency per group, settlements go the right way and can be undone.
3. **Cheap to run, fast to wake** — fits Render/Neon free tiers with headroom, Neon is allowed to sleep, cold starts are shorter.
4. **Maintainable** — current framework versions, migrations, CI, tests on both sides.
5. **Nicer to use** — routing, caching, an activity feed, member management, profile, UPI pay links.

---

## 3. Work plan

### Phase A — Foundation (backend)

- [x] Spring Boot **3.3.4 → 4.1**, Java 21 LTS.
- [x] **Flyway** migrations. `V1` reproduces the 2.0 schema exactly and is *baselined* on existing databases, so a 2.0 Neon DB upgrades in place. `ddl-auto=validate`.
- [x] One `DATABASE_URL` parser; delete the duplicate post-processor and `.env` scanners.
- [x] Neon-friendly pool: `minimumIdle=0`, short idle timeout, small max pool → Neon scales to zero between uses.
- [x] One CORS configuration, origins configurable through `APP_CORS_ALLOWED_ORIGINS`; bearer tokens only (no credentials).
- [x] `JWT_SECRET` required whenever a real database is configured (fail fast); dev default only for local H2.
- [x] Demo data seeded only when `APP_SEED_DEMO_DATA=true` (default on for local H2, off otherwise).

### Phase B — Security & correctness (backend)

- [x] `GroupAccessService`: every group/expense/settlement/export/balance call checks membership; admin-only actions check role. Non-members get **404** (no existence leak).
- [x] STOMP `CONNECT` requires a JWT (`Authorization` header); `SUBSCRIBE` to `/topic/groups/{id}` requires membership.
- [x] Proper HTTP codes: 401 bad credentials, 403 forbidden, 404 not found, 409 conflict; no internal messages on 500.
- [x] In-memory rate limiter on auth endpoints (no Redis needed on one instance).
- [x] Password minimum 8; register **claims** an invited placeholder account.
- [x] Settlement honours `payerId` (caller must be payer or payee); settlements are no longer duplicated as expenses; settlements can be deleted (undo). Legacy `PAYMENT` expenses are hidden from feeds.
- [x] Invite code `GET` is a side-effect-free preview; joining is `POST` only.
- [x] Receipts move to their own `expense_receipts` table, served lazily from `GET /expenses/{id}/receipt`; size cap. Lists and WS events carry only `hasReceipt`.
- [x] Single currency per group: an expense in another currency must carry the converted amount; original amount/currency are kept for display.
- [x] Batch fetching to remove N+1 queries.

### Phase C — Features (backend + frontend)

- [x] **Activity feed** per group (who added/edited/deleted what, settlements, joins).
- [x] **Member management:** admin can remove members (only with zero balance), promote/demote admins; any member can leave with zero balance.
- [x] **Profile:** edit name, default currency, UPI ID; change password.
- [x] **UPI pay links** in Settle Up when the payee has a UPI ID (India-first, free, no gateway).
- [x] **Group settings** dialog: name, type, budget, simplify, archive, delete (admin).
- [x] **Currency conversion helper** using the free, keyless Frankfurter API (ECB rates), with manual override.
- [x] Expense **notes** field; CSV export (client-side) next to Excel.

### Phase D — Frontend architecture & UX

- [x] React Router with deep links (`/groups/:id`, `/join/:code`) and Android hardware back button.
- [x] TanStack Query cache; WebSocket events invalidate only affected queries.
- [x] Break up `GroupDetail`/`AddExpenseModal`; shared accessible `Modal` (Esc, focus, aria), toasts and confirm dialog instead of `alert/confirm`.
- [x] Correct money formatting with `Intl.NumberFormat` (JPY has 0 decimals); per-currency dashboard totals.
- [x] Light/dark theme toggle.
- [x] PWA rebuilt on `vite-plugin-pwa` (Workbox) with network-first navigation and an update prompt.
- [x] Lazy-loaded modals for a smaller first load.
- [x] Vitest unit tests for money math, the quick-entry parser and split validation.

### Phase E — Free deployment & delivery

- [x] Docker image with **Spring Boot CDS** training run + SerialGC tuned for 0.1 vCPU / 512 MB → faster Render cold starts.
- [x] `render.yaml` uses **Neon** (`DATABASE_URL` as a secret), not the 30-day Render DB.
- [x] GitHub Actions: CI (backend tests, frontend lint/test/build), **APK build + GitHub Release on tag** (APK no longer committed), optional keep-warm ping that does *not* touch the DB.
- [x] Readiness endpoint `/api/v1/health/ready` (checks DB) separate from liveness `/api/v1/health` (no DB, so pings don't wake Neon).
- [x] Updated README, deployment runbook and 2.0 → 3.0 upgrade notes.

### Later (not in 3.0)

- Recurring expenses (would need a scheduler that survives Render sleep — use a GitHub Actions cron calling an endpoint).
- Email invites / password reset via a free transactional provider (Brevo 300/day or Resend 3k/month) — needs a user-owned API key.
- Web push notifications (free with VAPID, but needs subscription storage and a sender).
- Expense comments, itemised bill splitting, OCR of receipts in the browser (Tesseract.js).
- Offline expense queue with background sync.

---

## 4. Free-tier budget

| Piece | Service | Free allowance | 3.0 usage pattern |
|---|---|---|---|
| Backend | Render Web Service (Free) | 512 MB RAM, 0.1 CPU, 750 h/month, sleeps after 15 min idle | One instance; CDS + SerialGC to wake faster; optional keep-warm ping fits inside 750 h |
| Database | Neon (Free) | 0.5 GB storage per project, scale-to-zero | Pool lets Neon sleep; receipts capped and stored out of the hot table |
| Frontend | Cloudflare Pages (Free) | Unlimited static bandwidth, 500 builds/month | Static SPA + PWA |
| CI / APK | GitHub Actions | Free for public repos | Tests on push/PR; APK on tags |
| FX rates | Frankfurter | Free, no key | Client-side only, on demand |
| Payments | UPI deep links | Free | `upi://pay` intent, no gateway |

**Total: $0/month.**

---

## 5. Upgrade notes (2.0 → 3.0)

1. Set `JWT_SECRET` (64+ random chars) on the backend. The service refuses to start against Postgres without it.
2. Point `DATABASE_URL` at Neon. On first start Flyway baselines the existing 2.0 schema as version 1 and applies the 3.0 migrations (receipts move to a new table; nothing is deleted).
3. If the frontend lives on a custom domain, add it to `APP_CORS_ALLOWED_ORIGINS` (defaults allow `*.pages.dev`, localhost and the Capacitor app).
4. Existing tokens remain valid if `JWT_SECRET` is unchanged.
5. Old `PAYMENT` expenses created by 2.0 settlements stay in the database for history but are hidden from the expense feed; the settlement history remains the source of truth.
