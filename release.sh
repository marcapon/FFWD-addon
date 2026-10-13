#!/bin/sh
# Zet de zip voor een release klaar: dist/ffwd-addon-v<versie>.zip met daarin de map ffwd-addon (= extensie/).
# Draait eerst de tests. Uploaden naar GitHub doe je daarna zelf (of met: gh release create v<versie> dist/…zip).
set -e
cd "$(dirname "$0")"
versie=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extensie/manifest.json)
node --test >/dev/null
tmp=$(mktemp -d)
mkdir "$tmp/ffwd-addon"
cp -R extensie/. "$tmp/ffwd-addon/"
find "$tmp" -name '.DS_Store' -delete
mkdir -p dist
rm -f "dist/ffwd-addon-v$versie.zip"
(cd "$tmp" && zip -qr - ffwd-addon) > "dist/ffwd-addon-v$versie.zip"
rm -rf "$tmp"
echo "Klaar: dist/ffwd-addon-v$versie.zip"
