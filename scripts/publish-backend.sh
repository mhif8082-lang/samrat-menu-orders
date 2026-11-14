#!/usr/bin/env bash
# Tell the GitHub-hosted app where the server is now (called whenever the tunnel link changes).
set -uo pipefail
URL="$1"; REPO="${PAGES_REPO:-mhif8082-lang/samrat-menu-orders}"
GH="$(command -v gh || echo "$HOME/.local/bin/gh")"
BODY="$(printf '{"url":"%s","updated":"%s"}\n' "$URL" "$(date -u +%FT%TZ)" | base64 -w0)"
for i in 1 2 3 4 5 6; do
  SHA="$("$GH" api "repos/$REPO/contents/backend.json?ref=gh-pages" --jq .sha 2>/dev/null || true)"
  if "$GH" api -X PUT "repos/$REPO/contents/backend.json" -f message="Server link: $URL" -f content="$BODY" -f branch=gh-pages ${SHA:+-f sha="$SHA"} >/dev/null 2>&1; then
    echo "backend.json -> $URL"; exit 0
  fi
  sleep $((i * 10))
done
echo "Could not update backend.json" >&2; exit 1
