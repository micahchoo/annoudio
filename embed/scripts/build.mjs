// Builds the player into app/public/embed/ (CONTRACT 5):
//   v1.js                    the loader, a classic script, names the current bundle hash
//   v1/<hash>/player.js      the bundle, an ES module, cached for one year
// The hash is the first 12 hex digits of the SHA-256 of the bundle bytes.
// The build keeps the bundles of the two builds before this one (CONTRACT 5.1).

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, process.env.ANNOUDIO_EMBED_OUT ?? "../app/public/embed");
const KEEP_PREVIOUS = 2;
const LOADER_LIMIT = 1024;
const BUNDLE_LIMIT = 80 * 1024;

const player = await esbuild.build({
  entryPoints: [join(root, "src/player.ts")],
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022", "chrome100", "firefox101", "safari16.4"],
  legalComments: "eof", // wavesurfer.js is BSD-3-Clause: keep its notice.
  write: false,
});
const bundle = player.outputFiles[0].contents;
const hash = createHash("sha256").update(bundle).digest("hex").slice(0, 12);
const bundlePath = `/embed/v1/${hash}/player.js`;

const loader = await esbuild.build({
  entryPoints: [join(root, "src/loader.ts")],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2020"],
  define: { __ANNOUDIO_BUNDLE__: JSON.stringify(bundlePath) },
  write: false,
});
const loaderBytes = loader.outputFiles[0].contents;

const versionDir = join(out, "v1");
mkdirSync(join(versionDir, hash), { recursive: true });
writeFileSync(join(versionDir, hash, "player.js"), bundle);
const now = new Date();
utimesSync(join(versionDir, hash), now, now);
writeFileSync(join(out, "v1.js"), loaderBytes);

// Keep the current bundle and the two before it; delete older ones.
const hashes = readdirSync(versionDir)
  .filter((name) => /^[0-9a-f]{12}$/.test(name) && existsSync(join(versionDir, name, "player.js")))
  .map((name) => ({ name, time: statSync(join(versionDir, name)).mtimeMs }))
  .sort((a, b) => b.time - a.time);
for (const old of hashes.filter((h) => h.name !== hash).slice(KEEP_PREVIOUS)) {
  rmSync(join(versionDir, old.name), { recursive: true, force: true });
}

const gzLoader = gzipSync(loaderBytes, { level: 9 }).length;
const gzBundle = gzipSync(bundle, { level: 9 }).length;
console.log(`v1.js                 ${loaderBytes.length} B, ${gzLoader} B gzip (limit ${LOADER_LIMIT})`);
console.log(`v1/${hash}/player.js  ${bundle.length} B, ${gzBundle} B gzip (limit ${BUNDLE_LIMIT})`);
if (gzLoader > LOADER_LIMIT || gzBundle > BUNDLE_LIMIT) {
  console.error("The build is larger than CONTRACT section 10 allows.");
  process.exit(1);
}
