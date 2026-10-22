# SettleHub 3.0 — Architecture & Workflows

How the pieces fit together, and what happens behind each screen. Every diagram is drawn from
the code on `main`; file names are given so you can follow along.

- [1. System overview](#1-system-overview)
- [2. Backend request pipeline](#2-backend-request-pipeline)
- [3. Data model](#3-data-model)
- [4. From expense to “who owes whom”](#4-from-expense-to-who-owes-whom)
- [5. Live updates between members](#5-live-updates-between-members)
- [6. Settle up, UPI and undo](#6-settle-up-upi-and-undo)
- [7. Invites, joining and claiming an account](#7-invites-joining-and-claiming-an-account)
- [8. Foreign-currency expenses](#8-foreign-currency-expenses)
- [9. Receipts](#9-receipts)
- [10. Frontend structure](#10-frontend-structure)
- [11. Waking the free backend](#11-waking-the-free-backend)
- [12. Upgrading a 2.0 database](#12-upgrading-a-20-database)
- [13. Build, test and release pipeline](#13-build-test-and-release-pipeline)
- [14. Backend Docker image](#14-backend-docker-image)
- [15. Activity feed events](#15-activity-feed-events)

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Users
        WEB["Browser / PWA"]
        APK["Android app<br/>(Capacitor WebView)"]
    end

    subgraph HOST["Free hosting"]
        CF["Cloudflare Pages<br/>React SPA + service worker"]
        RENDER["Render free web service<br/>Spring Boot 4.1 · Java 21"]
        NEON[("Neon PostgreSQL<br/>scale-to-zero")]
    end

    subgraph GitHub
        GHA["Actions<br/>CI · APK release · keep-warm"]
        REL["Releases<br/>SettleHub.apk"]
    end

    FX["Frankfurter<br/>ECB exchange rates"]
    UPI["UPI apps<br/>GPay · PhonePe · Paytm"]

    WEB -->|loads app| CF
    WEB -->|REST /api/v1 + WebSocket /ws| RENDER
    APK -->|REST /api/v1 + WebSocket /ws| RENDER
    RENDER -->|JDBC, TLS| NEON
    WEB -.->|rates, browser only| FX
    APK -.->|rates| FX
    WEB -.->|upi://pay link| UPI
    APK -.->|upi://pay intent| UPI
    GHA -->|builds| REL
    REL -->|download| APK
    GHA -.->|"optional ping /api/v1/health"| RENDER
```

Nothing in this picture costs money: see the [free-tier budget](settlehub_3.0_plan.md#4-free-tier-budget).

---

## 2. Backend request pipeline

Every REST call passes the same checks. A group you are not in looks exactly like a group that
does not exist (404), so ids can't be probed.

```mermaid
flowchart TD
    REQ["HTTP request"] --> RL{"Auth endpoint?<br/>AuthRateLimitFilter"}
    RL -->|"over 10/min"| R429["429 Too Many Requests"]
    RL -->|ok| JWT{"Bearer token valid?<br/>JwtAuthenticationFilter"}
    JWT -->|"no, protected route"| R401["401 Unauthorized"]
    JWT -->|yes| CTRL["Controller<br/>validates the body"]
    CTRL -->|invalid| R400["400 with field errors"]
    CTRL --> ACCESS{"Member of the group?<br/>GroupAccessService"}
    ACCESS -->|no| R404["404 Not found"]
    ACCESS -->|"yes, but admin-only action"| ROLE{"Admin?"}
    ROLE -->|no| R403["403 Forbidden"]
    ROLE -->|yes| SVC
    ACCESS -->|yes| SVC["Service<br/>Group · Expense · Settlement · Balance · Export"]
    SVC --> DB[("PostgreSQL / H2")]
    SVC --> ACT["ActivityService<br/>writes the activity feed"]
    SVC --> PUB["WebSocketEventPublisher<br/>queued until commit"]
    DB --> COMMIT(("commit"))
    COMMIT --> PUB2["STOMP /topic/groups/{id}"]
```

| Code | When |
| --- | --- |
| 400 | Validation failed (amounts don't add up, password too short, bad UPI ID) |
| 401 | No/expired token, or wrong email/password |
| 403 | Signed in and a member, but the action needs an admin (or the payer/payee for undo) |
| 404 | Not a member, or the thing doesn't exist |
| 409 | Conflict, e.g. email already registered, leaving a group while you still owe money |
| 429 | More than `APP_AUTH_RATE_LIMIT` sign-in/sign-up attempts a minute |

---

## 3. Data model

Flyway owns the schema: `V1__baseline_2_0_schema.sql` (2.0, unchanged) and `V2__settlehub_3_0.sql`.

```mermaid
erDiagram
    users ||--o{ group_members : "belongs to"
    expense_groups ||--o{ group_members : has
    expense_groups ||--o{ expenses : contains
    expense_groups ||--o{ settlements : records
    expense_groups ||--o{ activities : logs
    expenses ||--o{ expense_payers : "paid by"
    expenses ||--o{ expense_splits : "owed by"
    expenses ||--o| expense_receipts : "photo (3.0)"
    users ||--o{ expense_payers : pays
    users ||--o{ expense_splits : owes
    users ||--o{ settlements : "pays / receives"

    users {
        UUID id PK
        string email UK
        string password "BCrypt"
        string first_name
        string currency_code
        boolean placeholder "3.0: added by email, not signed up yet"
        string upi_id "3.0"
    }
    expense_groups {
        UUID id PK
        string name
        string group_type "trip, home, couple, other"
        string currency_code
        string invite_code
        boolean simplify_by_default
        boolean archived
        bigint budget_cents
    }
    group_members {
        UUID id PK
        UUID group_id FK
        UUID user_id FK
        string role "ADMIN or MEMBER"
    }
    expenses {
        UUID id PK
        UUID group_id FK
        string description
        bigint cost_cents "group currency"
        string creation_method "EQUAL, EXACT, PERCENT"
        string category
        string notes "3.0"
        string original_currency "3.0"
        bigint original_amount_cents "3.0"
        boolean has_receipt "3.0"
        boolean is_payment "2.0 legacy, hidden"
        timestamp deleted_at
    }
    expense_payers {
        UUID expense_id FK
        UUID user_id FK
        bigint paid_cents
    }
    expense_splits {
        UUID expense_id FK
        UUID user_id FK
        bigint owed_cents
    }
    expense_receipts {
        UUID expense_id PK "3.0"
        text data_url "compressed JPEG"
    }
    settlements {
        UUID id PK
        UUID group_id FK
        UUID payer_id FK
        UUID payee_id FK
        bigint amount_cents
        string note "3.0"
        UUID created_by_id "3.0"
    }
    activities {
        UUID id PK "3.0"
        UUID group_id FK
        UUID actor_id FK
        string type
        string summary
        bigint amount_cents
    }
```

All money is stored as whole cents (`BIGINT`), never floating point.

---

## 4. From expense to “who owes whom”

```mermaid
flowchart TD
    FORM["Expense form<br/>or quick entry: “Dinner 1500 paid by Alice”"] --> CUR{"In the group currency?"}
    CUR -->|no| FX["Convert at live or typed rate<br/>keep original amount"]
    CUR -->|yes| SPLIT
    FX --> SPLIT{"Split method"}
    SPLIT -->|EQUAL| EQ["EqualSplitStrategy<br/>base = C div N, first C mod N get +1 cent"]
    SPLIT -->|EXACT| EX["ExactSplitStrategy<br/>amounts must add up to C"]
    SPLIT -->|PERCENT| PC["PercentageSplitStrategy<br/>rounded, remainder cents assigned"]
    EQ & EX & PC --> SAVE[("expense + payers + splits")]
    SAVE --> NET["BalanceService: net per member<br/>= paid − owed + payments sent − payments received<br/>(4 SUM queries, not N+1)"]
    NET --> PAIR["Direct debts<br/>who owes whom per expense"]
    NET --> SIMP["DebtSimplificationService<br/>max-heap of creditors × max-heap of debtors"]
    PAIR --> UI{"Group setting: Simplify"}
    SIMP --> UI
    UI -->|off| SHOW1["Balances card: direct debts"]
    UI -->|on| SHOW2["Balances card: at most N−1 payments<br/>“k fewer payments” badge"]
```

Splits always add up to the exact total: ₹999 split three ways by 33.33% each is stored as
333.00 + 333.00 + 333.00, not 332.97 × 3.

---

## 5. Live updates between members

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice's app
    participant API as Spring Boot
    participant DB as PostgreSQL
    participant BR as STOMP broker
    participant B as Bob's app

    B->>BR: CONNECT /ws with Authorization: Bearer JWT
    BR-->>B: CONNECTED (WebSocketAuthInterceptor checked the token)
    B->>BR: SUBSCRIBE /topic/groups/{id}
    Note over BR: refused unless Bob is a member
    A->>API: POST /groups/{id}/expenses
    API->>DB: insert expense, splits, activity
    DB-->>API: commit
    API->>BR: EXPENSE_CREATED {groupId, actorId, entityId}
    Note over API,BR: sent only after commit, so nobody refetches stale data
    BR-->>B: event
    B->>B: invalidate TanStack Query keys ["group", id, ...]
    B->>API: GET group, expenses, balances, settlements
    API-->>B: fresh data, screen updates without a refresh
```

Events: `EXPENSE_CREATED/UPDATED/DELETED`, `SETTLEMENT_RECORDED/DELETED`, `GROUP_UPDATED`,
`GROUP_DELETED`, `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_UPDATED`. On `GROUP_DELETED`, or
`MEMBER_LEFT` about yourself, the app returns to the dashboard with a notice. The header chip
shows **live** while the socket is connected; it reconnects every 5 s after a drop.

---

## 6. Settle up, UPI and undo

```mermaid
sequenceDiagram
    autonumber
    actor Bob
    participant App as SettleHub app
    participant UPI as UPI app
    participant API as Backend

    Bob->>App: taps “Settle” on “You owe Priya ₹239.28”
    App-->>Bob: form prefilled: Bob → Priya, ₹239.28
    alt group in INR and Priya saved a UPI ID
        App-->>Bob: “Pay ₹239.28 to Priya via UPI”
        Bob->>UPI: upi://pay?pa=priya@okicici&am=239.28&cu=INR
        UPI-->>Bob: payment done
    end
    Bob->>App: Record payment (optional note)
    App->>API: POST /settlements {payerId, payeeId, amountCents, note}
    API-->>App: 201, SETTLEMENT_RECORDED to everyone
    App-->>Bob: debt gone, or “All settled up”
    opt mistake
        Bob->>App: Payments tab → Undo payment → confirm
        App->>API: DELETE /settlements/{id}
        Note over API: allowed for the payer, the payee or a group admin
        API-->>App: 200, SETTLEMENT_DELETED, debt is back
    end
```

The header's **Settle up** button opens the same form empty, for payments that don't match a
suggested debt.

---

## 7. Invites, joining and claiming an account

```mermaid
flowchart TD
    subgraph Admin
        CREATE["Create group"] --> HOW{"How to invite?"}
        HOW -->|"by email"| EMAIL["POST /groups/{id}/members"]
        HOW -->|"code / link"| LINK["Share code ABC123<br/>or /join/ABC123"]
        RESET["Reset invite code"] -.->|old link stops working| LINK
    end

    EMAIL --> EXISTS{"Account exists?"}
    EXISTS -->|yes| MEMBER["Added as member"]
    EXISTS -->|no| PH["Placeholder user created<br/>expenses can include them right away"]

    LINK --> OPEN["Friend opens /join/ABC123"]
    OPEN --> SIGNED{"Signed in?"}
    SIGNED -->|no| AUTH["Sign in / sign up"]
    SIGNED -->|yes| PREVIEW
    AUTH --> PREVIEW["GET /groups/invite/ABC123<br/>preview: name, members, currency"]
    PREVIEW --> JOIN["POST /groups/join"] --> MEMBER

    PH --> REG["Friend signs up with that email"]
    REG --> CLAIM["AuthService claims the placeholder:<br/>same user id, balances kept"]
    CLAIM --> MEMBER
```

Inside the Android app, invite links use `VITE_PUBLIC_WEB_URL` (the website), because the app's
own address is `https://localhost`. Without it, only the code is shared.

---

## 8. Foreign-currency expenses

```mermaid
sequenceDiagram
    actor U as You
    participant F as Expense form
    participant FX as Frankfurter API
    participant API as Backend

    U->>F: amount 12, currency USD (group is INR)
    F->>FX: GET /v1/latest?base=USD&symbols=INR
    alt rate available
        FX-->>F: 94.82
    else offline or blocked
        F-->>U: type the rate yourself
    end
    F-->>U: ₹1,137.84 · ₹379.28 each
    U->>F: Add
    F->>API: costCents 113784 (INR), originalCurrency USD, originalAmountCents 1200
    API-->>F: saved, list shows “$12.00 · ₹1,137.84”
```

Rates are fetched by the browser only, so the backend has no third-party dependency.

---

## 9. Receipts

```mermaid
flowchart LR
    PICK["Pick or snap a photo"] --> SHRINK["Canvas resize ≤ 1000 px<br/>JPEG ~50–150 KB"]
    SHRINK --> SEND["Sent with the expense<br/>as a data URL"]
    SEND --> CAP{"≤ APP_RECEIPT_MAX_CHARS?"}
    CAP -->|no| REJ["400: receipt too large"]
    CAP -->|yes| TBL[("expense_receipts<br/>separate table")]
    TBL --> FLAG["expenses.has_receipt = true<br/>lists stay small"]
    VIEW["Tap Receipt"] --> GET["GET /expenses/{id}/receipt<br/>cached forever in the app"]
    TBL --> GET
```

---

## 10. Frontend structure

```mermaid
flowchart TD
    MAIN["main.tsx<br/>QueryClient · Router · Theme · Toasts"] --> APP["App.tsx routes"]
    APP --> L["/ Landing (signed out)"]
    APP --> D["/ Dashboard<br/>per-currency totals, active / archived"]
    APP --> G["/groups/:id GroupPage"]
    APP --> J["/join/:code JoinPage"]
    APP -.->|"legacy /?join=CODE"| J

    G --> BAL["BalancesPanel"]
    G --> TABS["Tabs: Expenses · Payments · Stats · Activity<br/>?tab= in the URL"]
    G --> MODALS["Lazy modals: Expense · Settle · Invite<br/>Export · Settings · Receipt"]

    subgraph Data
        Q["hooks/queries.ts<br/>TanStack Query cache"]
        WS["useGroupSocket<br/>STOMP client"]
        API["lib/api.ts<br/>fetch + JWT, 401 → sign out"]
    end
    G --> Q
    G --> WS
    WS -->|"invalidate ['group', id]"| Q
    Q --> API

    subgraph Platform
        SW["vite-plugin-pwa service worker<br/>precached shell, API never cached,<br/>“update available” prompt"]
        BACK["useNativeBackButton<br/>Android back = navigate back"]
        WAKE["useBackendWake<br/>“waking the server” banner"]
    end
```

---

## 11. Waking the free backend

Render's free plan stops the backend after 15 idle minutes. The app makes the wait visible
instead of failing.

```mermaid
sequenceDiagram
    participant App
    participant R as Render
    participant JVM as Spring Boot
    participant N as Neon

    App->>R: GET /api/v1/health (4 s timeout)
    R-->>App: no answer yet (service asleep)
    App-->>App: banner “Waking up the server…”, retry every 3 s
    R->>JVM: start container
    Note over JVM: CDS archive + SerialGC + C1 shorten start-up
    JVM-->>R: listening
    App->>R: GET /api/v1/health
    R-->>App: 200 UP (no database touched)
    App->>R: real request, e.g. GET /groups
    R->>N: first query wakes Neon (a few seconds)
    N-->>App: data
```

`/api/v1/health` never touches the database, so health checks and the optional keep-warm ping
don't keep Neon awake. `/api/v1/health/ready` does check it.

---

## 12. Upgrading a 2.0 database

```mermaid
flowchart TD
    START["3.0 backend starts with DATABASE_URL"] --> SECRET{"JWT_SECRET set<br/>(and not 2.0's public one)?"}
    SECRET -->|no| STOP["Refuses to start<br/>Render keeps the old version live"]
    SECRET -->|yes| HIST{"flyway_schema_history exists?"}
    HIST -->|"no, tables exist (2.0)"| BASE["Baseline at V1<br/>2.0 schema recorded, untouched"]
    HIST -->|"no, empty database"| V1["Run V1: create 2.0 tables"]
    HIST -->|yes| PENDING
    BASE --> PENDING["Run pending migrations"]
    V1 --> PENDING
    PENDING --> V2["V2: placeholder + UPI columns, notes, original currency,<br/>receipts moved to expense_receipts, activities table,<br/>settlement notes"]
    V2 --> VALID["Hibernate validates the schema<br/>ddl-auto=validate"]
    VALID --> UP["Serving"]
```

Checked against a real 2.0 PostgreSQL database: balances unchanged, receipts moved, 2.0 logins
still valid when the same secret is kept.

---

## 13. Build, test and release pipeline

```mermaid
flowchart LR
    DEV["Developer"] -->|"push / pull request"| CI
    DEV -->|"merge to main"| MAIN["main"]
    DEV -->|"git tag v3.x.y"| TAG["tag"]

    subgraph CI["ci.yml"]
        BE["backend: mvn verify<br/>JUnit + MockMvc on H2"]
        FE["frontend: lint · Vitest · build"]
    end

    MAIN --> CI
    MAIN -->|auto-deploy| RENDER["Render<br/>Docker build → deploy"]
    MAIN -->|auto-deploy| PAGES["Cloudflare Pages<br/>npm run build"]

    TAG --> REL["release-apk.yml"]
    REL --> WEBB["build web app<br/>VITE_API_URL from repo variable"]
    WEBB --> SYNC["npx cap sync android"]
    SYNC --> SIGN{"ANDROID_KEYSTORE_* secrets?"}
    SIGN -->|yes| RSIGN["assembleRelease<br/>signed with your key"]
    SIGN -->|no| DSIGN["assembleDebug<br/>throwaway key"]
    RSIGN & DSIGN --> GHREL["GitHub Release<br/>SettleHub.apk"]

    CRON["every 10 min"] --> KW["keep-warm.yml<br/>only if SETTLEHUB_BACKEND_URL set"]
    KW -.-> RENDER
```

---

## 14. Backend Docker image

```mermaid
flowchart TD
    subgraph S1["Stage 1: build"]
        POM["pom.xml → mvn dependency:go-offline<br/>(cached layer)"] --> PKG["mvn package → settlehub.jar"]
    end
    subgraph S2["Stage 2: runtime"]
        JRE["eclipse-temurin:21-jre-alpine"] --> EXTRACT["java -Djarmode=tools extract<br/>→ application/ + lib/"]
        EXTRACT --> TRAIN["Training run on in-memory H2<br/>-Dspring.context.exit=onRefresh<br/>-XX:ArchiveClassesAtExit=application.jsa"]
        TRAIN --> USER["non-root user settlehub"]
        USER --> RUN["java -XX:SharedArchiveFile=application.jsa<br/>SerialGC · TieredStopAtLevel=1 · MaxRAMPercentage=75"]
    end
    PKG --> EXTRACT
```

---

## 15. Activity feed events

Written by `ActivityService` in the same transaction as the change; shown on the group's
**Activity** tab, newest first.

| Area | Types |
| --- | --- |
| Group | `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_ARCHIVED`, `GROUP_RESTORED` |
| Members | `MEMBER_JOINED`, `MEMBER_ADDED`, `MEMBER_REMOVED`, `MEMBER_LEFT`, `ROLE_CHANGED`, `INVITE_RESET` |
| Expenses | `EXPENSE_CREATED`, `EXPENSE_UPDATED` (shows old → new amount), `EXPENSE_DELETED` |
| Payments | `SETTLEMENT_RECORDED`, `SETTLEMENT_DELETED` |
