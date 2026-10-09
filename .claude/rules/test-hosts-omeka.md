---
scope: deploy/test-hosts/**
tags: [docker, omeka, hazard]
priority: medium
source: hand-written
---
Omeka S in the test image installs with EMPTY file allowlists and reads settings
from a cache in command-line runs. `omeka-plugins.php` sets the default allowlists
and empties the cache; keep both steps when you change it. A recreated host
container leaves the `annoudio-demo_default` network: run `install-plugins.sh` again.
