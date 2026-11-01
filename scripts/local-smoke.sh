#!/usr/bin/env bash
# End-to-end smoke test against a LOCAL backend (scripts/dev-backend.sh). Refuses to run against anything else.
# Uses the test accounts from .env.local; passwords are never printed.
set -uo pipefail
cd "$(dirname "$0")/.."
BASE="${BASE:-http://localhost:8080/api/v1}"
case "$BASE" in http://localhost:*|http://127.0.0.1:*) ;; *) echo "Refusing to run against $BASE"; exit 2;; esac
set -a; source .env.local; set +a

pass=0; fail=0
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; pass=$((pass+1)); else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=$((fail+1)); fi
}
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
curl_args() { # method path token body -> fills ARGS
  ARGS=(-s -X "$1" "$BASE$2")
  [ -n "${3:-}" ] && ARGS+=(-H "Authorization: Bearer $3")
  [ -n "${4:-}" ] && ARGS+=(-H "Content-Type: application/json" -d "$4")
  return 0
}
call() { curl_args "$@"; curl "${ARGS[@]}"; }
code() { curl_args "$@"; curl -o /dev/null -w '%{http_code}' "${ARGS[@]}"; }
signup() { call POST /auth/register "" "{\"email\":\"$1\",\"password\":\"$2\",\"firstName\":\"$3\",\"currencyCode\":\"INR\",\"otp\":\"x\"}" | j "d.get('token','')"; }
login()  { call POST /auth/login "" "{\"email\":\"$1\",\"password\":\"$2\"}" | j "d.get('token','')"; }

echo "Accounts"
ADMIN=$(signup "$SETTLEHUB_ADMIN_EMAIL" "$SETTLEHUB_ADMIN_PASSWORD" Admin); [ -n "$ADMIN" ] || ADMIN=$(login "$SETTLEHUB_ADMIN_EMAIL" "$SETTLEHUB_ADMIN_PASSWORD")
T1=$(signup "$SETTLEHUB_TEST1_EMAIL" "$SETTLEHUB_TEST1_PASSWORD" Test1); [ -n "$T1" ] || T1=$(login "$SETTLEHUB_TEST1_EMAIL" "$SETTLEHUB_TEST1_PASSWORD")
T2=$(signup "$SETTLEHUB_TEST2_EMAIL" "$SETTLEHUB_TEST2_PASSWORD" Test2); [ -n "$T2" ] || T2=$(login "$SETTLEHUB_TEST2_EMAIL" "$SETTLEHUB_TEST2_PASSWORD")
check "admin can sign in" yes "$([ -n "$ADMIN" ] && echo yes)"
check "test1 can sign in" yes "$([ -n "$T1" ] && echo yes)"
check "test2 can sign in" yes "$([ -n "$T2" ] && echo yes)"
check "admin flag is set from APP_ADMIN_EMAILS" True "$(call GET /auth/me "$ADMIN" | j "d['admin']")"
check "normal user is not admin" False "$(call GET /auth/me "$T1" | j "d['admin']")"

echo "Security"
BAD=$(call POST /auth/login "" "{\"email\":\"$SETTLEHUB_TEST1_EMAIL\",\"password\":\"nope-nope-nope\"}")
check "wrong password rejected" 401 "$(echo "$BAD" | j "d['status']")"
echo "    body: $(echo "$BAD" | sed 's/[A-Za-z0-9._-]*@[A-Za-z0-9.-]*/<email>/g')"
check "reset-password on test account needs a real code" 400 "$(code POST /auth/reset-password "" "{\"email\":\"$SETTLEHUB_TEST1_EMAIL\",\"otp\":\"anything\",\"newPassword\":\"hijacked1234\"}")"
check "non-admin blocked from /admin" 403 "$(code GET /admin/overview "$T1")"
check "anonymous blocked from /admin" 401 "$(code GET /admin/overview)"

echo "Group, expense, payment summary"
T1ID=$(call GET /auth/me "$T1" | j "d['id']"); T2ID=$(call GET /auth/me "$T2" | j "d['id']")
call PATCH /auth/me "$T2" '{"upiId":"test2@okbank"}' >/dev/null
GID=$(call POST /groups "$T1" "{\"name\":\"Smoke Trip $RANDOM\",\"groupType\":\"trip\",\"currencyCode\":\"INR\",\"memberEmails\":[\"$SETTLEHUB_TEST2_EMAIL\"]}" | j "d['id']")
call POST "/groups/$GID/expenses" "$T2" "{\"description\":\"Dinner\",\"costCents\":60000,\"creationMethod\":\"EQUAL\",\"splits\":[{\"userId\":\"$T1ID\"},{\"userId\":\"$T2ID\"}]}" >/dev/null
SUM=$(call GET /balances/me/summary "$T1")
check "test1 owes test2 30000" 30000 "$(echo "$SUM" | j "d['peopleYouOwe'][0]['totalAmountCents']")"
check "UPI id shown for the person you owe" test2@okbank "$(echo "$SUM" | j "d['peopleYouOwe'][0]['upiId']")"
check "test2 is owed 30000" 30000 "$(call GET /balances/me/summary "$T2" | j "d['peopleWhoOweYou'][0]['totalAmountCents']")"

echo "Inbox / notifications"
check "test1 has an unread notification" True "$(call GET /notifications "$T1" | j "d['unreadCount']>0")"
call POST "/notifications/groups/$GID/read" "$T1" >/dev/null
check "opening the group clears it" 0 "$(call GET /notifications "$T1" | j "d['unreadCount']")"

echo "Settle + badges"
call POST /settlements "$T1" "{\"groupId\":\"$GID\",\"payerId\":\"$T1ID\",\"payeeId\":\"$T2ID\",\"amountCents\":30000}" >/dev/null
check "summary clears after settling" 0 "$(call GET /balances/me/summary "$T1" | j "len(d['peopleYouOwe'])")"
check "Instant Settler earned" True "$(call GET /auth/me/badges "$T1" | j "[b['earned'] for b in d if b['id']=='instant-settler'][0]")"

echo "Profile"
check "bio/avatar/chime saved" "fox bell" "$(call PATCH /auth/me "$T1" '{"bio":"Smoke tester","avatarId":"fox","chimeSound":"bell"}' | j "d['avatarId']+' '+d['chimeSound']")"
check "script-injection bio rejected" 400 "$(code PATCH /auth/me "$T1" '{"bio":"<script>x</script>"}')"

echo "Admin"
check "overview users >= 3" True "$(call GET /admin/overview "$ADMIN" | j "d['totalUsers']>=3")"
check "search finds test2" 1 "$(call GET "/admin/users?q=$SETTLEHUB_TEST2_EMAIL" "$ADMIN" | j "len(d)")"
check "deactivate test2" False "$(call PATCH "/admin/users/$T2ID/active" "$ADMIN" '{"active":false}' | j "d['active']")"
check "deactivated token rejected" 401 "$(code GET /auth/me "$T2")"
call PATCH "/admin/users/$T2ID/active" "$ADMIN" '{"active":true}' >/dev/null
check "reactivated user works again" 200 "$(code GET /auth/me "$T2")"

echo; echo "passed=$pass failed=$fail"; [ "$fail" -eq 0 ]
