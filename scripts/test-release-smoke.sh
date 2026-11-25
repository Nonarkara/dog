#!/usr/bin/env bash
set -euo pipefail
preview_port=${DOG_SMOKE_PREVIEW_PORT:-4190}
dev_port=${DOG_SMOKE_DEV_PORT:-3199}
preview="http://127.0.0.1:$preview_port"
dev="http://127.0.0.1:$dev_port"
log=$(mktemp -d)
preview_pid=
dev_pid=
cleanup() {
  if [[ -n "$preview_pid" ]]; then kill "$preview_pid" 2>/dev/null || true; fi
  if [[ -n "$dev_pid" ]]; then kill "$dev_pid" 2>/dev/null || true; fi
  if [[ "$1" != 0 ]]; then cat "$log/preview" "$log/dev"; fi
  rm -f "$log/preview" "$log/dev"
  rmdir "$log"
}
trap 'cleanup "$?"' EXIT
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port "$preview_port" --strictPort >"$log/preview" 2>&1 &
preview_pid=$!
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$dev_port" --strictPort >"$log/dev" 2>&1 &
dev_pid=$!
ready=0
for attempt in {1..80}; do
  kill -0 "$preview_pid" "$dev_pid"
  # Check this process reported its listener before probing the address.
  if [[ $(cat "$log/preview") == *"Local:"* && $(cat "$log/dev") == *"Local:"* ]] &&
     curl -fsS "$preview/" >/dev/null 2>&1 && curl -fsS "$dev/" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep .25
done
[[ "$ready" == 1 ]]
DOG_URL="$preview/?mode=play" node scripts/test-workspace-ready.cjs
DOG_URL="$preview/?mode=play" DOG_PARK_SMOKE=1 node scripts/test-illustrated-park.cjs
DOG_URL="$preview/?mode=play" node scripts/test-bedtime-rooms.cjs
DOG_URL="$dev" node scripts/test-cloud-reliability.cjs
