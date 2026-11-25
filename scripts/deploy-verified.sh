#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"

clean() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Deploy from a clean checkout." >&2
    exit 1
  fi
}
verify_main() {
  local remote
  remote=$(git ls-remote --exit-code origin refs/heads/main | cut -f1)
  if [[ "$commit" != "$remote" ]]; then
    echo "Deploy the current origin/main commit." >&2
    exit 1
  fi
}

clean
commit=$(git rev-parse HEAD)
verify_main
run=$(gh run list --workflow checks.yml --branch main --commit "$commit" --limit 1 --json conclusion,url   --jq '.[] | select(.conclusion == "success") | .url')
if [[ -z "$run" ]]; then
  echo "The Companion checks workflow must pass for $commit before deploying." >&2
  exit 1
fi
printf 'Building %s after %s\n' "$commit" "$run"
npm ci
npm run build
clean
verify_main
[[ "$(git rev-parse HEAD)" == "$commit" ]]
node node_modules/wrangler/bin/wrangler.js deploy --assets "$root/dist" --keep-vars
