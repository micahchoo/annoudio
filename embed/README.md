# Annoudio embed: the `player` module

This package is the **player**: the `<annoudio-player>` custom element and its loader, `/embed/v1.js`. A host site pastes the **snippet** and the player shows the published **stories** of one **instance** on a timeline. `CONTRACT.md` (in the repository root) is the interface of this module. This package is the implementation.

The element is a plain custom element, not Lit: the player has one element and no reactive templates, and every kilobyte counts against the 80 KB bundle limit.

## Output

The build writes two files into `../app/public/embed/`. The app serves them.

| File | What it is | Cache |
|---|---|---|
| `v1.js` | The loader. A classic script, about 0.8 KB after gzip. It names the current bundle. | 300 s, then revalidate |
| `v1/<hash>/player.js` | The bundle. An ES module with wavesurfer.js inside, about 30 KB after gzip. | One year, `immutable` |

## Build

```sh
pnpm install
pnpm build        # writes ../app/public/embed/
pnpm typecheck
pnpm lint
```

The build fails when the loader is larger than 1 KB or the bundle is larger than 80 KB after gzip (CONTRACT 10, rule 1).

## How the hash and the caches work

1. The build makes the bundle first. The hash is the first 12 hex digits of the SHA-256 of the bundle bytes. The same source gives the same hash.
2. The build writes the bundle to `v1/<hash>/player.js`. Then it writes the hash into the loader.
3. A browser keeps `v1.js` for 300 s. After that, it asks again and gets the loader with the new hash. Then it imports the new bundle.
4. A browser keeps a bundle for one year. A bundle URL never changes its content, so this is safe.
5. A cached loader can name an old hash for up to 3900 s (300 s plus 3600 s `stale-while-revalidate`). So the build keeps the two bundles before the current one and deletes older ones (CONTRACT 5.1).

The app sends the headers of CONTRACT 5.1 for these paths (`app/next.config.ts`). The test fixture server sends the same headers.

Hosts must never link to a bundle URL. Only `v1.js` is stable.

## Test

The tests are Playwright tests in Chromium, Firefox and WebKit. They use only the public surface of the player: attributes, `part` names, tokens, `annoudio:*` events, `seek()`, `currentTime` and the network.

The tests play a tone. On Linux, headless browsers still send sound to PulseAudio, so `playwright.config.ts` silences them: Chromium (`--mute-audio`) and WebKit get the environment `PULSE_SERVER=/nonexistent` and open no stream. Firefox stops playback without an audio device, so it plays at `media.volume_scale` 0: `pactl list sink-inputs` shows a silent Firefox stream while a test runs.

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test
```

`pnpm test` builds the player and starts the fixture server. If a fixture server already runs, the tests use it.

| File | What it tests |
|---|---|
| `tests/contract.spec.ts` | Each test of CONTRACT section 16. |
| `tests/player.spec.ts` | Two players, the theme cascade, the 500 ms rule, paging, the waveform, bodies, attributes, lifecycle, `seek()`, motion, reflow, target size, CSP, size, globals. |
| `tests/hosts.spec.ts` | The snippet pasted by hand into a static page, a WordPress page and an Omeka S page. |

### The fixture server

`tests/fixture/server.mjs` has two origins, so every request from a host page to the stack is cross-origin:

- `http://localhost:4510` is the stack. It serves the loader, the bundle, the theme JSON, the stories containers and the audio.
- `http://127.0.0.1:4520` serves the host pages in `tests/fixture/pages/`.

`tests/fixture/data.mjs` holds the stories containers. Their shape is the shape of `design/stories-interface-C-common-caller.md` sections 1.1 and 1.2. In `rec-0042`, Asha's story has two replies under `annoudio:replies` (CONTRACT 6, rule 12), with the extension context of the stack. The audio is 10 s of tone (`tests/fixture/media/tone.m4a`), made with:

```sh
ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -af "volume=0.5" -ac 1 -ar 44100 -c:a aac -b:a 64k tone.m4a
```

### The host pages (WordPress and Omeka S)

`tests/hosts.spec.ts` needs the test hosts. If they do not run, those tests are skipped with a message.

```sh
deploy/test-hosts/setup.sh     # from the repository root
```

The script starts the compose stack `annoudio-hosts` (`deploy/test-hosts/docker-compose.yml`). It installs WordPress with WP-CLI and Omeka S with its CLI installer. Then it pastes `deploy/test-hosts/snippet.html` into a WordPress Custom HTML block and an Omeka S page HTML block. WordPress is at `http://localhost:8091/?pagename=player`. Omeka S is at `http://localhost:8092/s/annoudio/page/player`.

Always give compose the file with `-f`. Before `docker compose … down -v`, run `docker compose ls` and make sure that only `annoudio-hosts` is affected.

### WebKit on a machine without root

Playwright's WebKit needs `libmanette-0.2-0` and `libhidapi-hidraw0`. If you cannot run `sudo pnpm exec playwright install-deps`, run:

```sh
scripts/webkit-deps.sh
```

The script downloads the two Ubuntu packages without installing them. It puts the libraries in `.cache/webkit-deps/` and in the WebKit bundle. `playwright.config.ts` adds `.cache/webkit-deps/` to `LD_LIBRARY_PATH`.

## Source map

| File | Job |
|---|---|
| `src/loader.ts` | The loader (CONTRACT 5). Finds its origin, imports the bundle, defines the fallback element when the import fails. |
| `src/player.ts` | The bundle entry: `define(origin)`. |
| `src/element.ts` | `<annoudio-player>`: start and stop, DOM, playback, timeline, Annotate link, return fragment. |
| `src/stories.ts` | Reads the container and its pages, and turns WADM into stories. |
| `src/theme.ts` | Reads the project theme JSON into one constructed stylesheet per project. |
| `src/waveform.ts` | The optional waveform fetch (request 5) and peak reduction. |
| `src/shared.ts` | One request per key per page, shared by players and cancelled when no player waits. |
| `src/styles.ts` | The private CSS, and a copy of wavesurfer.js layout CSS for strict CSP hosts. |
| `src/text.ts` | UI text (English) and error messages. |
