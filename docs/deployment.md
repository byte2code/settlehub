# SettleHub 3.0 deployment runbook ($0/month)

```
Browser / PWA ──► Cloudflare Pages (static SPA)
      │
      └──────────┐
Android APK ─────┴─► Render free web service (Spring Boot, Docker) ──► Neon PostgreSQL
                          ▲
GitHub Actions ───────────┘  CI on push/PR · APK release on v* tags · optional keep-warm ping
```

| Piece | Free allowance | Notes |
| --- | --- | --- |
| Render web service | 512 MB, 0.1 CPU, 750 h/month | Sleeps after 15 idle minutes; the first request wakes it |
| Neon | 0.5 GB storage, scale-to-zero | Not deleted after 30 days (Render's free Postgres is) |
| Cloudflare Pages | Unlimited static bandwidth, 500 builds/month | |
| GitHub Actions | Free on public repositories | |

---

## 1. Database: Neon

1. Create a project at [console.neon.tech](https://console.neon.tech) (pick the region closest to your Render region).
2. **Connect** → copy the connection string: `postgresql://user:password@ep-….neon.tech/neondb?sslmode=require`.
   Either the pooled or the direct string works; the app keeps no idle connections, so Neon can suspend.

You do not create any tables: Flyway creates the schema on the first start.

### Moving existing data from Render Postgres (2.0 deployments)

2.0's Blueprint created a free Render database, which Render deletes 30 days after creation. Copy it to Neon before then:

```bash
pg_dump --no-owner --no-acl "<render external connection string>" > settlehub.sql
psql "<neon connection string>" < settlehub.sql
```

Then point `DATABASE_URL` at Neon (step 2). On start, Flyway baselines the 2.0 schema and upgrades it in place. Removing the database from `render.yaml` does not delete it; delete it in the Render dashboard once you have checked the data on Neon.

---

## 2. Backend: Render

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → choose this repository. Render reads `render.yaml`.
2. When asked for `DATABASE_URL`, paste the Neon string. `JWT_SECRET` is generated automatically and kept across deploys.
3. **Apply**. The first Docker build takes several minutes (it includes the CDS training run).
4. Check it:
   ```bash
   curl https://<service>.onrender.com/api/v1/health        # liveness, no database
   curl https://<service>.onrender.com/api/v1/health/ready  # also checks the database
   ```

Optional environment variables (set them in the service's **Environment** tab):

| Variable | When to set it |
| --- | --- |
| `APP_CORS_ALLOWED_ORIGINS` | The frontend is on a custom domain. Comma-separated; include the defaults you still need, e.g. `https://settle.example.com,https://*.pages.dev,https://localhost,capacitor://localhost` |
| `APP_AUTH_RATE_LIMIT` | Change the 10 login attempts/minute limit |
| `APP_RECEIPT_MAX_CHARS` | Change the receipt photo size limit |
| `spring.mail.*` (`SPRING_MAIL_HOST`, …) | Enable the email report export |

Leave a variable **unset** rather than empty: an empty `APP_CORS_ALLOWED_ORIGINS` blocks every origin.

### Why the image looks the way it does

The free plan's 0.1 CPU makes JVM start-up the slow part of waking from sleep. `backend/Dockerfile`:

- unpacks the jar and runs the app once at build time (`-Dspring.context.exit=onRefresh`) to record a **Class Data Sharing** archive, which the real start maps in instead of loading those classes again. The training run uses the in-memory H2 database, so the build needs no secrets or network;
- uses `-XX:+UseSerialGC -XX:TieredStopAtLevel=1` (no parallel GC or C2 compiler threads competing for the single throttled core) and `MaxRAMPercentage=75` to stay inside 512 MB.

### Keeping it awake (optional)

`.github/workflows/keep-warm.yml` pings `/api/v1/health` every 10 minutes once you set the repository variable `SETTLEHUB_BACKEND_URL` (e.g. `https://settlehub-backend.onrender.com`). That endpoint never touches the database, so Neon still sleeps. Only use it if:

- this is your only free Render service (one always-on service uses ~744 of the 750 free hours), and
- the repository is public (on a private repo the pings would use more than the 2,000 free Actions minutes).

GitHub pauses scheduled workflows in repositories with no activity for 60 days; re-enable it in the Actions tab if that happens.

---

## 3. Frontend: Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → this repository.
2. Build settings:
   - Framework preset: **Vite**
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Environment variable: `VITE_API_URL` = `https://<service>.onrender.com/api/v1`
4. **Save and Deploy**.

`frontend/public/_redirects` sends every path to `index.html`, so deep links such as `/groups/<id>` and `/join/<code>` work on reload. `*.pages.dev` is already allowed by the backend's CORS default.

---

## 4. Android APK: GitHub Releases

`.github/workflows/release-apk.yml` builds the APK and attaches it to a GitHub Release whenever a `v*` tag is pushed.

1. **Settings → Secrets and variables → Actions → Variables**: add `SETTLEHUB_API_URL` = `https://<service>.onrender.com/api/v1`.
2. **Signing key (recommended).** Android only installs an update that is signed with the same key as the installed app. Without a key, the workflow signs with a throwaway debug key and users must uninstall before every update. Create a key once and keep a backup; if you lose it, users have to reinstall:
   ```bash
   keytool -genkeypair -v -keystore settlehub-release.jks -alias settlehub \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -i settlehub-release.jks | pbcopy     # macOS; on Linux: base64 -w0 settlehub-release.jks
   ```
   Add these repository **secrets**: `ANDROID_KEYSTORE_BASE64` (the base64 text), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`settlehub`), `ANDROID_KEY_PASSWORD`.
3. Release:
   ```bash
   git tag v3.0.0
   git push origin v3.0.0
   ```
   The APK appears at `https://github.com/<owner>/settlehub/releases/latest/download/SettleHub.apk`. To rebuild an existing tag, run the workflow manually from the Actions tab and enter the tag.

The version name comes from the tag (`v3.0.0` → `3.0.0`) and the version code from the workflow run number, so each release installs over the previous one.

---

## 5. Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

- backend: `mvn verify` (JUnit + MockMvc against in-memory H2)
- frontend: `npm run lint`, `npm test` (Vitest), `npm run build`

Tests never use a real database: the Maven test run sets `app.database-url.enabled=false`, so a `DATABASE_URL` in your shell or a local `.env.local` is ignored.

---

## 6. Local development

```bash
# Backend on in-memory H2 with demo users (alice@ / bob@settlehub.com, password123)
cd backend
mvn spring-boot:run -Dspring-boot.run.jvmArguments=-Dapp.database-url.enabled=false

# Frontend on http://localhost:3000 (proxies /api and /ws to :8080)
cd frontend && npm ci && npm run dev
```

Without `-Dapp.database-url.enabled=false`, the backend reads `DATABASE_URL` from the environment or from `.env.local` / `.env` in `backend/` or the repo root, and then also needs `JWT_SECRET`. Point it at a Neon branch, not production.

---

## 7. Verification checklist

- [ ] `GET /api/v1/health` returns `"status":"UP"` and `"version":"3.0.0"`.
- [ ] `GET /api/v1/health/ready` returns 200 (database reachable, migrations applied).
- [ ] Sign up and sign in on the Pages URL; create a group; add an expense.
- [ ] Open the same group as a second user in another browser: the expense appears without a refresh and the header shows **live**.
- [ ] Settle a debt from the balances card; the payment shows under **Payments** and can be undone.
- [ ] Reload a `/groups/<id>` URL directly; it loads (SPA redirect works).
- [ ] Install the APK from the latest release; it reaches the backend and the Android back button navigates within the app.
