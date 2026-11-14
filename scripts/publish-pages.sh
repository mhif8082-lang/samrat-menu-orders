#!/usr/bin/env bash
# Build the app for GitHub Pages and publish it to the gh-pages branch.
# Permanent address: https://<owner>.github.io/<repo>/
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${PAGES_REPO:-mhif8082-lang/samrat-menu-orders}"
NAME="${REPO#*/}"
npx tsc --noEmit
VITE_REMOTE_BACKEND=1 npx vite build --base="/$NAME/" --outDir dist-gh --emptyOutDir >/dev/null
cp dist-gh/index.html dist-gh/404.html        # deep links (e.g. /staff/kitchen) load the app
touch dist-gh/.nojekyll
URL="$(cat .tools/public-url.txt 2>/dev/null || true)"
printf '{"url":"%s","updated":"%s"}\n' "$URL" "$(date -u +%FT%TZ)" > dist-gh/backend.json
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp -r dist-gh/. "$TMP/"
git -C "$TMP" init -q -b gh-pages
git -C "$TMP" add -A
git -C "$TMP" -c user.name="Samrat Menu Orders" -c user.email="noreply@samratmenuorders.app" commit -qm "Publish app $(date -u +%FT%TZ)"
git -C "$TMP" push -q --force "https://github.com/$REPO.git" gh-pages
echo "Published to https://${REPO%%/*}.github.io/$NAME/ (server: ${URL:-none yet})"
