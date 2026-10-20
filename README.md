# 💸 SettleHub 2.0 — Full-Stack Real-Time Expense Sharing & Debt Minimization Platform

[![Java](https://img.shields.io/badge/Java-23%20%7C%2021%20LTS-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android%20v8-1192e8.svg)](https://capacitorjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon%20PostgreSQL-Serverless-00e599.svg)](https://neon.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Download Android APK](https://img.shields.io/badge/Download%20APK-v2.0.0%20(4.20%20MB)-10b981?style=for-the-badge&logo=android&logoColor=white)](https://github.com/byte2code/settlehub/releases/download/v2.0.0/SettleHub.apk)
[![GitHub Release](https://img.shields.io/badge/GitHub%20Release-v2.0.0-teal?style=for-the-badge&logo=github)](https://github.com/byte2code/settlehub/releases/tag/v2.0.0)

> **SettleHub 2.0** is an enterprise-grade, cleanroom full-stack reimplementation of the core Splitwise expense-sharing platform, engineered for **zero floating-point rounding errors**, **real-time WebSocket collaboration**, and **optimal settlement graphs**. It is deployed on 100% free-tier cloud infrastructure (Neon Serverless PostgreSQL + Render / Cloudflare Pages) and available as both an installable **PWA (iOS/Android)** and a native **Android APK**.

---

## 📑 Table of Contents

- [🌟 What's New in SettleHub 2.0](#-whats-new-in-settlehub-20)
- [Core Engineering Highlights](#-core-engineering-highlights)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [End-to-End System Flow](#-end-to-end-system-flow)
- [Mathematical Foundation](#-mathematical-foundation)
  - [1. Cent-Precision Fair Division](#1-cent-precision-fair-division-dividefairly)
  - [2. Dual Max-Heap Min-Cash-Flow Solver](#2-dual-max-heap-min-cash-flow-solver)
- [📱 Mobile Apps (Android APK & iOS PWA)](#-mobile-apps-android-apk--ios-pwa)
- [🚀 100% Free Cloud Deployment Guide](#-100-free-cloud-deployment-guide)
  - [Part A: Backend & Neon PostgreSQL on Render](#part-a-backend--neon-postgresql-on-render)
  - [Part B: Frontend on Cloudflare Pages](#part-b-frontend-on-cloudflare-pages)
- [📡 API Reference](#-api-reference)
- [💻 Local Development Guide](#-local-development-guide)
- [🛡️ Security & Production Hardening](#️-security--production-hardening)

---

## 🌟 What's New in SettleHub 2.0

| Feature | Description | Architecture / Free-Tier Implementation |
| :--- | :--- | :--- |
| **⚡ Real-Time WebSockets** | Instant multi-user sync for expenses, edits, and settlements. | Embedded Spring STOMP message broker at `/topic/groups/{groupId}` + `@stomp/stompjs` with auto-reconnect. 0 external SaaS cost. |
| **📲 WhatsApp Summary** | One-tap formatted WhatsApp report with direct `wa.me` deep-links. | Server-side markdown generator with client-side fallback. Displays total spend, per-member balances, and minimized repayments. |
| **📊 Microsoft Excel Export** | Download native `.xlsx` workbooks for group audit. | Apache POI (`poi-ooxml`) generates multi-sheet workbooks (Overview, Balances, Settlements, Transactions) in-memory. |
| **📸 Receipt Photo Uploads** | Attach bills & receipts directly to expenses with lightbox preview. | Client-side HTML5 Canvas compression downscaling to ~50KB JPEG data URLs, stored in PostgreSQL `receipt_url` (`TEXT`). $0 S3 bucket fees. |
| **🤖 AI / Smart Quick Entry** | Type natural language like *"Dinner 1500 paid by Alice"* to auto-fill. | Instant offline NLP regex/keyword parser directly inside the frontend modal with 0ms latency and 0 API token cost. |
| **🎯 Trip Budget Pacing** | Set group target budgets with real-time visual progress pacing. | `budget_cents` field in PostgreSQL with responsive progress meters (Emerald → Amber → Rose if over budget). |
| **🗃️ Trip Archival Lifecycle** | Separate active trips from completed vacations. | `archived` toggle with Active vs. Archived dashboard tabs and 1-click restore. |
| **🐘 Neon Serverless Postgres** | Robust cloud database branching and connection pooling. | HikariCP pool tuned for serverless scale-to-zero, SSL auto-negotiation, and 30-day mobile sessions. |

---

## ⚡ Core Engineering Highlights

- **Cent-Precision Integer Arithmetic:** All transactions, shares, and balances are stored and calculated strictly as 64-bit integer cents (`costCents`, `paidCents`, `owedCents`). Floating-point accumulation drift is mathematically impossible.
- **Dual Max-Heap Debt Minimization:** Implements the $O(N \log N)$ Min-Cash-Flow algorithm, simplifying complex multi-party circular debts into at most $N-1$ linear transactions.
- **Real-Time Push Architecture:** Live WebSocket connection eliminates manual page refreshing when multiple trip members enter expenses simultaneously.
- **Dynamic PaaS Database Auto-Healing:** Custom `DatabaseConfiguration` automatically parses standard `DATABASE_URL` strings (`postgres://...`) provided by cloud providers (Neon, Render, Railway) and injects secure JDBC credentials with `sslmode=require`.
- **Low-Memory Free-Tier Optimization:** Multi-stage Docker container tuned with `-XX:MaxRAMPercentage=75.0` to run safely within Render’s free 512MB RAM limit without OOM kills.
- **Mobile-First Responsive Layout:** Engineered with `viewport-fit=cover`, safe area insets (`env(safe-area-inset-top)`), and zero horizontal scrolling on mobile viewports.
- **In-App Server Configurator:** Built-in modal allows the Android APK to point to any deployed backend without needing recompilation.

---

## 🏗️ Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph Clients["📱 Multi-Platform Clients"]
        APK["Android APK v2.0<br/>(Capacitor 8 / WebView)"]
        PWA["iOS / Mobile Safari<br/>(Progressive Web App)"]
        WEB["Desktop Browser<br/>(Chrome / Safari / Firefox)"]
    end

    subgraph CDN["⚡ Global Edge CDN (Free)"]
        CF["Cloudflare Pages<br/>(Static Edge Assets + SPA Routing)"]
    end

    subgraph Cloud["☁️ Free-Tier Cloud Infrastructure"]
        BE["Spring Boot 3.3.4 (Java 23/21)<br/>REST API • STOMP WebSocket Broker"]
        Engine["Dual Max-Heap Solver<br/>Debt Simplification Engine"]
        POI["Apache POI Engine<br/>Excel .xlsx Generator"]
        DB[("Neon Cloud PostgreSQL<br/>Serverless Database • ACID")]
    end

    PWA -->|Loads Assets| CF
    WEB -->|Loads Assets| CF
    APK -->|REST API & STOMP /ws| BE
    PWA -->|REST API & STOMP /ws| BE
    WEB -->|REST API & STOMP /ws| BE
    BE <--> Engine
    BE <--> POI
    BE <-->|HikariCP Pool / JPA| DB
```

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Backend Runtime** | Java 23 / 21 LTS | High-performance virtual threads, strong typing. |
| **Backend Framework** | Spring Boot 3.3.4 | Spring Security 6, Spring Data JPA, Hibernate ORM, WebSocket STOMP. |
| **Real-Time Messaging**| Spring WebSocket + STOMP | Lightweight in-memory broker, zero external message queue required. |
| **Export Generator** | Apache POI 5.2.5 | Native multi-sheet Microsoft Excel `.xlsx` generation. |
| **Authentication** | Stateless JWT (`jjwt` 0.12.6) | 30-day HMAC-SHA256 tokens with zero session storage overhead. |
| **Database** | Neon Serverless PostgreSQL | High-availability cloud Postgres with SSL, zero-cost scale-to-zero. |
| **Frontend Framework** | React 19 + TypeScript | High-performance React compiler ready, strict type-safety. |
| **Build Tool & Styling** | Vite 8 + Tailwind CSS v4 | Sub-second HMR, instant production builds, mobile utility styling. |
| **Mobile Runtime** | Capacitor 8 | Native Android bridge with hardware back button and safe-area support. |
| **Free Cloud Hosting** | Neon + Render + Cloudflare | 100% free hosting with global CDN, automated CI/CD, and serverless Postgres. |

---

## 📂 Project Directory Structure

```text
settlehub/
├── README.md                           # Main architecture & deployment documentation
├── SettleHub.apk                       # Production-compiled Android standalone APK v2.0 (~4.20 MB)
├── render.yaml                         # 1-Click Render infrastructure blueprint
├── neon.ts                             # Neon PostgreSQL branch configuration
├── .gitignore                          # Comprehensive root gitignore
│
├── backend/                            # Spring Boot 3 Java Service
│   ├── Dockerfile                      # Multi-stage lightweight Alpine build (Temurin JRE 21)
│   ├── pom.xml                         # Maven dependencies (JPA, Security, JJWT, Postgres, POI, WebSocket)
│   └── src/
│       ├── main/
│       │   ├── java/com/settlehub/
│       │   │   ├── SettleHubApplication.java
│       │   │   ├── config/             # SecurityConfig, DatabaseConfiguration, WebSocketConfig, GlobalExceptionHandler
│       │   │   ├── controller/         # Auth, Group, Expense, Balance, Settlement, Export, Health
│       │   │   ├── dto/                # Request & Response DTOs (GroupDto, ExpenseDto, SettlementDto)
│       │   │   ├── engine/             # DebtSimplificationService, SplitStrategy implementations
│       │   │   ├── model/              # User, Group, GroupMember, Expense, ExpenseSplit, Settlement entities
│       │   │   ├── repository/         # Spring Data JPA Repositories
│       │   │   ├── security/           # JwtTokenProvider, JwtAuthenticationFilter, UserPrincipal
│       │   │   └── service/            # GroupService, ExpenseService, BalanceService, ExportService, WebSocketPublisher
│       │   └── resources/
│       │       └── application.properties # ${PORT:8080}, ${DATABASE_URL}, HikariCP settings
│       └── test/java/com/settlehub/    # 11 Unit & Integration tests (mvn test: 100% pass)
│
├── frontend/                           # React 19 + Vite + Tailwind CSS Single Page App
│   ├── package.json
│   ├── vite.config.ts
│   ├── capacitor.config.ts             # Capacitor configuration (App ID: com.settlehub.app)
│   ├── index.html                      # PWA meta tags, safe-area viewport
│   ├── public/
│   │   ├── _redirects                  # Cloudflare Pages SPA rewrite rule (/* /index.html 200)
│   │   ├── manifest.json               # Mobile PWA manifest
│   │   └── sw.js                       # Service Worker for offline asset caching
│   ├── src/
│   │   ├── App.tsx                     # Main router and view orchestrator
│   │   ├── index.css                   # Global Tailwind styles, viewport clamping, safe-area
│   │   ├── components/                 # Dashboard, GroupDetail, AddExpenseModal, ExportSummaryModal, etc.
│   │   ├── services/
│   │   │   ├── api.ts                  # Centralized REST API service
│   │   │   └── websocket.ts            # STOMP WebSocket hook with auto-reconnect
│   │   ├── types/                      # TypeScript domain models and interfaces
│   │   └── utils/                      # Currency formatting & symbols
│   └── android/                        # Capacitor Android Native Studio Project
│       ├── app/src/main/
│       │   ├── AndroidManifest.xml     # Internet & Cleartext permissions
│       │   └── assets/public/          # Synced production web assets
│       └── build.gradle                # Gradle build scripts
│
└── docs/
    ├── settlehub_2.0_architecture_review.md # Full 2.0 Architectural Review & Code Quality Report
    ├── technical_spec.md               # Reverse-engineered GreenDAO schemas & wire protocol
    └── deployment.md                   # Cloud deployment recipes
```

---

## 🔄 End-to-End System Flow

```mermaid
sequenceDiagram
    autonumber
    actor Alice as 👩 Alice (Android APK)
    actor Bob as 👨 Bob (iPhone PWA)
    participant API as 🌐 Spring Boot Backend
    participant WS as ⚡ STOMP WebSocket Broker
    participant Solver as 🧮 Dual Max-Heap Solver
    participant DB as 🐘 Neon PostgreSQL

    Note over Alice,Bob: 1. Live WebSocket Subscription
    Alice->>WS: Connect /ws & Subscribe /topic/groups/{id}
    Bob->>WS: Connect /ws & Subscribe /topic/groups/{id}

    Note over Alice: 2. Record Expense with Receipt Photo
    Alice->>API: POST /api/v1/groups/{id}/expenses (Resort ₹15,000 + Receipt Photo + Tag STAY)
    API->>DB: Save Expense & Base64 compressed receipt URL
    API->>WS: Broadcast EXPENSE_CREATED event
    WS-->>Bob: Live Event -> triggers instant background refresh

    Note over Bob: 3. Real-Time Balance Synchronization
    Bob->>API: GET /api/v1/groups/{id}/balances
    API->>DB: Fetch all group expenses and settlements
    API->>Solver: Compute Net Balances & Min-Cash-Flow debts
    Solver-->>API: Minimized Debt: [Bob owes Alice ₹7,500]
    API-->>Bob: 200 OK (Group Balance Summary)

    Note over Bob: 4. Export & Settlement
    Bob->>API: GET /api/v1/export/groups/{id}/whatsapp
    API-->>Bob: WhatsApp copy text & wa.me deep-link
    Bob->>API: POST /api/v1/settlements (Bob pays Alice ₹7,500)
    API->>DB: Record Settlement in permanent audit log
    API->>WS: Broadcast SETTLEMENT_RECORDED event
    WS-->>Alice: Live Event -> Alice's UI shows "All settled up!"
```

---

## 📐 Mathematical Foundation

### 1. Cent-Precision Fair Division (`divideFairly`)
When splitting an expense of $C$ cents among $N$ participants equally:
$$\text{base} = \lfloor C / N \rfloor, \quad \text{remainder} = C \pmod N$$
The first $\text{remainder}$ participants are assigned $\text{base} + 1$ cents, and the remaining participants are assigned $\text{base}$ cents.
$$\sum_{i=1}^{N} \text{share}_i = \text{remainder} \cdot (\text{base} + 1) + (N - \text{remainder}) \cdot \text{base} = C$$
This guarantees that the sum of splits **always equals the total cost to the exact cent**, eliminating float rounding leakage.

### 2. Dual Max-Heap Min-Cash-Flow Solver
Given $N$ participants with net balances $B_i$ such that $\sum_{i=1}^N B_i = 0$:
1. Participants with $B_i > 0$ are inserted into a **Max-Heap of Creditors**.
2. Participants with $B_i < 0$ are inserted into a **Max-Heap of Debtors** using $|B_i|$.
3. In each iteration, extract the maximum debtor $D$ and maximum creditor $C$.
4. Transact $\min(D.\text{amount}, C.\text{amount})$ from $D$ to $C$.
5. Reinsert any remaining balance back into the respective heap.
6. The algorithm terminates in at most $N-1$ transactions and completely eliminates multi-party circular debts.

---

## 📱 Mobile Apps (Android APK & iOS PWA)

### Android Standalone APK

The native Android package is ready for direct installation on any Android device without requiring Google Play Store:

| Option | Download Link | Notes |
| :--- | :--- | :--- |
| **Direct APK Download** | [📥 **Download SettleHub.apk (v2.0.0)**](https://github.com/byte2code/settlehub/releases/download/v2.0.0/SettleHub.apk) | Hosted on GitHub Releases CDN (~4.20 MB) |
| **Repository File** | [📁 `SettleHub.apk`](./SettleHub.apk?raw=true) | Direct raw download from repository tree |
| **GitHub Release** | [🏷️ **View Release v2.0.0**](https://github.com/byte2code/settlehub/releases/tag/v2.0.0) | Release notes, checksums, and assets |

#### Installation Instructions:
1. Download `SettleHub.apk` via the direct link above on your Android phone.
2. Open the downloaded `.apk` file $\rightarrow$ tap **Install**.
3. If prompted by Android, enable *"Install unknown apps"* for your browser or file manager.
4. Launch **SettleHub** from your home screen.
5. Tap the **Server** icon in the top navbar $\rightarrow$ enter your deployed backend URL $\rightarrow$ tap **Save & Connect**. (Or leave as default for local testing).

### iOS (iPhone & iPad) PWA
Apple restricts sideloading standalone `.ipa` files without an active Apple Developer subscription. SettleHub is fully configured as a Progressive Web App:

1. Open your deployed Cloudflare Pages URL in **Safari** on iOS.
2. Tap the **Share** button (box with upward arrow).
3. Tap **"Add to Home Screen"**.
4. The app installs with a native icon, launches full-screen with no browser navigation bars, and supports safe-area notch displays.

---

## 🚀 100% Free Cloud Deployment Guide

### Part A: Backend & Neon PostgreSQL on Render

Render provides a 1-click infrastructure blueprint via `render.yaml`:

1. Sign up or log into **[dashboard.render.com](https://dashboard.render.com/)**.
2. Click **New +** $\rightarrow$ select **Blueprint**.
3. Connect your GitHub repository (`https://github.com/byte2code/settlehub`).
4. Set the `DATABASE_URL` environment variable to your Neon Serverless PostgreSQL connection string:
   ```text
   postgresql://user:password@ep-xyz.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Click **Apply**. When deployment finishes (~3 minutes), note your live URL (e.g. `https://settlehub-backend.onrender.com`).
6. Test the health probe:
   ```bash
   curl https://settlehub-backend.onrender.com/health
   # Returns: {"status":"UP","service":"settlehub-backend","version":"2.0.0"}
   ```

### Part B: Frontend on Cloudflare Pages

1. Log into **[dash.cloudflare.com](https://dash.cloudflare.com/)** $\rightarrow$ **Workers & Pages** $\rightarrow$ **Create application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**.
2. Select your repository.
3. Configure the build parameters:
   - **Framework preset:** `Vite`
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Expand **Environment variables** and add:
   - `VITE_API_URL` = `https://settlehub-backend.onrender.com/api/v1`
5. Click **Save and Deploy**. Your web app and PWA will be live worldwide in ~60 seconds.

---

## 📡 API Reference

Base Endpoint: `/api/v1`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/health` | Cloud liveness & readiness probe | No |
| `POST` | `/api/v1/auth/register` | Register new user account | No |
| `POST` | `/api/v1/auth/login` | Authenticate and retrieve 30-day JWT token | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Yes |
| `PATCH`| `/api/v1/auth/me/currency` | Update user preferred default currency | Yes |
| `GET` | `/api/v1/groups` | List user groups with net balances & budgets | Yes |
| `POST` | `/api/v1/groups` | Create new group with optional target budget | Yes |
| `GET` | `/api/v1/groups/{id}` | Retrieve group details, members, budget pacing | Yes |
| `PUT` | `/api/v1/groups/{id}` | Update group settings (archive/restore, budget, simplify) | Yes |
| `POST` | `/api/v1/groups/{id}/members` | Add member to group by email | Yes |
| `POST` | `/api/v1/groups/join` | Join group via 6-digit Invite Code | Yes |
| `GET` | `/api/v1/groups/{id}/expenses` | List group expenses with category & receipt URL | Yes |
| `POST` | `/api/v1/groups/{id}/expenses` | Record new expense (EQUAL, EXACT, PERCENT) | Yes |
| `PUT` | `/api/v1/expenses/{id}` | Edit existing expense and recalculate balances | Yes |
| `DELETE`| `/api/v1/expenses/{id}` | Delete expense and recompute balances | Yes |
| `GET` | `/api/v1/groups/{id}/balances` | Get pairwise debts & Min-Cash-Flow simplified debts | Yes |
| `POST` | `/api/v1/settlements` | Record debt settlement repayment between members | Yes |
| `GET` | `/api/v1/settlements/groups/{id}` | Retrieve group settlement audit history log | Yes |
| `GET` | `/api/v1/export/groups/{id}/whatsapp`| Generate formatted WhatsApp summary text | Yes |
| `GET` | `/api/v1/export/groups/{id}/excel` | Download native multi-sheet Microsoft Excel (`.xlsx`) | Yes |
| `POST` | `/api/v1/export/groups/{id}/email` | Email group transaction and balance report | Yes |
| `WS` | `/ws` | STOMP WebSocket endpoint for real-time group events | No handshake auth |

---

## 💻 Local Development Guide

### Prerequisites
- **Java 21 or 23** & **Maven 3.9+**
- **Node.js 20+** & **npm**
- **Android Command-Line Tools** (optional, for compiling APK)

### 1. Run Backend Locally
```bash
cd backend
export $(cat ../.env.local | xargs) # Loads Neon PostgreSQL credentials
mvn clean spring-boot:run
# Server starts on port 8080 (http://localhost:8080)
```

### 2. Run Frontend Locally
```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on http://localhost:3000 with real-time WebSocket support
```

### 3. Compile Android APK Locally
```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# Generated APK at: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. Run Automated E2E Test Suite
```bash
bash scratch/test_all_scenarios.sh
# Runs 33 end-to-end integration and edge-case test scenarios
```

---

## 🛡️ Security & Production Hardening

- **Stateless Authorization:** Every request is authenticated using JWT bearer tokens validated in `JwtAuthenticationFilter`.
- **CORS Management:** Configured with wildcard origin pattern matching to accept requests from both Cloudflare Pages domains (`*.pages.dev`) and mobile WebView protocols (`capacitor://localhost`, `https://localhost`).
- **Unified Error Handling:** `GlobalExceptionHandler` intercepts exceptions and returns consistent, sanitized JSON responses.
- **Neon Cloud Isolation:** SSL connections enforced (`sslmode=require`) with automatic HikariCP connection health validation.
- **Zero Secrets in Git:** Sensitive keys (`JWT_SECRET`, database passwords) are injected exclusively via cloud environment variables; `.env.local` is strictly gitignored.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
