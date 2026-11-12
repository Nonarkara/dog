#!/usr/bin/env bash
# Run every browser test script in scripts/ against a running build.
#
# Each script is a rendered regression check: it opens the app in Chrome,
# drives a real interaction, and asserts on what happened. A script that
# cannot finish is a FAILURE, not a skip — a test that never ran is not a
# test that passed.
#
# EACH TEST GETS THE SURFACE IT ASKS FOR.
#
# The scripts default to different surfaces: twenty of them want the entry
# screen ("http://127.0.0.1:4178") and nine want the app itself
# ("http://127.0.0.1:4178/?mode=play"). They also default to different
# ports. One DOG_URL for all of them points every test at one surface, and
# the ones that wanted the other surface fail on a page that was never
# supposed to be there — which reads exactly like a broken product.
#
# So the runner reads each script's OWN default, keeps its path and query,
# and re-points only the port at the running server.
#
#   DOG_URL=http://127.0.0.1:3100 bash scripts/run-browser-tests.sh
set -u
BASE="${DOG_URL:-http://127.0.0.1:3100}"
LOG="${DOG_TEST_LOG:-/tmp/dog-browser-tests.log}"
: > "$LOG"

# Playwright is a test-time dependency, not a product dependency, and it is
# not in this project's tree. The tests say so themselves ("Run with
# Playwright installed or NODE_PATH set"), so the runner finds it rather
# than leaving 45 rendered tests that nobody can run.
if ! node -e "require('playwright')" 2>/dev/null; then
  for candidate in /Users/nonarkara/Projects/*/node_modules; do
    if [ -d "$candidate/playwright" ]; then
      export NODE_PATH="$candidate${NODE_PATH:+:$NODE_PATH}"
      echo "playwright: $candidate"
      break
    fi
  done
fi

pass=0; fail=0; failed=""
for script in scripts/test-*.cjs scripts/test-*.ts; do
  [ -e "$script" ] || continue
  name="$(basename "$script")"
  case "$name" in
    test-email-auth.ts|test-care-domain.ts|test-push-*.ts|test-park-rewards.ts|test-return-summary.ts|test-call-announcement.ts)
      # These run under `npm run test:*` (esbuild + node), not in a browser.
      continue ;;
  esac

  # The surface this script asks for: its own default's path and query.
  # (cut on the quote: a greedy sed would eat the URL itself.)
  surface="$(grep -o "DOG_URL||'[^']*'" "$script" | head -1 | cut -d"'" -f2)"
  path="/"
  case "$surface" in
    *\?*) path="/?${surface#*\?}" ;;
    *) path="${surface#http://127.0.0.1:4178}" ;;
  esac
  url="$BASE$path"

  if [ "${script##*.}" = "ts" ]; then
    out="$(npx esbuild "$script" --bundle --platform=node --format=cjs --outfile=node_modules/.cache/tmp-test.cjs --log-level=error 2>&1 && node node_modules/.cache/tmp-test.cjs 2>&1)"
  else
    out="$(DOG_URL="$url" node "$script" 2>&1)"
  fi
  code=$?
  if [ $code -eq 0 ]; then
    pass=$((pass+1)); printf 'PASS  %-38s %s\n' "$name" "$url" >> "$LOG"
    printf 'PASS  %-38s %s\n' "$name" "$url"
  else
    fail=$((fail+1)); failed="$failed $name"
    printf 'FAIL  %-38s %s (exit %s)\n%s\n---\n' "$name" "$url" "$code" "$out" >> "$LOG"
    printf 'FAIL  %-38s %s (exit %s)\n' "$name" "$url" "$code"
    printf '%s\n' "$out" | tail -3 | sed 's/^/      /'
  fi
done

echo "----------------------------------------"
echo "browser tests: $pass passed, $fail failed"
[ -n "$failed" ] && echo "failed:$failed"
echo "log: $LOG"
[ $fail -eq 0 ]
