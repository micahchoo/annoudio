#!/usr/bin/env node
// Builds the project site in docs/ (GitHub Pages, served from docs/ on main).
//
//   node scripts/build-docs.mjs            build docs/ and check every internal link
//   node scripts/build-docs.mjs --preview  also screenshot (docs/_preview/) and run axe,
//                                          with Playwright from embed/ (cd embed && pnpm install)
//
// The output is static: HTML, one CSS file, the recordings. Nothing runs at serve time.
// Sources: the Markdown files in PAGES, design/recordings/, design/design-system/,
// design/concept-map.md (§1 and §1.1), CONTRACT.md §1. Do not edit docs/ by hand.

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const REPO = 'https://github.com/micahchoo/annoudio';
const BLOB = `${REPO}/blob/main/`;
const BASE = '/annoudio/'; // the Pages path; only 404.html uses absolute links
const BUILT = 'Built 2026-10';
const MARKED = '15.0.12';

// ---------- marked: a pinned copy in a cache folder, installed once ----------
async function loadMarked() {
  const dir = path.join(os.homedir(), '.cache', 'annoudio-docs');
  const entry = path.join(dir, 'node_modules', 'marked', 'lib', 'marked.esm.js');
  const pkg = path.join(dir, 'node_modules', 'marked', 'package.json');
  const have = fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf8')).version === MARKED;
  if (!have) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', dir, `marked@${MARKED}`], { stdio: 'inherit' });
  }
  return (await import(pathToFileURL(entry).href)).Marked;
}

// ---------- the pages made from Markdown ----------
// src: repo path; out: site path; group: the docs hub section.
const PAGES = [
  { src: 'CONTRACT.md', out: 'docs/contract.html', group: 'Reference', title: 'Embed contract', blurb: 'The snippet, the widget attributes and theme tokens, the public routes.' },
  { src: 'CONTEXT.md', out: 'docs/context.html', group: 'Reference', title: 'Context and words', blurb: 'The ubiquitous language, the fixed decisions, the module map.' },
  { src: 'deploy/GUIDE-dokploy.md', out: 'docs/deploy-dokploy.html', group: 'Deploy', title: 'Run with Dokploy', blurb: 'The recommended way: one stack on your own server, with backup and restore screens.' },
  { src: 'deploy/GUIDE-coolify.md', out: 'docs/deploy-coolify.html', group: 'Deploy', title: 'Run with Coolify', blurb: 'For an organisation that already uses Coolify.' },
  { src: 'deploy/BACKUP.md', out: 'docs/backup.html', group: 'Deploy', title: 'Backup and restore', blurb: 'What to back up, how often, and how to restore it.' },
  { src: 'deploy/UPGRADE.md', out: 'docs/upgrade.html', group: 'Deploy', title: 'Upgrade', blurb: 'How to move a stack to a new release.' },
  { src: 'plugins/wordpress/README.md', out: 'docs/plugin-wordpress.html', group: 'Plugins', title: 'WordPress block', blurb: 'The block that writes the snippet from a recording number.' },
  { src: 'plugins/omeka-s/README.md', out: 'docs/plugin-omeka-s.html', group: 'Plugins', title: 'Omeka S module', blurb: 'The page block that writes the snippet from a recording number.' },
  { src: 'design/ia.md', out: 'docs/ia.html', group: 'Design', title: 'Information architecture', blurb: 'Every screen of the admin, the Annotate page, the widget and the mails.' },
  { src: 'design/vocab.md', out: 'docs/vocab.html', group: 'Design', title: 'Questions and lists', blurb: 'The vocabulary design: questions, answers, lists and items.' },
  { src: 'design/UNVERIFIED.md', out: 'docs/unverified.html', group: 'Design', title: 'Not verified yet', blurb: 'The items that no test has checked yet.' },
  { src: 'research/architecture-concerns.md', out: 'docs/architecture-concerns.html', group: 'Design', title: 'Architecture concerns', blurb: 'The research notes behind the architecture decisions.' },
];
const GROUPS = ['Deploy', 'Plugins', 'Reference', 'Design'];
const bySrc = new Map(PAGES.map((p) => [p.src, p]));

// ---------- the recordings ----------
const REC_DIR = path.join(ROOT, 'design', 'recordings');
const ROLE_GROUPS = [
  { id: 'operator', name: 'Operator', line: 'A person of the team. Works in the admin, on a laptop.', match: (r) => r.role.startsWith('Operator') },
  { id: 'member', name: 'Member', line: 'A person of the community. Tells stories on the Annotate page, on a phone.', match: (r) => r.role.startsWith('Member') },
  { id: 'visitor', name: 'Visitor', line: 'Anyone on the site. Plays the recording and reads the stories in the widget.', match: (r) => r.role === 'Visitor' },
  { id: 'maintainer', name: 'Site maintainer', line: 'Puts the widget on a site: a plugin, or the snippet by hand.', match: (r) => r.role === 'Site maintainer' },
];

// ---------- helpers ----------
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[`*_~]/g, '')
  .replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
const rel = (fromOut, toOut) => {
  const r = path.posix.relative(path.posix.dirname(fromOut), toOut);
  return r === '' ? path.posix.basename(toOut) : r;
};
const write = (out, text) => {
  const p = path.join(OUT, out);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const copy = (from, out) => {
  const p = path.join(OUT, out);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), p);
};

// A repo path (or a path relative to the source file) → a site link, a GitHub link, or null.
function resolveRepoLink(target, srcFile, outFile) {
  const [p, hash] = target.split('#');
  if (!p || p.startsWith('/')) return null; // an absolute path is a setting value, not a repo link
  const cands = [path.posix.normalize(path.posix.join(path.posix.dirname(srcFile), p)), path.posix.normalize(p)];
  for (const c of cands) {
    const clean = c.replace(/\/$/, '');
    const page = bySrc.get(clean);
    if (page) return rel(outFile, page.out) + (hash ? `#${hash}` : '');
    if (clean === 'design/recordings' || clean === 'design/recordings/README.md') return rel(outFile, 'recordings/index.html');
    if (clean === 'design/design-system/index.html') return rel(outFile, 'design-system/index.html');
    if (!clean.startsWith('..') && fs.existsSync(path.join(ROOT, clean))) {
      const isDir = fs.statSync(path.join(ROOT, clean)).isDirectory();
      return `${REPO}/${isDir ? 'tree' : 'blob'}/main/${clean}` + (hash ? `#${hash}` : '');
    }
  }
  return null;
}

// ---------- Markdown → HTML ----------
function makeRenderer(Marked) {
  return (md, srcFile, outFile, toc) => {
    const seen = new Map();
    const m = new Marked({ gfm: true });
    m.use({
      renderer: {
        heading({ tokens, depth, text }) {
          const inner = this.parser.parseInline(tokens);
          let id = slug(text);
          const n = seen.get(id) ?? 0;
          seen.set(id, n + 1);
          if (n) id = `${id}-${n}`;
          if (toc && depth === 2) toc.push({ id, html: inner });
          return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
        },
        link({ href, title, tokens }) {
          const inner = this.parser.parseInline(tokens);
          let h = href;
          if (!/^([a-z]+:|#|\/)/i.test(href)) h = resolveRepoLink(href, srcFile, outFile) ?? href;
          return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ''}>${inner}</a>`;
        },
        image({ href, text }) {
          let h = href;
          if (!/^([a-z]+:|\/)/i.test(href)) {
            const from = path.posix.normalize(path.posix.join(path.posix.dirname(srcFile), href));
            const to = `assets/${from.replace(/\//g, '_')}`;
            copy(from, to);
            h = rel(outFile, to);
          }
          return `<img src="${esc(h)}" alt="${esc(text)}" loading="lazy">`;
        },
        codespan({ text }) {
          // `path/to/FILE.md` → a link to its page here, or to the file on GitHub. marked gives the raw text.
          const mm = text.match(/^([\w./-]+\.(?:md|html|ya?ml|mjs|ts|sh|json|example))$/);
          const link = mm && resolveRepoLink(mm[1], srcFile, outFile);
          return link ? `<a href="${esc(link)}"><code>${esc(text)}</code></a>` : `<code>${esc(text)}</code>`;
        },
      },
    });
    let html = m.parse(md);
    // Wide tables and code scroll inside their own box; the box is keyboard-focusable.
    // Each box is a region named after the heading above it, so that every name is unique.
    let lastHeading = 'the page';
    const used = new Map();
    html = html.replace(/<h[1-6] id="[^"]*">([\s\S]*?)<\/h[1-6]>|<table>/g, (m, heading) => {
      if (heading !== undefined) { lastHeading = heading.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').trim(); return m; }
      const n = (used.get(lastHeading) ?? 0) + 1;
      used.set(lastHeading, n);
      return `<div class="scroll" tabindex="0" role="region" aria-label="${esc(`Table${n > 1 ? ` ${n}` : ''} in ${lastHeading}`)}"><table>`;
    }).replace(/<\/table>/g, '</table></div>');
    html = html.replace(/<pre>/g, '<pre tabindex="0">');
    return html;
  };
}

// ---------- layout ----------
const NAV = [
  ['Annoudio', 'index.html', 'home'],
  ['Recordings', 'recordings/index.html', 'recordings'],
  ['Design system', 'design-system/index.html', 'design-system'],
  ['Contract', 'docs/contract.html', 'contract'],
  ['Deploy', 'docs/index.html#deploy', 'deploy'],
  ['Plugins', 'docs/index.html#plugins', 'plugins'],
];

function layout({ out, title, description, current, body, wide = false, absolute = false }) {
  const href = (to) => (absolute ? BASE + to.replace(/index\.html$/, '') : rel(out, to));
  const nav = NAV.map(([label, to, key]) => {
    const cls = key === 'home' ? ' class="site-brand"' : '';
    const cur = key === current ? ' aria-current="page"' : '';
    return `<li><a${cls} href="${href(to)}"${cur}>${label}</a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${href('site.css')}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10" stroke="#0b6e99" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>')}">
</head>
<body class="ao ao-member">
<a class="skip" href="#main">Skip to the content</a>
<header class="site-header">
<nav aria-label="Site"><ul>${nav}<li><a href="${REPO}">GitHub</a></li></ul></nav>
</header>
<main id="main" class="site-main${wide ? ' site-main--wide' : ''}">
${body}
</main>
<footer class="site-footer">
<p>Annoudio is free software under the <a href="${BLOB}LICENSE">MIT licence</a>. Source: <a href="${REPO}">github.com/micahchoo/annoudio</a>. ${BUILT}.</p>
</footer>
</body>
</html>
`;
}

// ---------- CSS: the design-system tokens + light/dark by the system setting + the site ----------
function buildCss() {
  const ds = read('design/design-system/styles.css');
  const tokens = ds.slice(ds.indexOf('/* 1.'), ds.indexOf('/* The member pages'));
  const member = ds.slice(ds.indexOf('/* The member pages'), ds.indexOf('/* 3. Base */'));
  const base = ds.slice(ds.indexOf('/* 3. Base */'), ds.indexOf('/* 5. Style guide page only'));
  // The style guide switches with [data-theme="dark"]; the site follows prefers-color-scheme.
  const dark = [...tokens.matchAll(/\[data-theme="dark"\]\s*\{([^}]*)\}/g)].map((m) => m[1].trim()).join('\n  ');
  return `/* Annoudio site. Generated by scripts/build-docs.mjs from design/design-system/styles.css. Do not edit. */

${tokens}
@media (prefers-color-scheme: dark) {
  :root {
  ${dark}
  }
}

${member}
${base}
/* Site (not part of the design system) */
html { background: var(--ao-bg); scroll-padding-top: var(--ao-space-4); }
body { margin: 0; background: var(--ao-bg); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.skip { position: absolute; left: var(--ao-space-3); top: -4rem; padding: var(--ao-space-2) var(--ao-space-3); border-radius: var(--ao-radius-m); background: var(--ao-accent); color: var(--ao-on-accent); z-index: 10; }
.skip:focus { top: var(--ao-space-3); }

.site-header { border-bottom: 1px solid var(--ao-border); background: var(--ao-bg); }
.site-header ul { display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--ao-space-1); margin: 0 auto; padding: var(--ao-space-2) var(--ao-space-4); max-width: 72rem; list-style: none; }
.site-header li:first-child { margin-inline-end: auto; }
.site-header a { display: inline-flex; align-items: center; min-height: var(--ao-hit); padding: 0 var(--ao-space-2); border-radius: var(--ao-radius-m); color: var(--ao-text); text-decoration: none; font-size: var(--ao-text-sm); }
@media (hover: hover) { .site-header a:hover { background: var(--ao-surface-hover); } }
.site-header a[aria-current="page"] { color: var(--ao-accent-text); font-weight: 600; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 0.4em; }
.site-header .site-brand { font-size: var(--ao-text-lg); font-weight: 700; padding-inline-start: 0; letter-spacing: -0.01em; }
@media (max-width: 40rem) {
  .site-header ul { padding-inline: var(--ao-space-3); }
  .site-header li:first-child { flex-basis: 100%; }
  .site-header a { min-height: 36px; padding-inline: 6px; }
  .site-header li:nth-child(2) a { padding-inline-start: 0; }
}

.site-main { max-width: 48rem; margin: 0 auto; padding: var(--ao-space-6) var(--ao-space-4) var(--ao-space-7); }
.site-main--wide { max-width: 72rem; }
.site-footer { border-top: 1px solid var(--ao-border); color: var(--ao-text-muted); font-size: var(--ao-text-sm); }
.site-footer p { max-width: 72rem; margin: 0 auto; padding: var(--ao-space-5) var(--ao-space-4); }

/* Prose (rendered Markdown and the landing page) */
.prose { min-width: 0; }
.prose > * + * { margin-block-start: var(--ao-space-4); }
.prose :where(h1) { font-size: var(--ao-text-2xl); letter-spacing: -0.01em; }
.prose :where(h2) { font-size: var(--ao-text-xl); margin-block-start: var(--ao-space-7); padding-block-start: var(--ao-space-4); border-top: 1px solid var(--ao-border); }
.prose :where(h3) { font-size: var(--ao-text-lg); margin-block-start: var(--ao-space-6); }
.prose :where(h4) { font-size: var(--ao-text-md); margin-block-start: var(--ao-space-5); }
.prose :where(p, li) { max-width: 70ch; }
.prose a { overflow-wrap: anywhere; }
.prose :where(ul, ol) { padding-inline-start: 1.5em; margin-block-end: 0; }
.prose :where(li + li, li > ul, li > ol) { margin-block-start: var(--ao-space-1); }
.prose :where(blockquote) { margin-inline: 0; padding: var(--ao-space-3) var(--ao-space-4); border-inline-start: 3px solid var(--ao-accent); background: var(--ao-surface-sunken); border-radius: 0 var(--ao-radius-m) var(--ao-radius-m) 0; }
.prose :where(blockquote) > * + * { margin-block-start: var(--ao-space-2); }
.prose :where(hr) { border: 0; border-top: 1px solid var(--ao-border); }
.prose :where(img) { max-width: 100%; height: auto; border-radius: var(--ao-radius-m); }
:where(code) { font-family: var(--ao-font-mono); font-size: 0.875em; padding: 0.1em 0.3em; border-radius: var(--ao-radius-s); background: var(--ao-surface-sunken); box-shadow: inset 0 0 0 1px var(--ao-border); overflow-wrap: anywhere; }
pre { margin: 0; padding: var(--ao-space-3) var(--ao-space-4); overflow-x: auto; border-radius: var(--ao-radius-m); background: var(--ao-surface-sunken); box-shadow: inset 0 0 0 1px var(--ao-border); font-size: var(--ao-text-sm); line-height: 1.55; }
pre code { padding: 0; background: none; box-shadow: none; font-size: inherit; overflow-wrap: normal; }
.scroll { overflow-x: auto; border-radius: var(--ao-radius-m); box-shadow: inset 0 0 0 1px var(--ao-border); }
:where(.scroll, pre):focus-visible { outline: 2px solid var(--ao-focus); outline-offset: 2px; }
table { border-collapse: collapse; width: 100%; font-size: var(--ao-text-sm); }
th, td { padding: var(--ao-space-2) var(--ao-space-3); text-align: start; vertical-align: top; border-bottom: 1px solid var(--ao-border); }
th { background: var(--ao-surface-sunken); font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td { min-width: 8rem; }
td:first-child { min-width: 6rem; }

/* Document pages: a side list of the documents, then the text */
.doc { display: grid; gap: var(--ao-space-6); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 64rem) { .doc { grid-template-columns: 15rem minmax(0, 1fr); } .doc__side { position: sticky; top: var(--ao-space-4); align-self: start; max-height: calc(100vh - 2 * var(--ao-space-4)); overflow-y: auto; } }
.doc__side { font-size: var(--ao-text-sm); display: grid; gap: var(--ao-space-4); align-content: start; }
.doc__side h2 { font-size: var(--ao-text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--ao-text-muted); margin-block-end: var(--ao-space-1); }
.doc__side ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.doc__side a { display: block; padding: 4px var(--ao-space-2); border-radius: var(--ao-radius-s); text-decoration: none; color: var(--ao-text); }
@media (hover: hover) { .doc__side a:hover { background: var(--ao-surface-hover); } }
.doc__side a[aria-current="page"] { background: var(--ao-accent-subtle); color: var(--ao-accent-text); font-weight: 600; }
.doc__src { font-size: var(--ao-text-sm); color: var(--ao-text-muted); }
.toc { padding: var(--ao-space-3) var(--ao-space-4); border-radius: var(--ao-radius-m); background: var(--ao-surface-sunken); font-size: var(--ao-text-sm); }
.toc summary { cursor: pointer; font-weight: 600; }
.toc ol { margin: var(--ao-space-2) 0 0; padding-inline-start: 1.25em; columns: 2 16rem; }
.toc li { break-inside: avoid; }

/* Landing */
.hero { display: grid; gap: var(--ao-space-4); padding-block-end: var(--ao-space-5); }
.hero h1 { font-size: clamp(2rem, 6vw, 3rem); letter-spacing: -0.02em; line-height: 1.05; }
.hero__lead { font-size: var(--ao-text-lg); color: var(--ao-text); max-width: 60ch; }
.hero__about { color: var(--ao-text-muted); max-width: 65ch; }
.roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--ao-space-3); margin: 0; padding: 0; list-style: none; }
.roles li { padding: var(--ao-space-4); border-radius: var(--ao-radius-l); background: var(--ao-surface); box-shadow: var(--ao-shadow-card); max-width: none; }
.roles b { display: block; margin-block-end: var(--ao-space-1); }
.section-lead { color: var(--ao-text-muted); }

/* Videos */
.videos { display: grid; gap: var(--ao-space-5); grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); align-items: start; }
.videos--landing { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 40rem) { .videos--landing .video--phone { grid-template-columns: 15rem minmax(0, 1fr); gap: var(--ao-space-5); align-items: start; } }
.video { display: grid; gap: var(--ao-space-2); margin: 0; min-width: 0; }
.video video { width: 100%; height: auto; display: block; border-radius: var(--ao-radius-m); background: #000; box-shadow: var(--ao-shadow-card); }
.video--phone video { max-width: 15rem; }
.video figcaption { display: grid; gap: var(--ao-space-1); font-size: var(--ao-text-sm); }
.video .video__title { font-size: var(--ao-text-md); margin: 0; padding: 0; border: 0; }
.video__workflow { color: var(--ao-text); }
.video__meta { color: var(--ao-text-muted); font-variant-numeric: tabular-nums; }
.video__text > * + * { margin-block-start: var(--ao-space-2); }
.video__text ul { padding-inline-start: 1.25em; margin: 0; }
.rec-group { display: grid; gap: var(--ao-space-4); margin-block-start: var(--ao-space-7); }
.rec-group > h2 { font-size: var(--ao-text-xl); }
.rec-jump { display: flex; flex-wrap: wrap; gap: var(--ao-space-2); margin: 0; padding: 0; list-style: none; }

/* Docs hub */
.hub { display: grid; gap: var(--ao-space-3); margin: 0; padding: 0; list-style: none; }
.hub a { font-weight: 600; }
.hub p { color: var(--ao-text-muted); font-size: var(--ao-text-sm); }
`;
}

// ---------- pages ----------
function sideNav(out) {
  return GROUPS.map((g) => {
    const items = PAGES.filter((p) => p.group === g).map((p) =>
      `<li><a href="${rel(out, p.out)}"${p.out === out ? ' aria-current="page"' : ''}>${esc(p.title)}</a></li>`).join('');
    return `<div><h2>${g}</h2><ul>${items}</ul></div>`;
  }).join('\n');
}

function buildDocPages(render) {
  for (const p of PAGES) {
    const md = read(p.src);
    const toc = [];
    const html = render(md, p.src, p.out, toc);
    const tocHtml = toc.length >= 4
      ? `<details class="toc"><summary>On this page (${toc.length} sections)</summary><ol>${toc.map((t) => `<li><a href="#${t.id}">${t.html.replace(/<a [^>]*>|<\/a>/g, '')}</a></li>`).join('')}</ol></details>`
      : '';
    const firstPara = (md.split('\n\n').find((b) => b && !b.startsWith('#')) ?? p.blurb).replace(/[`*_[\]]/g, '').slice(0, 200);
    const body = `<div class="doc">
<nav class="doc__side" aria-label="Documents">${sideNav(p.out)}</nav>
<article class="prose">
<p class="doc__src">From <a href="${BLOB}${p.src}"><code>${p.src}</code></a> in the repository.</p>
${tocHtml}
${html}
</article>
</div>`;
    const h1 = md.match(/^# (.+)$/m)?.[1]?.replace(/[`*]/g, '') ?? p.title;
    write(p.out, layout({ out: p.out, title: `${h1} · Annoudio`, description: firstPara, current: p.out === 'docs/contract.html' ? 'contract' : p.group.toLowerCase(), body, wide: true }));
  }
  // The hub
  const out = 'docs/index.html';
  const groups = GROUPS.map((g) => `<section aria-labelledby="${g.toLowerCase()}">
<h2 id="${g.toLowerCase()}">${g}</h2>
<ul class="hub">${PAGES.filter((p) => p.group === g).map((p) => `<li><a href="${rel(out, p.out)}">${esc(p.title)}</a><p>${esc(p.blurb)}</p></li>`).join('')}</ul>
</section>`).join('\n');
  write(out, layout({ out, title: 'Documents · Annoudio', description: 'The Annoudio documents: deploy guides, plugins, the embed contract and the design notes.', current: 'docs', body: `<div class="prose">
<h1>Documents</h1>
<p>Each page is a copy of one Markdown file of the repository, made at build time. The repository has the newest text and the files that are not here.</p>
${groups}
</div>` }));
}

function readRecordings(render) {
  const readme = fs.readFileSync(path.join(REC_DIR, 'README.md'), 'utf8');
  const rows = [];
  for (const line of readme.split('\n')) {
    const m = line.match(/^\| \[(\d\d-[\w-]+)\.webm\]\([^)]*\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);
    if (m) rows.push({ name: m[1], num: m[1].slice(0, 2), role: m[2].trim(), workflow: m[3].trim(), length: m[4].trim(), size: m[5].trim() });
  }
  if (rows.length !== 19) throw new Error(`design/recordings/README.md: expected 19 rows, found ${rows.length}`);
  for (const r of rows) {
    for (const ext of ['webm', 'png']) {
      if (!fs.existsSync(path.join(REC_DIR, `${r.name}.${ext}`))) throw new Error(`missing ${r.name}.${ext}`);
    }
    const md = fs.readFileSync(path.join(REC_DIR, `${r.name}.md`), 'utf8');
    // Keep the description and the stumbles; drop the title, the role line and the file line.
    const blocks = md.split(/\n\n+/).filter((b) => !b.startsWith('# ') && !/^\*\*[^*]+\*\* · /.test(b) && !/^\[[\w-]+\.webm\]/.test(b));
    r.view = /390/.test(md.match(/(\d+)×(\d+) viewport/)?.[1] ?? '') ? { w: 390, h: 844 } : { w: 1280, h: 800 };
    r.md = blocks.join('\n\n');
    r.render = (out) => render(r.md, `design/recordings/${r.name}.md`, out);
  }
  return rows;
}

function videoFigure(r, out, { headingLevel = 3 } = {}) {
  const phone = r.view.w === 390;
  const src = rel(out, `recordings/${r.name}.webm`);
  const poster = rel(out, `recordings/${r.name}.png`);
  // The title comes from the file name: 10-member-tell-a-story → "10 · Tell a story".
  const words = r.name.slice(3).replace(/^(operator|member|visitor|maintainer)-/, '').replace(/-/g, ' ').replace(/\bomeka\b/, 'Omeka S').replace(/\bwordpress\b/, 'WordPress');
  const title = `${r.num} · ${words[0].toUpperCase()}${words.slice(1)}`;
  return `<figure class="video${phone ? ' video--phone' : ''}" id="r${r.num}">
<video controls preload="none" poster="${poster}" width="${r.view.w}" height="${r.view.h}" aria-label="Recording ${r.num}: ${esc(r.workflow)} (no sound)"><source src="${src}" type="video/webm"><a href="${src}">Download the recording (WebM)</a></video>
<figcaption>
<h${headingLevel} class="video__title">${esc(title)}</h${headingLevel}>
<span class="video__workflow">${esc(r.workflow)}</span>
<span class="video__meta">${esc(r.role)} · ${esc(r.length)} · ${esc(r.size)} · ${r.view.w}×${r.view.h} · no sound</span>
<div class="video__text">${r.render(out)}</div>
</figcaption>
</figure>`;
}

function buildRecordings(recs) {
  for (const r of recs) {
    copy(`design/recordings/${r.name}.webm`, `recordings/${r.name}.webm`);
    copy(`design/recordings/${r.name}.png`, `recordings/${r.name}.png`);
  }
  const out = 'recordings/index.html';
  const jump = ROLE_GROUPS.map((g) => `<li><a class="ao-chip" href="#${g.id}"><span class="ao-chip__label">${g.name}</span><span class="ao-chip__count">${recs.filter(g.match).length}</span></a></li>`).join('');
  const groups = ROLE_GROUPS.map((g) => `<section class="rec-group" aria-labelledby="${g.id}">
<h2 id="${g.id}">${g.name}</h2>
<p class="section-lead">${g.line}</p>
<div class="videos">${recs.filter(g.match).map((r) => videoFigure(r, out)).join('\n')}</div>
</section>`).join('\n');
  write(out, layout({ out, title: 'Recordings · Annoudio', description: 'Nineteen short screen recordings of Annoudio, one per workflow and role, made on the demo stack.', current: 'recordings', wide: true, body: `<div class="prose">
<h1>Recordings</h1>
<p>Nineteen short screen recordings, one for each workflow and role. They were made on 2026-10-09 on the real demo stack, with Playwright. A red dot shows the pointer. The videos have no sound. Under each video, the text tells what happens and the stumbles that the recording found.</p>
<p>How they were made, and how to make them again: <a href="${BLOB}design/recordings/README.md"><code>design/recordings/README.md</code></a>.</p>
</div>
<nav aria-label="Roles"><ul class="rec-jump">${jump}</ul></nav>
${groups}` }));
}

function buildLanding(render, recs) {
  const out = 'index.html';
  const cm = read('design/concept-map.md');
  const about = cm.match(/^> (Annoudio is a tool[^\n]+)$/m)?.[1];
  if (!about) throw new Error('design/concept-map.md: the "What Annoudio does" paragraph (§1.1) is missing');
  const s1 = cm.slice(cm.indexOf('## 1 Concept map'), cm.indexOf('### 1.1'));
  const table = s1.split('\n').filter((l) => l.startsWith('|')).join('\n');
  const intro = s1.split('\n\n')[1];
  const contract = read('CONTRACT.md');
  const c1 = contract.slice(contract.indexOf('## 1 The snippet'), contract.indexOf('## 2 Attributes'));
  const fences = [...c1.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (fences.length < 2) throw new Error('CONTRACT.md §1: expected two html code blocks');
  const rec = (n) => recs.find((r) => r.num === n);

  const body = `<div class="prose">
<section class="hero" aria-labelledby="top">
<h1 id="top">Annoudio</h1>
<p class="hero__lead">An audio annotation widget that a site embeds. Members of a community tell stories about parts of a recording, and visitors see them on the organisation's own site.</p>
<p class="hero__about">${esc(about)}</p>
<div class="ao-actions">
<a class="ao-btn ao-btn--primary" href="#see-it-work">See it work</a>
<a class="ao-btn" href="#how-to-run">Run it</a>
<a class="ao-btn ao-btn--quiet" href="${REPO}">Source on GitHub</a>
</div>
</section>

<h2 id="who-it-is-for">Who it is for</h2>
<ul class="roles">
<li><b>Operator</b>A person of the organisation's team. Reviews the stories and publishes them in one admin, with no code.</li>
<li><b>Member</b>A person of the community. Signs in with a code by email and tells a story about a time range: text, a voice note, a photo or a video.</li>
<li><b>Visitor</b>Anyone on the organisation's site. Plays the recording and reads the published stories in the widget. No account.</li>
<li><b>Site maintainer</b>Puts the widget on a page: pastes the two-line snippet, or uses the WordPress block or the Omeka S module.</li>
</ul>

<h2 id="the-words">The words</h2>
<p>${render(intro, 'design/concept-map.md', out).replace(/^<p>|<\/p>\s*$/g, '')} The left column is the W3C word; the middle column is the word that people read in Annoudio.</p>
${render(table, 'design/concept-map.md', out)}

<h2 id="see-it-work">See it work</h2>
<p class="section-lead">Three of the <a href="recordings/index.html">nineteen recordings</a>, made on the demo stack: a member tells a story on a phone, an operator publishes a story, a visitor reads it on the site.</p>
<div class="videos videos--landing">
${videoFigure(rec('10'), out)}
${videoFigure(rec('06'), out)}
${videoFigure(rec('14'), out)}
</div>

<h2 id="how-to-run">How to run it</h2>
<p>One organisation runs one copy: one <b>stack</b> of three parts (the app, Postgres and a worker), with Docker Compose.</p>
<h3 id="run-dev">On your computer, to change the code</h3>
<pre tabindex="0"><code>docker compose -f deploy/docker-compose.dev.yml up -d --wait   # Postgres
cd app &amp;&amp; cp .env.example .env &amp;&amp; pnpm install &amp;&amp; pnpm dev   # then open http://localhost:3000/admin</code></pre>
<p>Set the values in <code>app/.env</code> first; <a href="${BLOB}app/README.md"><code>app/README.md</code></a> tells each one. A ready demo with data and a mailbox: <a href="${BLOB}deploy/DEMO.md"><code>deploy/DEMO.md</code></a>.</p>
<h3 id="run-dokploy">On a server, with Dokploy (recommended)</h3>
<p>For an organisation on its own server, with screens for backup and restore. You need a server with 4 GB of memory, a domain, an SMTP account and an S3 bucket. Read <a href="docs/deploy-dokploy.html">Run Annoudio with Dokploy</a>.</p>
<h3 id="run-coolify">On a server, with Coolify</h3>
<p>For an organisation that already uses Coolify. It has fewer backup screens for a compose stack. Read <a href="docs/deploy-coolify.html">Run Annoudio with Coolify</a>.</p>
<p>For both, also read <a href="docs/backup.html">Backup and restore</a> and <a href="docs/upgrade.html">Upgrade</a>.</p>

<h2 id="the-snippet">The snippet</h2>
<p>A page needs two lines to show a widget. The operator copies them from the admin. <code>ORG</code> is the host name of the organisation's stack.</p>
<pre tabindex="0"><code>${esc(fences[0].trimEnd())}</code></pre>
<p>With real values:</p>
<pre tabindex="0"><code>${esc(fences[1].trimEnd())}</code></pre>
<p>The rules for these lines, the attributes, the theme tokens and the events are the promise to every host site: <a href="docs/contract.html">the embed contract</a>. WordPress and Omeka S have a plugin that writes the snippet from a recording number: <a href="docs/plugin-wordpress.html">WordPress block</a>, <a href="docs/plugin-omeka-s.html">Omeka S module</a>.</p>

<h2 id="source">Source and licence</h2>
<p>The code is on GitHub: <a href="${REPO}">github.com/micahchoo/annoudio</a>. It is free software under the <a href="${BLOB}LICENSE">MIT licence</a>. The <a href="design-system/index.html">design system</a> shows the parts of the admin and the Annotate page. Not built yet, because they need people: the team trial and the pilot on a real site. The items that no test has checked are in <a href="docs/unverified.html">Not verified yet</a>.</p>
</div>`;
  write(out, layout({ out, title: 'Annoudio', description: 'Annoudio: an audio annotation widget that a site embeds. Members tell stories about parts of a recording; operators publish them; visitors see them on the site.', current: 'home', body }));
}

function build404() {
  write('404.html', layout({ out: '404.html', absolute: true, title: 'Page not found · Annoudio', description: 'This page does not exist.', current: '', body: `<div class="prose">
<h1>This page does not exist</h1>
<p>The address can be old or typed wrong. Start again from <a href="${BASE}">the Annoudio home page</a>, or open <a href="${BASE}docs/">the documents</a>.</p>
</div>` }));
}

function buildReadme() {
  write('README-site.md', `# The Annoudio project site

This folder is the project site, served by GitHub Pages from the \`docs/\` folder of \`main\`: https://micahchoo.github.io/annoudio/. It is static: HTML, one CSS file (\`site.css\`) and the recordings. Nothing runs at serve time.

Do not edit the files here by hand. \`scripts/build-docs.mjs\` makes all of them again from the sources.

## Rebuild

From the repository root:

\`\`\`sh
node scripts/build-docs.mjs            # build docs/ and check every internal link
node scripts/build-docs.mjs --preview  # also the screenshots in _preview/ and an axe check
\`\`\`

The first run installs \`marked@${MARKED}\` into \`~/.cache/annoudio-docs/\` (needs npm and the network once). \`--preview\` uses Playwright, its Chromium and \`@axe-core/playwright\` from \`embed/\`: run \`cd embed && pnpm install\` first. The build stops with an error if a link inside the site does not resolve, or if axe finds a violation.

## What comes from where

| Site path | Source |
|---|---|
| \`index.html\` | \`design/concept-map.md\` §1 (the table) and §1.1 (the paragraph), \`CONTRACT.md\` §1 (the snippet), recordings 10, 06, 14 |
| \`recordings/\` | \`design/recordings/\`: the table in its README, each \`NN-*.md\` caption, the \`.webm\` and \`.png\` files |
| \`design-system/\` | \`design/design-system/index.html\` and \`styles.css\`, copied as they are |
| \`docs/*.html\` | ${PAGES.map((p) => `\`${p.src}\``).join(', ')} |
| \`site.css\` | Sections 1–4 of \`design/design-system/styles.css\` (the tokens, the base and the components), with the dark tokens under \`prefers-color-scheme: dark\`, and the site styles in the build script |
| \`404.html\`, \`.nojekyll\`, this file | The build script |

A link in a Markdown file to another file of this list goes to its page here. A link, or a file name in \`code\`, to any other file of the repository goes to that file on GitHub.

## Add a page

Add a line to \`PAGES\` in \`scripts/build-docs.mjs\` (source, site path, group, title, one line), then rebuild.
`);
}

// ---------- the link check ----------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function checkLinks() {
  const htmlFiles = walk(OUT).filter((f) => f.endsWith('.html'));
  const ids = new Map();
  const idsOf = (file) => {
    if (!ids.has(file)) ids.set(file, new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    return ids.get(file);
  };
  const broken = [];
  let count = 0;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) {
      const raw = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|data:)/.test(raw)) continue;
      count++;
      const [p, hash] = raw.split('#');
      let target;
      if (!p) target = file;
      else if (p.startsWith(BASE)) target = path.join(OUT, decodeURIComponent(p.slice(BASE.length)));
      else if (p.startsWith('/')) { broken.push(`${path.relative(OUT, file)}: ${raw} (absolute path outside ${BASE})`); continue; }
      else target = path.resolve(path.dirname(file), decodeURIComponent(p));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { broken.push(`${path.relative(OUT, file)}: ${raw} (no file)`); continue; }
      if (hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(hash))) broken.push(`${path.relative(OUT, file)}: ${raw} (no id "${hash}")`);
    }
  }
  return { files: htmlFiles.length, count, broken };
}

// ---------- preview: screenshots and axe (Playwright from embed/) ----------
async function preview() {
  const req = createRequire(path.join(ROOT, 'embed', 'package.json'));
  const { chromium } = req('@playwright/test');
  const { AxeBuilder } = req('@axe-core/playwright');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webm': 'video/webm', '.md': 'text/markdown' };
  const server = createServer((rq, rs) => {
    const u = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
    let f = u.startsWith(BASE) ? path.join(OUT, u.slice(BASE.length)) : null;
    if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f || !fs.existsSync(f)) { rs.writeHead(404, { 'content-type': types['.html'] }); rs.end(fs.readFileSync(path.join(OUT, '404.html'))); return; }
    rs.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(rs);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  const report = { axe: [], overflow: [] };
  try {
    fs.mkdirSync(path.join(OUT, '_preview'), { recursive: true });
    const shots = {};
    const pagesToShoot = { landing: '', recordings: 'recordings/' };
    for (const [name, p] of Object.entries(pagesToShoot)) {
      for (const width of [1280, 390]) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 } });
        const page = await ctx.newPage();
        await page.goto(origin + p, { waitUntil: 'load' });
        shots[`${name}-${width}`] = (await page.screenshot()).toString('base64');
        await ctx.close();
      }
    }
    // Two small PNGs: each shows one page at 1280 px and at 390 px, side by side, at half size.
    for (const name of Object.keys(pagesToShoot)) {
      const ctx = await browser.newContext({ viewport: { width: 860, height: 440 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.setContent(`<body style="margin:0;padding:10px;display:flex;gap:10px;align-items:flex-start;background:#ddd">
<img src="data:image/png;base64,${shots[`${name}-1280`]}" style="width:640px;box-shadow:0 0 0 1px #999">
<img src="data:image/png;base64,${shots[`${name}-390`]}" style="width:195px;box-shadow:0 0 0 1px #999"></body>`);
      await page.screenshot({ path: path.join(OUT, '_preview', `${name}.png`) });
      await ctx.close();
    }
    // axe on the landing page in both colour schemes, and on one page of each kind.
    const axeTargets = [['', 'light'], ['', 'dark'], ['recordings/', 'light'], ['recordings/', 'dark'], ['docs/', 'light'], ['docs/contract.html', 'light'], ['docs/ia.html', 'dark'], ['404', 'light']];
    for (const [p, scheme] of axeTargets) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(origin + p);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      report.axe.push({ page: p || 'index', scheme, violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })) });
      await ctx.close();
    }
    // No sideways page scroll at 390 px (and at 320 px), on every page.
    const all = walk(OUT).filter((f) => f.endsWith('.html') && !f.includes(`${path.sep}design-system${path.sep}`)).map((f) => path.relative(OUT, f).split(path.sep).join('/'));
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await ctx.newPage();
      for (const p of all) {
        await page.goto(origin + p);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) report.overflow.push(`${p} at ${width} px: ${over} px too wide`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return report;
}

// ---------- main ----------
async function main() {
  const Marked = await loadMarked();
  const render = makeRenderer(Marked);
  // Start clean: docs/ holds only what this script makes (_preview/ stays until --preview makes it again).
  fs.mkdirSync(OUT, { recursive: true });
  for (const e of fs.readdirSync(OUT)) if (e !== '_preview') fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  write('site.css', buildCss());
  copy('design/design-system/index.html', 'design-system/index.html');
  copy('design/design-system/styles.css', 'design-system/styles.css');
  const recs = readRecordings(render);
  buildRecordings(recs);
  buildLanding(render, recs);
  buildDocPages(render);
  build404();
  buildReadme();

  const links = checkLinks();
  console.log(`Link check: ${links.count} internal links in ${links.files} HTML files, ${links.broken.length} broken.`);
  for (const b of links.broken) console.log(`  BROKEN ${b}`);

  let failed = links.broken.length > 0;
  if (process.argv.includes('--preview')) {
    const r = await preview();
    for (const a of r.axe) {
      console.log(`axe ${a.page} (${a.scheme}): ${a.violations.length} violations`);
      for (const v of a.violations) console.log(`  ${v.impact} ${v.id} ×${v.nodes}: ${v.help} [${v.targets.join(' | ')}]`);
      if (a.violations.length) failed = true;
    }
    console.log(`Page width: ${r.overflow.length ? r.overflow.join('; ') : 'no page scrolls sideways at 390 px or 320 px'}.`);
    if (r.overflow.length) failed = true;
    console.log('Screenshots: docs/_preview/landing.png, docs/_preview/recordings.png');
  }
  const size = execFileSync('du', ['-sh', OUT]).toString().split('\t')[0];
  console.log(`docs/: ${size}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
