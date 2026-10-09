#!/usr/bin/env bash
# Gets the two libraries that Playwright's WebKit needs on hosts where
# `sudo pnpm exec playwright install-deps` is not possible (no root).
# It downloads the Ubuntu packages without installing them, extracts the .so files to
# .cache/webkit-deps (playwright.config.ts adds this to LD_LIBRARY_PATH), and copies them
# into the WebKit WPE bundle, whose launcher resets LD_LIBRARY_PATH.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
(cd "$work" && apt-get download libmanette-0.2-0 libhidapi-hidraw0 >/dev/null)
for deb in "$work"/*.deb; do dpkg-deb -x "$deb" "$work/root"; done
mkdir -p "$here/.cache/webkit-deps"
cp -a "$work"/root/usr/lib/x86_64-linux-gnu/lib{manette,hidapi-hidraw}* "$here/.cache/webkit-deps/"
for lib in "$HOME"/.cache/ms-playwright/webkit-*/minibrowser-wpe/sys/lib; do
  cp -a "$here"/.cache/webkit-deps/* "$lib/"
  echo "Copied to $lib"
done
