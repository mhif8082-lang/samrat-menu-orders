#!/usr/bin/env bash
# Start Samrat Menu Orders and publish it on a public HTTPS address.
#   ./launch.sh          → server on :8080 + public trycloudflare.com link
#   ./launch.sh local    → server only (use on the restaurant Wi-Fi)
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a
[ -d dist ] || npm run build
export PORT="${PORT:-8080}"
node server/index.mjs &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
if [ "${1:-}" != "local" ]; then
  [ -x .tools/cloudflared ] || { mkdir -p .tools; curl -fsSL -o .tools/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64; chmod +x .tools/cloudflared; }
  .tools/cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" 2>&1 | tee .tools/tunnel.log | grep --line-buffered -o 'https://[a-z0-9-]*\.trycloudflare\.com' | while read -r url; do echo "$url" > .tools/public-url.txt; echo; echo "  🌐 Public link: $url"; echo; done
else
  wait $SERVER
fi
