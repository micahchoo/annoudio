# The Annoudio project site

This folder is the project site, served by GitHub Pages from the `docs/` folder of `main`: https://micahchoo.github.io/annoudio/. It is static: HTML, one CSS file (`site.css`) and the recordings. Nothing runs at serve time.

Do not edit the files here by hand. `scripts/build-docs.mjs` makes all of them again from the sources.

## Rebuild

From the repository root:

```sh
node scripts/build-docs.mjs            # build docs/ and check every internal link
node scripts/build-docs.mjs --preview  # also the screenshots in _preview/ and an axe check
```

The first run installs `marked@15.0.12` into `~/.cache/annoudio-docs/` (needs npm and the network once). `--preview` uses Playwright, its Chromium and `@axe-core/playwright` from `embed/`: run `cd embed && pnpm install` first. The build stops with an error if a link inside the site does not resolve, or if axe finds a violation.

## What comes from where

| Site path | Source |
|---|---|
| `index.html` | `design/concept-map.md` §1 (the table) and §1.1 (the paragraph), `CONTRACT.md` §1 (the snippet), recordings 10, 06, 14 |
| `recordings/` | `design/recordings/`: the table in its README, each `NN-*.md` caption, the `.webm` and `.png` files |
| `design-system/` | `design/design-system/index.html` and `styles.css`, copied as they are |
| `docs/*.html` | `CONTRACT.md`, `CONTEXT.md`, `deploy/GUIDE-dokploy.md`, `deploy/GUIDE-coolify.md`, `deploy/BACKUP.md`, `deploy/UPGRADE.md`, `plugins/wordpress/README.md`, `plugins/omeka-s/README.md`, `design/ia.md`, `design/vocab.md`, `design/UNVERIFIED.md`, `research/architecture-concerns.md` |
| `site.css` | Sections 1–4 of `design/design-system/styles.css` (the tokens, the base and the components), with the dark tokens under `prefers-color-scheme: dark`, and the site styles in the build script |
| `404.html`, `.nojekyll`, this file | The build script |

A link in a Markdown file to another file of this list goes to its page here. A link, or a file name in `code`, to any other file of the repository goes to that file on GitHub.

## Add a page

Add a line to `PAGES` in `scripts/build-docs.mjs` (source, site path, group, title, one line), then rebuild.
