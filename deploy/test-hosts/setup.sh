#!/usr/bin/env bash
# Sets up the two test hosts and pastes snippet.html into one page on each.
# It is safe to run again. It needs the stack from docker-compose.yml in this folder.
# The snippet points at the embed fixture server (embed/tests/fixture/server.mjs, port 4510).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
compose=(docker compose -f "$here/docker-compose.yml")
snippet="$(cat "$here/snippet.html")"

"${compose[@]}" up -d

echo "== WordPress"
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null http://127.0.0.1:8091/wp-admin/install.php && break || sleep 2
done
wp() { "${compose[@]}" run --rm -T wp-cli wp "$@"; }
if ! wp core is-installed 2>/dev/null; then
  wp core install --url=http://localhost:8091 --title="Annoudio test host" \
    --admin_user=admin --admin_password=wp-admin-test --admin_email=admin@example.org --skip-email
fi
# Pasted by an administrator (has unfiltered_html), in a Custom HTML block.
content="<!-- wp:html -->
${snippet}
<!-- /wp:html -->"
id=$(wp post list --post_type=page --name=player --field=ID --format=ids)
if [ -z "$id" ]; then
  wp post create --post_type=page --post_status=publish --post_title="Ferry crossing, 1962" \
    --post_name=player --user=admin --post_content="$content" >/dev/null
else
  wp post update "$id" --user=admin --post_content="$content" >/dev/null
fi
# Pasted by an author (no unfiltered_html): CONTRACT 13 says WordPress removes the script.
wp user get author1 >/dev/null 2>&1 || wp user create author1 author1@example.org --role=author --user_pass=wp-author-test >/dev/null
id=$(wp post list --post_type=post --name=player-by-author --field=ID --format=ids)
[ -n "$id" ] && wp post delete "$id" --force >/dev/null
wp post create --post_type=post --post_status=publish --post_title="Pasted by an author" \
  --post_name=player-by-author --user=author1 --post_content="$content" >/dev/null
echo "WordPress page: $(wp post list --post_type=page --name=player --field=url)"
echo "WordPress post by author: $(wp post list --post_type=post --name=player-by-author --field=url)"

echo "== Omeka S"
for _ in $(seq 1 90); do
  curl -fsS -o /dev/null http://127.0.0.1:8092/login && break || sleep 2
done
omeka() { "${compose[@]}" exec -T omeka "$@"; }
# With the HTML purifier on (the default), then off.
printf '%s' "$snippet" | omeka php /opt/annoudio/omeka-page.php purified on
printf '%s' "$snippet" | omeka php /opt/annoudio/omeka-page.php player off
echo "Omeka S page: http://localhost:8092/s/annoudio/page/player"
