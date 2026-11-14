#!/usr/bin/env bash
# Public HTTPS link for the app (free Cloudflare quick tunnel). Runs separately from the server,
# so restarting the server never changes the public link.
set -euo pipefail
cd "$(dirname "$0")"
PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2)"; PORT="${PORT:-8080}"
[ -x .tools/cloudflared ] || { mkdir -p .tools; curl -fsSL -o .tools/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64; chmod +x .tools/cloudflared; }
exec .tools/cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" 2>&1 | while IFS= read -r line; do
  echo "$line"
  url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' <<<"$line" || true)
  if [ -n "$url" ]; then echo "$url" > .tools/public-url.txt; echo "Public link: $url"; (scripts/publish-backend.sh "$url" &); fi
done
