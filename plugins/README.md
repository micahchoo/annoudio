# CMS plugins (Phase 7a, 7b)

Two host plugins print the **snippet** of `CONTRACT.md` §1 from stored data, so the host's HTML filter never sees HTML:

| Folder | Host | Install file | Guide for site maintainers |
|---|---|---|---|
| `wordpress/annoudio/` | WordPress 6.5+, PHP 8.2+ | `dist/annoudio.zip` | `wordpress/README.md` |
| `omeka-s/Annoudio/` | Omeka S 4+, PHP 8.2+ | `dist/Annoudio-omeka-s.zip` | `omeka-s/README.md` |

The site maintainer types one number per block, the recording number from the admin's Snippet panel. The plugins get the title and the audio address from the stack (`CONTRACT.md` §5.2), at page view, with a 5-minute cache. The stack must have that route (Annoudio releases from 2026-10-09).

Design and decisions: `design/phase7a-notes.md`, `design/phase7b-notes.md`.

## Commands

Run from the repository root.

```sh
plugins/build.sh                     # makes plugins/dist/*.zip (no build tools; files ship as they are)
deploy/test-hosts/install-plugins.sh # installs both into the running test hosts, points them at the demo stack
plugins/lint.sh                      # php -l with PHP 8.2, 8.3, 8.5; WordPress Plugin Check
cd plugins/tests && pnpm install && pnpm test   # Playwright, Chromium, muted
```

The tests need: the test hosts (`deploy/test-hosts`, `setup.sh` once), the demo stack `annoudio-demo` (`deploy/DEMO.md`), and `install-plugins.sh` after each change to a plugin. The tests start the media fixture server on port 4610 if it does not run.
