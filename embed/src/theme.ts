// The project theme: GET {origin}/embed/v1/themes/{project}.json (CONTRACT 3.2).
// One constructed stylesheet per project per page. It declares tokens on :host only.

import { SharedRequests } from "./shared";

type Kind = "color" | "length" | "font";

/** Table 3.1. Keys are token names without the `--annoudio-` prefix. */
export const TOKENS: Record<string, Kind> = {
  "color-surface": "color",
  "color-text": "color",
  "color-muted": "color",
  "color-accent": "color",
  "color-on-accent": "color",
  "color-border": "color",
  "color-wave": "color",
  "color-region": "color",
  "color-focus": "color",
  "font-family": "font",
  "font-size": "length",
  radius: "length",
  space: "length",
  "timeline-height": "length",
};

// `outline-offset` takes a <length> only (no percentages, no keywords).
const PROBE: Record<Kind, string> = { color: "color", length: "outline-offset", font: "font-family" };

/** The project frame of the theme JSON (CONTRACT 3.2, rule 7). */
export interface Rights {
  line: string;
  /** An http or https address only. */
  iri: string | null;
}

export interface Theme {
  sheet: CSSStyleSheet;
  /** Settles when the theme request settles, with the rights line or null. Never rejects, except on abort. */
  load(signal: AbortSignal): Promise<Rights | null>;
}

interface Loaded {
  css: string;
  rights: Rights | null;
}

const themes = new Map<string, Theme>();
const requests = new SharedRequests<Loaded>();

export function themeFor(origin: string, project: string): Theme {
  const url = `${origin}/embed/v1/themes/${encodeURIComponent(project)}.json`;
  let theme = themes.get(url);
  if (!theme) {
    const sheet = new CSSStyleSheet();
    theme = {
      sheet,
      load: (signal) =>
        requests.get(url, (shared) => fetchTheme(url, shared), signal).then(({ css, rights }) => {
          sheet.replaceSync(css);
          return rights;
        }),
    };
    themes.set(url, theme);
  }
  return theme;
}

const NONE: Loaded = { css: "", rights: null };

async function fetchTheme(url: string, signal: AbortSignal): Promise<Loaded> {
  let body: unknown;
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", signal });
    if (response.status !== 200 && response.status !== 304) return NONE; // 404 or other: no project theme.
    body = await response.json();
  } catch (error) {
    if (signal.aborted) throw error;
    return NONE; // Network error or bad JSON: no project theme. Not an error mode (3.2, rule 4).
  }
  return { css: toCss(body), rights: rightsOf(body) };
}

/** `rightsLine` and `rightsIri` (3.2, rule 7). An IRI that is not http or https gives no link. */
function rightsOf(body: unknown): Rights | null {
  if (typeof body !== "object" || body === null) return null;
  const { rightsLine, rightsIri } = body as { rightsLine?: unknown; rightsIri?: unknown };
  if (typeof rightsLine !== "string" || rightsLine.trim() === "") return null;
  let iri: string | null = null;
  if (typeof rightsIri === "string") {
    try {
      const url = new URL(rightsIri);
      if (url.protocol === "https:" || url.protocol === "http:") iri = url.href;
    } catch {
      iri = null;
    }
  }
  return { line: rightsLine.trim(), iri };
}

export function toCss(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const tokens = (body as { tokens?: unknown }).tokens;
  if (typeof tokens !== "object" || tokens === null) return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(tokens as Record<string, unknown>)) {
    const kind = TOKENS[key];
    if (!kind) continue; // Other keys: ignored (3.2, rule 1).
    if (typeof value !== "string" || /[;{}<>\\]/.test(value) || !CSS.supports(PROBE[kind], value)) {
      console.warn(`annoudio: the project theme value for "${key}" is not valid. The player uses the default.`);
      continue;
    }
    lines.push(`--annoudio-${key}: ${value};`);
  }
  return lines.length ? `:host { ${lines.join(" ")} }` : "";
}
