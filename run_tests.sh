#!/bin/bash
# Builds docs/ and runs the checks.
#  - always (also in CI on GitHub): interface + logic in jsdom, synthetic fixture, frozen clock (tests/test_app.js)
#  - when Playwright with Chromium is available (Claude's sessions): the three looks on phone and desktop
#    (tests/test_ui.js) and the Design Lab smoke test (tests/smoke.js)
# If private/ holds a real data file, the logic test also does an open + save round trip with it.
set -eo pipefail
cd "$(dirname "$0")"
[ -d node_modules/jsdom ] || npm install --silent >/dev/null 2>&1
./build.sh
REAL=$(ls private/*.json 2>/dev/null | sort | tail -1 || true)
echo "--- interface and logic${REAL:+ (plus real data: $(basename "$REAL"))}"
node tests/test_app.js ${REAL:+"$REAL"} | tail -8
if node -e "const p = require('playwright'); process.exit(require('fs').existsSync(p.chromium.executablePath()) ? 0 : 1)" 2>/dev/null; then
  echo "--- the three looks, phone and desktop"
  node tests/test_ui.js docs/index.html tests/shots/ui | tail -3
  echo "--- Design Lab smoke test"
  node tests/smoke.js docs/index.html tests/shots/smoke | tail -1
else
  echo "--- Chromium checks skipped (no Playwright here): CI runs the interface and logic checks"
fi
