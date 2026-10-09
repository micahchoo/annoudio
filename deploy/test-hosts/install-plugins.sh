#!/usr/bin/env bash
# Installs the Annoudio WordPress plugin and Omeka S module (plugins/) into the test hosts,
# points them at the demo stack, and makes the test pages. Safe to run again.
#
# Needs: the stack of this folder (setup.sh ran once), the demo stack `annoudio-demo`
# (deploy/DEMO.md), and the media fixture server on port 4610 (the demo recording's audio).
#
# Addresses:
#   browsers use ORIGIN (127.0.0.1:3500). PHP inside the host containers cannot reach the
#   host's 127.0.0.1, so this script joins both host containers to the demo stack's network
#   and sets the plugins' "server address" to SERVER_ORIGIN (http://app:3000).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
compose=(docker compose -f "$here/docker-compose.yml")

ORIGIN="${ORIGIN:-http://127.0.0.1:3500}"
SERVER_ORIGIN="${SERVER_ORIGIN:-http://app:3000}"
DEMO_NETWORK="${DEMO_NETWORK:-annoudio-demo_default}"
PROJECT="${PROJECT:-river-voices}"
RECORDING="${RECORDING:-1}"
AUDIO="${AUDIO:-http://127.0.0.1:4610/media/tone.m4a}"
# An address that plays but is not the admin's: the stored copy of the fallback pages.
STORED="${STORED:-http://127.0.0.1:4610/media/tone-nolength.m4a}"

"$root/plugins/build.sh" >/dev/null

echo "== Network: join the host containers to $DEMO_NETWORK"
for service in wordpress omeka; do
  cid="$("${compose[@]}" ps -q "$service")"
  if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$cid" | grep -q "\"$DEMO_NETWORK\""; then
    docker network connect "$DEMO_NETWORK" "$cid"
  fi
done

echo "== WordPress"
wp() { "${compose[@]}" run --rm -T wp-cli wp "$@"; }
"${compose[@]}" cp "$root/plugins/dist/annoudio.zip" wordpress:/tmp/annoudio.zip
"${compose[@]}" exec -T wordpress bash -c 'chown 33:33 /tmp/annoudio.zip && mv /tmp/annoudio.zip /var/www/html/wp-content/annoudio.zip'
wp plugin install wp-content/annoudio.zip --force --activate
"${compose[@]}" exec -T wordpress rm -f /var/www/html/wp-content/annoudio.zip
wp option update annoudio "{\"origin\":\"$ORIGIN\",\"project\":\"$PROJECT\",\"server_origin\":\"$SERVER_ORIGIN\"}" --format=json
# A cached answer from before this run (a stack that was down) must not hide the new one.
wp transient delete --all >/dev/null
# Posts by the author (no unfiltered_html). The block comment holds only attributes.
#   annoudio-block-by-author: two blocks with only the recording ID (one loader per page).
#   annoudio-block-fallback:  one block whose stored copy is $STORED, as if the admin's
#                             address changed after the save.
only_id="<!-- wp:annoudio/player {\"recording\":\"$RECORDING\"} /-->"
with_copy="<!-- wp:annoudio/player {\"recording\":\"$RECORDING\",\"src\":\"$STORED\"} /-->"
post() { # slug title content
  local id
  id=$(wp post list --post_type=post --name="$1" --field=ID --format=ids)
  [ -n "$id" ] && wp post delete "$id" --force >/dev/null
  wp post create --post_type=post --post_status=publish --post_title="$2" \
    --post_name="$1" --user=author1 --post_content="$3" >/dev/null
  echo "WordPress post: http://localhost:8091/?name=$1"
}
post annoudio-block-by-author "Annoudio block by an author" "$only_id

$only_id"
post annoudio-block-fallback "Annoudio block with a stored copy" "$with_copy"

echo "== Omeka S"
omeka() { "${compose[@]}" exec -T omeka "$@"; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unzip -q "$root/plugins/dist/Annoudio-omeka-s.zip" -d "$tmp"
omeka rm -rf /var/www/html/volume/modules/Annoudio
"${compose[@]}" cp "$tmp/Annoudio" omeka:/var/www/html/volume/modules/Annoudio
"${compose[@]}" cp "$here/omeka-plugins.php" omeka:/tmp/omeka-plugins.php
# The Omeka media: the container fetches the audio from itself (the fixture port is not
# reachable from inside Docker), through a temporary file in the web root.
curl -fsS -o "$tmp/tone.m4a" "$AUDIO"
"${compose[@]}" cp "$tmp/tone.m4a" omeka:/var/www/html/annoudio-tone.m4a
omeka chown -R www-data:www-data /var/www/html/volume/modules/Annoudio /var/www/html/annoudio-tone.m4a
"${compose[@]}" exec -T -u www-data omeka php /tmp/omeka-plugins.php "$ORIGIN" "$PROJECT" "$SERVER_ORIGIN" "$RECORDING" \
  http://localhost/annoudio-tone.m4a "$STORED"
omeka rm -f /var/www/html/annoudio-tone.m4a /tmp/omeka-plugins.php
