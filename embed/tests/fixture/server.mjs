// Fixture server for the player tests. Two origins:
//   STACK  http://localhost:4510  the organisation's stack: loader, bundle, themes, stories, media
//   HOST   http://127.0.0.1:4520  host pages (another site, so every stack request is cross-origin)
// It sends the headers of CONTRACT 5.1 and design C 1.1.
// Use: node tests/fixture/server.mjs

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseProject, RECORDINGS, representation, SLOW_THEME_MS, THEMES } from "./data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const EMBED_OUT = resolve(here, "../../../app/public/embed");
const STACK_PORT = Number(process.env.STACK_PORT ?? 4510);
const HOST_PORT = Number(process.env.HOST_PORT ?? 4520);
export const STACK = `http://localhost:${STACK_PORT}`;
export const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** Every request to the stack, for tests that check headers and preflights. */
const log = [];

const COMMON = {
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
};
const STORY_TYPE = 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"';

const etag = (body) => `"${createHash("sha1").update(body).digest("hex")}"`;

function send(req, res, status, headers, body = "") {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const tag = headers.ETag;
  if (tag && status === 200 && req.headers["if-none-match"] === tag) {
    const { "Content-Length": _drop, ...rest } = headers;
    res.writeHead(304, rest);
    return res.end();
  }
  res.writeHead(status, { "Content-Length": buffer.length, ...headers });
  res.end(req.method === "HEAD" ? undefined : buffer);
}

function serveEmbed(req, res, path) {
  if (path === "/embed/v1.js") {
    const file = join(EMBED_OUT, "v1.js");
    if (!existsSync(file)) return send(req, res, 404, COMMON, "run pnpm build first");
    const body = readFileSync(file);
    return send(req, res, 200, {
      ...COMMON,
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ETag: etag(body),
    }, body);
  }
  const bundle = /^\/embed\/v1\/([0-9a-f]{12})\/player\.js$/.exec(path);
  if (bundle) {
    const file = join(EMBED_OUT, "v1", bundle[1], "player.js");
    if (!existsSync(file)) return send(req, res, 404, COMMON, "");
    return send(req, res, 200, {
      ...COMMON,
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    }, readFileSync(file));
  }
  const theme = /^\/embed\/v1\/themes\/([^/]+)\.json$/.exec(path);
  if (theme) {
    const project = baseProject(decodeURIComponent(theme[1]));
    const data = project ? THEMES[project] : undefined;
    if (!data) {
      return send(req, res, 404, { ...COMMON, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }, '{"error":"not found"}');
    }
    const body = JSON.stringify(data);
    const reply = () => send(req, res, 200, {
      ...COMMON,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      ETag: etag(body),
    }, body);
    if (project === "slow") return void setTimeout(reply, SLOW_THEME_MS);
    return reply();
  }
  return send(req, res, 404, COMMON, "");
}

function serveStories(req, res, url) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag, Link, Allow, Vary" };
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Prefer, If-None-Match",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }
  const notFound = () =>
    send(req, res, 404, { ...cors, "Content-Type": "application/problem+json", "Cache-Control": "public, max-age=60" },
      '{"type":"about:blank","title":"Not Found","status":404}');
  const match = /^\/stories\/([^/]+)\/([^/]+)\/$/.exec(url.pathname);
  if (!match) return notFound();
  const project = decodeURIComponent(match[1]);
  const recording = decodeURIComponent(match[2]);
  if (!baseProject(project)) return notFound();
  if (recording === "rec-broken") return send(req, res, 500, { ...cors, "Content-Type": "text/plain" }, "boom");
  if (recording === "rec-notcontainer") {
    return send(req, res, 200, { ...cors, "Content-Type": "application/json" }, '{"hello":"world"}');
  }
  if (!RECORDINGS[recording]) return notFound();
  const pageParam = url.searchParams.get("page");
  const page = pageParam === null ? null : Number(pageParam);
  const body = representation(STACK, project, recording, page);
  if (!body) return notFound();
  const text = JSON.stringify(body);
  const links = ['<http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"'];
  if (page === null) links.unshift('<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"');
  return send(req, res, 200, {
    ...cors,
    "Content-Type": STORY_TYPE,
    ETag: etag(text),
    Link: links.join(", "),
    Allow: "GET, HEAD, OPTIONS",
    Vary: "Prefer",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
  }, text);
}

const TONE = readFileSync(join(here, "media/tone.m4a"));

/** The media bodies of rec-media: CORS, ranges and a year of cache, as the app serves them. */
const BODIES = {
  "/media/voice.m4a": "audio/mp4",
  "/media/photo.jpg": "image/jpeg",
  "/media/clip.mp4": "video/mp4",
};

function serveBody(req, res, path) {
  const bytes = readFileSync(join(here, path.slice(1)));
  const headers = {
    "Content-Type": BODIES[path],
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
  const chunk = bytes.subarray(start, end + 1);
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${bytes.length}`;
  res.writeHead(range ? 206 : 200, { ...headers, "Content-Length": chunk.length });
  res.end(req.method === "HEAD" ? undefined : chunk);
}

function serveMedia(req, res, path) {
  if (BODIES[path]) return serveBody(req, res, path);
  const variants = {
    "/media/tone.m4a": { cors: true, length: true },
    "/media/tone-nolength.m4a": { cors: true, length: false },
    "/media/tone-nocors.m4a": { cors: false, length: true },
  };
  const variant = variants[path];
  if (!variant) return send(req, res, 404, COMMON, "");
  const headers = { "Content-Type": "audio/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  if (variant.cors) headers["Access-Control-Allow-Origin"] = "*";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] === "" ? Math.max(0, TONE.length - Number(range[2])) : Number(range[1]);
    const end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), TONE.length - 1) : TONE.length - 1;
    if (start >= TONE.length) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${TONE.length}` });
      return res.end();
    }
    const chunk = TONE.subarray(start, end + 1);
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${TONE.length}`, "Content-Length": chunk.length });
    return res.end(req.method === "HEAD" ? undefined : chunk);
  }
  if (!variant.length) {
    // Chunked transfer: no Content-Length. The player must skip the waveform.
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    res.write(TONE.subarray(0, 40000));
    return void setTimeout(() => res.end(TONE.subarray(40000)), 20);
  }
  res.writeHead(200, { ...headers, "Content-Length": TONE.length });
  res.end(req.method === "HEAD" ? undefined : TONE);
}

const stack = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", STACK);
  if (url.pathname === "/__log") {
    if (req.method === "DELETE") log.length = 0;
    return send(req, res, 200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, JSON.stringify(log));
  }
  log.push({
    method: req.method,
    path: url.pathname,
    search: url.search,
    cookie: req.headers.cookie ?? null,
    prefer: req.headers.prefer ?? null,
    accept: req.headers.accept ?? null,
    origin: req.headers.origin ?? null,
    range: req.headers.range ?? null,
  });
  try {
    if (url.pathname.startsWith("/embed/")) return serveEmbed(req, res, url.pathname);
    if (url.pathname.startsWith("/stories/")) return serveStories(req, res, url);
    if (url.pathname.startsWith("/media/")) return serveMedia(req, res, url.pathname);
    return send(req, res, 404, {}, "");
  } catch (error) {
    console.error(error);
    return send(req, res, 500, {}, String(error));
  }
});

const PAGES = join(here, "pages");

const host = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", HOST);
  const name = url.pathname === "/" ? "/bare.html" : url.pathname;
  if (name === "/host.css") {
    return send(req, res, 200, { "Content-Type": "text/css" }, readFileSync(join(PAGES, "host.css")));
  }
  const file = join(PAGES, name);
  if (!file.startsWith(PAGES) || !existsSync(file) || !statSync(file).isFile() || !file.endsWith(".html")) {
    return send(req, res, 404, { "Content-Type": "text/plain" }, "not found");
  }
  const html = readFileSync(file, "utf8").replaceAll("{{STACK}}", STACK);
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (name.startsWith("/csp-")) {
    headers["Content-Security-Policy"] =
      `default-src 'none'; script-src ${STACK}; connect-src ${STACK}; media-src ${STACK}; ` +
      `style-src 'self'; img-src 'self'`;
  }
  return send(req, res, 200, headers, html);
});

stack.listen(STACK_PORT, () => console.log(`stack ${STACK}`));
host.listen(HOST_PORT, () => console.log(`host  ${HOST}`));
