#!/bin/bash
# Builds docs/index.html and runs the interface tests (synthetic data, frozen clock).
# If private/ holds a real data file, it also gets an open + save round trip.
set -e
cd "$(dirname "$0")"
[ -d node_modules/jsdom ] || npm install --silent >/dev/null 2>&1
./build.sh
REAL=$(ls private/*.json 2>/dev/null | sort | tail -1 || true)
echo "--- interface${REAL:+ (plus real data: $(basename "$REAL"))}"
node tests/test_app.js ${REAL:+"$REAL"} | tail -8
