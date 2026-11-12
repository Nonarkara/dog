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
# Preserve each test's entry or play path and query when changing origins.
#   DOG_URL=http://127.0.0.1:4189 npm run test:browser
set -u
BASE="${DOG_URL:-http://127.0.0.1:5173}"
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
if [ "$#" -eq 0 ]; then set -- scripts/test-*.cjs; fi
for script in "$@"; do
  if [ ! -f "$script" ]; then
    printf 'Missing browser test: %s\n' "$script" >&2
    fail=$((fail+1))
    continue
  fi
  name="$(basename "$script")"
  case "$name" in
    test-push.cjs)
      # The push runner bundles Node-only tests.
      continue ;;
  esac

  # Keep the test's path and query while replacing its development origin.
  surface="$(sed -nE "s/.*DOG_URL[[:space:]]*\\|\\|[[:space:]]*['\"]([^'\"]*)['\"].*/\\1/p" "$script" | head -1)"
  path="$(printf '%s' "$surface" | sed -E 's#^https?://[^/?]+##')"
  case "$path" in
    \?*) path="/$path" ;;
  esac
  url="${BASE%/}$path"

  out="$(DOG_URL="$url" node "$script" 2>&1)"
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
