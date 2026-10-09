---
scope: deploy/**
tags: [docker, hazard]
priority: high
source: hand-written
---
Every compose file here MUST set `name: annoudio-<env>`. Without it, compose takes the
project name from the folder (`deploy`), which collides with other repos' `deploy/`
stacks on this machine; on 2026-10-09 a run without `name:` replaced papadam's
`deploy-postgres-1`. Never run `docker compose down -v` from this folder without
checking `docker compose ls` first.
