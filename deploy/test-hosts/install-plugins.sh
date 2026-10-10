#!/usr/bin/env bash
# Installs the Annoudio WordPress plugin and Omeka S module (plugins/) into the test hosts,
# points them at the demo stack, and makes the test pages and the demo pages. Safe to run again.
#
# The demo pages (deploy/DEMO.md) hold the two lines that the admin's Snippet panel gives,
# pasted by an administrator into an HTML block, one widget per page:
#   http://localhost:8091/?pagename=demo        WordPress, Custom HTML block
#   http://localhost:8092/s/annoudio/page/demo  Omeka S, HTML block
# The Phase 2 pages "player" (setup.sh) stay as they are: embed/tests/hosts.spec.ts needs
# them on the embed fixture server (port 4510, recording rec-0042).
#
# The script also adds the host origins to the project's websites (REST, as the operator),
# so that the Annotate page sends members back to these pages.
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
OPERATOR_EMAIL="${OPERATOR_EMAIL:-operator@example.org}"
OPERATOR_PASSWORD="${OPERATOR_PASSWORD:-demo-operator-pass-1}"
HOST_ORIGINS=(http://localhost:8091 http://127.0.0.1:8091 http://localhost:8092 http://127.0.0.1:8092)
# The snippet of the admin's Snippet panel (app/src/modules/catalogue snippet()).
demo_snippet="<script async src=\"$ORIGIN/embed/v1.js\"></script>
<annoudio-player project=\"$PROJECT\" recording=\"$RECORDING\" src=\"$AUDIO\"></annoudio-player>"

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
# The demo page: the snippet, pasted by the administrator (unfiltered_html) in a Custom HTML block.
demo_content="<!-- wp:html -->
${demo_snippet}
<!-- /wp:html -->"
id=$(wp post list --post_type=page --name=demo --field=ID --format=ids)
if [ -z "$id" ]; then
  wp post create --post_type=page --post_status=publish --post_title="Ferry crossing, 1962" \
    --post_name=demo --user=admin --post_content="$demo_content" >/dev/null
else
  wp post update "$id" --user=admin --post_content="$demo_content" >/dev/null
fi
echo "WordPress demo page: http://localhost:8091/?pagename=demo"

echo "== Omeka S"
omeka() { "${compose[@]}" exec -T omeka "$@"; }
# The demo page: the snippet in an HTML block. Omeka purifies at save, so the save runs with
# the purifier off; omeka-plugins.php below turns it on again.
printf '%s' "$demo_snippet" | omeka php /opt/annoudio/omeka-page.php demo off >/dev/null
echo "Omeka S demo page: http://localhost:8092/s/annoudio/page/demo"
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

echo "== Demo stack: the host origins on the websites of $PROJECT"
token=$(curl -fsS -X POST "$ORIGIN/api/users/login" -H 'content-type: application/json' \
  -d "$(jq -n --arg e "$OPERATOR_EMAIL" --arg p "$OPERATOR_PASSWORD" '{email: $e, password: $p}')" | jq -r .token)
project=$(curl -gfsS "$ORIGIN/api/projects?where[slug][equals]=$PROJECT&depth=0&limit=1" \
  -H "Authorization: JWT $token" | jq '.docs[0]')
# Keep the rows that are there (with their ids); add the missing origins at the end.
rows=$(jq -c '(.siteOrigins // []) as $have
  | $have + ($ARGS.positional - [$have[].origin] | map({origin: .}))' \
  --args "${HOST_ORIGINS[@]}" <<<"$project")
curl -fsS -X PATCH "$ORIGIN/api/projects/$(jq -r .id <<<"$project")" -H "Authorization: JWT $token" \
  -H 'content-type: application/json' -d "{\"siteOrigins\": $rows}" | jq -r '"Websites: " + ([.doc.siteOrigins[].origin] | join(" "))'
