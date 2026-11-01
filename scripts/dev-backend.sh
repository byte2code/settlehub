#!/usr/bin/env bash
# Runs the backend locally on the in-memory H2 database with test-friendly settings.
# Reads secrets from .env.local but deliberately IGNORES DATABASE_URL, so local runs can never touch production.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
unset DATABASE_URL DATABASE_URL_UNPOOLED NEON_BRANCH BREVO_API_KEY
# The backend also scans .env.local for DATABASE_URL on its own; this switch disables that so we stay on H2.
export APP_DATABASE_URL_ENABLED=false

export APP_ADMIN_EMAILS="${SETTLEHUB_ADMIN_EMAIL:-}"
export APP_AUTH_VERIFICATION_BYPASS_EMAILS="${SETTLEHUB_ADMIN_EMAIL:-},${SETTLEHUB_TEST1_EMAIL:-},${SETTLEHUB_TEST2_EMAIL:-},${SETTLEHUB_TEST3_EMAIL:-}"
export AUTH_MASTER_OTP="${AUTH_MASTER_OTP:-000000}"

exec mvn -q -f backend/pom.xml spring-boot:run
