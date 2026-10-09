#!/usr/bin/env bash
# Checks the plugins:
#   1 php -l on every PHP file, with PHP 8.2 (the lowest version the plugins support),
#     8.3 (the WordPress test image) and 8.5 (the Omeka S test image).
#   2 WordPress Plugin Check (it includes the PHPCS WordPress rules) on the test host.
#     Run deploy/test-hosts/install-plugins.sh first.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
compose=(docker compose -f "$here/../deploy/test-hosts/docker-compose.yml")
files=$(cd "$here" && find wordpress omeka-s \( -name '*.php' -o -name '*.phtml' \) | sort)
for image in php:8.2-cli wordpress:cli-php8.3 giocomai/omeka-s-docker:v4.2.1; do
  echo "== php -l, $image"
  # shellcheck disable=SC2086
  docker run --rm -v "$here":/p:ro -w /p --entrypoint sh "$image" -c \
    'for f in "$@"; do php -l "$f" >/dev/null || exit 1; done; php -v | head -1; echo "$# files: no syntax errors"' sh $files
done
echo "== WordPress Plugin Check"
"${compose[@]}" run --rm -T wp-cli wp plugin is-installed plugin-check \
  || "${compose[@]}" run --rm -T wp-cli wp plugin install plugin-check
"${compose[@]}" run --rm -T wp-cli wp plugin activate plugin-check >/dev/null
"${compose[@]}" run --rm -T wp-cli wp plugin check annoudio
"${compose[@]}" run --rm -T wp-cli wp plugin deactivate plugin-check >/dev/null
