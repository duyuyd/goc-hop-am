#!/usr/bin/env bash
set -euo pipefail
test -n "$GITHUB_ENV" || { echo "GitHub Actions environment required"; exit 1; }
mkdir -p artifacts
CONFIG=wrangler.local.jsonc
DB=site-creator-d1
PERSIST=.wrangler/state

for migration in drizzle/*.sql; do
  echo "Applying local D1 migration: $migration"
  npx wrangler d1 execute "$DB" --local --config="$CONFIG" --persist-to="$PERSIST" --file="./$migration"
done
node --experimental-strip-types scripts/e2e-seed.ts
E2E_SLUG="$(sed -n 's/^E2E_SLUG=//p' "$GITHUB_ENV" | tail -1)"
E2E_OTP="$(sed -n 's/^E2E_OTP=//p' "$GITHUB_ENV" | tail -1)"
export E2E_SLUG E2E_OTP
test -n "$E2E_SLUG" && test -n "$E2E_OTP"
npx wrangler d1 execute "$DB" --local --config="$CONFIG" --persist-to="$PERSIST" --file=./artifacts/e2e-seed.sql
echo "Actual Miniflare D1 local count:"
npx wrangler d1 execute "$DB" --local --config="$CONFIG" --persist-to="$PERSIST" --command="SELECT count(*) AS total FROM songs;"

npm run build
npx --yes wrangler@4.165.0 dev --config=dist/server/wrangler.json --local --persist-to=.wrangler/state --ip=127.0.0.1 --inspector-port=0 > artifacts/wrangler-local.log 2>&1 &
app_pid=$!
export PRODUCTION_URL=http://127.0.0.1:8787
export E2E_WEBHOOK_URL=http://127.0.0.1:7071/receipt
node scripts/local-webhook.mjs > artifacts/webhook-local.log 2>&1 &
webhook_pid=$!
cleanup() {
  kill "$app_pid" "$webhook_pid" 2>/dev/null || true
  wait "$app_pid" "$webhook_pid" 2>/dev/null || true
}
trap cleanup EXIT
ready=0
for attempt in $(seq 1 100); do
  if curl --silent --fail --max-time 2 "$PRODUCTION_URL/" > /dev/null; then ready=1; break; fi
  if ! kill -0 "$app_pid" 2>/dev/null; then echo "FAIL: Wrangler process terminated"; break; fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  echo "FAIL: real Wrangler app not ready"
  tail -n 120 artifacts/wrangler-local.log || true
  exit 1
fi
echo "Wrangler/Miniflare app ready at $PRODUCTION_URL"
E2E_MODE=local npx playwright test tests/e2e/goc-hop-am.spec.ts --reporter=line --workers=1
test -s artifacts/atomic-proof.json
test -s artifacts/local-webhook-received.json
echo "LOCAL FALLBACK PASS: proof and actual browser callback recorded"
