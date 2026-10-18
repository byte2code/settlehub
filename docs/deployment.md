# SettleHub Free-Tier Deployment Runbook

This guide details the step-by-step procedure to deploy the SettleHub platform for free on **Render.com** (Spring Boot 3 + PostgreSQL) and **Cloudflare Pages** (React 18 SPA).

---

## Architecture Topology

```
   ┌─────────────────────────────────────────────────────────┐
   │                  Cloudflare Pages Edge                  │
   │               Static SPA (React 18 + Vite)              │
   │              Global CDN / Free SSL / HTTP/3             │
   └────────────────────────────┬────────────────────────────┘
                                │ HTTPS Requests (/api/v1/*)
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                     Render.com Web                      │
   │        Spring Boot 3.3.x (Java 21 Virtual Threads)      │
   │           512MB Free Container (Docker Image)           │
   │            Tuned JVM: -XX:MaxRAMPercentage=75.0         │
   └────────────────────────────┬────────────────────────────┘
                                │ JDBC over TLS (sslmode=require)
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │               PostgreSQL Managed Database               │
   │            Render.com or Neon.tech Free Tier            │
   └─────────────────────────────────────────────────────────┘
```

---

## 1. Database Provisioning (Render or Neon)

### Option A: Render Managed PostgreSQL
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**.
3. Configure settings:
   - **Name**: `settlehub-db`
   - **Database**: `settlehub`
   - **User**: `settlehub_user`
   - **Region**: Choose the region closest to you (e.g. Frankfurt or Oregon).
   - **Plan**: **Free** (1GB storage, 100 connections).
4. Click **Create Database**.
5. Once provisioned, copy the **Internal Database URL** (or External Database URL).

### Option B: Neon.tech Serverless PostgreSQL
1. Create a free project on [Neon.tech](https://neon.tech).
2. Copy the pooled connection string: `postgres://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require`.

---

## 2. Backend Deployment on Render

### Step 2.1: Create Web Service
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your Git repository containing SettleHub.
3. Configure the service:
   - **Name**: `settlehub-backend`
   - **Region**: Same region as your database.
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: **Docker** (Uses `backend/Dockerfile`)
   - **Plan**: **Free** (0.1 CPU, 512MB RAM)

### Step 2.2: Environment Variables
Add the following environment variables in Render:

| Key | Value | Description |
|---|---|---|
| `DATABASE_URL` | `<paste your postgresql connection string>` | Automatically converted to JDBC by `DatabaseUrlEnvironmentPostProcessor` |
| `app.jwt.secret` | `<generate a secure 64-char hex string>` | Signing key for HS256 JWT tokens |
| `app.jwt.expiration-ms` | `86400000` | 24-hour token validity |
| `PORT` | `8080` | Container listening port |

### Step 2.3: Memory Management (512MB Limit)
Render strictly enforces 512MB container RAM limits. The included `backend/Dockerfile` sets:
```bash
JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"
```
- **Heap Allocation**: ~384MB max (75% of 512MB).
- **Headroom**: ~128MB reserved for Metaspace, GC worker threads, and Linux cgroup kernel buffers.
- **ExitOnOutOfMemoryError**: Ensures immediate restarts if limits are exceeded, preventing silent freeze.

---

## 3. Frontend Deployment on Cloudflare Pages

### Step 3.1: Connect Repository
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to **Workers & Pages**.
2. Click **Create Application** -> **Pages** -> **Connect to Git**.
3. Select the SettleHub repository.

### Step 3.2: Build Configuration
Configure the build settings:
- **Project Name**: `settlehub`
- **Production Branch**: `main`
- **Framework Preset**: **Vite**
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`

### Step 3.3: Environment Variables
Add the backend API endpoint URL:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://settlehub-backend.onrender.com/api/v1` |

### Step 3.4: SPA Routing Redirects
Cloudflare Pages automatically serves `frontend/public/_redirects`:
```
/*  /index.html  200
```
This guarantees client-side HTML5 history routing without 404 errors on deep linking or page refresh.

---

## 4. Local Development & Testing

### Running the Backend Locally
Requirements: Java 21+ and Maven 3.9+.

```bash
cd backend

# Run the test suite (11 unit & integration tests)
mvn clean test

# Launch local Spring Boot server (defaults to in-memory H2 with PostgreSQL compatibility)
mvn spring-boot:run
```
The server will start on `http://localhost:8080`.

### Running the Frontend Locally
Requirements: Node 18+ and npm 10+.

```bash
cd frontend

# Install dependencies
npm install

# Start development server with API proxying
npm run dev
```
The client will start on `http://localhost:3000` with requests to `/api/*` proxied to `http://localhost:8080`.

---

## 5. Verification Checklist

- [x] Java 21 & Spring Boot 3 compilation with 0 warnings.
- [x] JUnit 5 test suite covering cent-precision division, percentage discrepancy correction, circular debt resolution, and end-to-end integration flow.
- [x] `DatabaseUrlEnvironmentPostProcessor` parsing `postgres://` into valid JDBC connection with `sslmode=require`.
- [x] CORS bean configured for `http://localhost:*` and `https://*.pages.dev`.
- [x] Multi-stage Dockerfile with `-XX:MaxRAMPercentage=75.0` for 512MB RAM constraints.
- [x] React 18 + Vite production build (`dist/`) with zero TypeScript errors.
- [x] Cloudflare Pages `public/_redirects` SPA rewrite file.
