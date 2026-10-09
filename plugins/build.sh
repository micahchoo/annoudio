#!/usr/bin/env bash
# Makes the two install files:
#   dist/annoudio.zip          WordPress: Plugins, Add New, Upload Plugin
#   dist/Annoudio-omeka-s.zip  Omeka S: unzip into the modules folder
# No build tools: the files ship as they are in the repository.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/dist"
rm -f "$here/dist/annoudio.zip" "$here/dist/Annoudio-omeka-s.zip"
(cd "$here/wordpress" && zip -qrX "$here/dist/annoudio.zip" annoudio -x '*.DS_Store')
(cd "$here/omeka-s" && zip -qrX "$here/dist/Annoudio-omeka-s.zip" Annoudio -x '*.DS_Store')
ls -l "$here/dist"
