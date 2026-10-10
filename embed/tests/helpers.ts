// Test helpers. Tests use only the public surface of the player (CONTRACT.md):
// attributes, `part` names, `--annoudio-*` tokens, `annoudio:*` events, `seek()`, and the network.

import { expect, type Page, type Request } from "@playwright/test";

export const STACK = "http://localhost:4510";
export const HOST = "http://127.0.0.1:4520";
export const TONE = `${STACK}/media/tone.m4a`;

export interface RecordedEvent {
  type: string;
  detail: Record<string, unknown>;
  bubbles: boolean;
  composed: boolean;
  cancelable: boolean;
  index: number;
  at: number;
}

const EVENT_NAMES = ["ready", "error", "play", "pause", "story-open", "annotate", "timeupdate", "range"];

/**
 * Records every annoudio:* event on window (capture phase), with the time it came
 * (`performance.now()`), and CSP violations. Call before goto.
 */
export async function recordEvents(page: Page): Promise<void> {
  await page.addInitScript((names: string[]) => {
    const w = window as unknown as { __events: unknown[]; __csp: unknown[] };
    w.__events = [];
    w.__csp = [];
    for (const name of names) {
      window.addEventListener(
        `annoudio:${name}`,
        (event) => {
          const e = event as CustomEvent;
          const players = [...document.querySelectorAll("annoudio-player")];
          w.__events.push({
            type: e.type,
            detail: JSON.parse(JSON.stringify(e.detail)),
            bubbles: e.bubbles,
            composed: e.composed,
            cancelable: e.cancelable,
            index: players.indexOf(e.target as Element),
            at: performance.now(),
          });
        },
        true,
      );
    }
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  }, EVENT_NAMES);
}

export async function events(page: Page, type?: string): Promise<RecordedEvent[]> {
  const all = await page.evaluate(() => (window as unknown as { __events: RecordedEvent[] }).__events ?? []);
  return type ? all.filter((e) => e.type === type) : all;
}

export async function waitForEvent(page: Page, type: string, count = 1): Promise<RecordedEvent[]> {
  await expect.poll(async () => (await events(page, type)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(count);
  return events(page, type);
}

/** Console errors and uncaught page errors. */
export function watchConsole(page: Page): { errors: string[]; warnings: string[] } {
  const out = { errors: [] as string[], warnings: [] as string[] };
  page.on("console", (message) => {
    if (message.type() === "error") out.errors.push(message.text());
    if (message.type() === "warning") out.warnings.push(message.text());
  });
  page.on("pageerror", (error) => out.errors.push(`pageerror: ${error.message}`));
  return out;
}

export function watchRequests(page: Page): Request[] {
  const list: Request[] = [];
  page.on("request", (request) => list.push(request));
  return list;
}

/**
 * Opens a blank host page, writes `html` into its body, then adds the loader
 * as an async classic script, as a host page would.
 */
export async function mount(page: Page, html: string, options: { loader?: boolean; path?: string } = {}): Promise<void> {
  await page.goto(options.path ?? "/blank.html");
  await page.evaluate(
    ({ html, loader, stack }) => {
      document.body.insertAdjacentHTML("beforeend", html);
      if (loader) {
        const script = document.createElement("script");
        script.async = true;
        script.src = `${stack}/embed/v1.js`;
        document.body.appendChild(script);
      }
    },
    { html, loader: options.loader ?? true, stack: STACK },
  );
}

export function player(attrs: Record<string, string>, inner = ""): string {
  const list = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v.replaceAll('"', "&quot;")}"`)
    .join(" ");
  return `<annoudio-player ${list}>${inner}</annoudio-player>`;
}

export const defaults = { project: "river-voices", recording: "rec-0042", src: TONE };

/** A locator for a part of the n-th player. Playwright CSS pierces open shadow roots. */
export function part(page: Page, name: string, index = 0) {
  return page.locator("annoudio-player").nth(index).locator(`[part~="${name}"]`);
}

/** Computed style values of the first element with this part name, searched through nested shadow roots. */
export async function partStyle(page: Page, name: string, props: string[], index = 0): Promise<Record<string, string>> {
  return page.evaluate(
    ({ name, props, index }) => {
      const find = (root: ParentNode): Element | null => {
        const direct = root.querySelector(`[part~="${name}"]`);
        if (direct) return direct;
        for (const node of root.querySelectorAll("*")) {
          if (node.shadowRoot) {
            const hit = find(node.shadowRoot);
            if (hit) return hit;
          }
        }
        return null;
      };
      const host = document.querySelectorAll("annoudio-player")[index];
      const target = host?.shadowRoot ? find(host.shadowRoot) : null;
      if (!target) throw new Error(`no part ${name}`);
      const style = getComputedStyle(target);
      return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
    },
    { name, props, index },
  );
}

/** Counts elements with this part name in the n-th player, through nested shadow roots. */
export async function partCount(page: Page, name: string, index = 0): Promise<number> {
  return page.evaluate(
    ({ name, index }) => {
      const count = (root: ParentNode): number => {
        let n = root.querySelectorAll(`[part~="${name}"]`).length;
        for (const node of root.querySelectorAll("*")) if (node.shadowRoot) n += count(node.shadowRoot);
        return n;
      };
      const host = document.querySelectorAll("annoudio-player")[index];
      return host?.shadowRoot ? count(host.shadowRoot) : 0;
    },
    { name, index },
  );
}

/** Text of the `time` part, for example "0:42 / 0:10". */
export async function timeText(page: Page, index = 0): Promise<string> {
  return (await part(page, "time", index).textContent()) ?? "";
}

/** The fixture server's request log (requests to the stack). */
export async function stackLog(page: Page): Promise<
  Array<{ method: string; path: string; search: string; cookie: string | null; prefer: string | null; accept: string | null; origin: string | null; range: string | null }>
> {
  const response = await page.request.get(`${STACK}/__log`);
  return response.json();
}

export function unique(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The documented messages are not part of the contract, but each one must be plain text. */
export async function messageText(page: Page, index = 0): Promise<string> {
  return ((await part(page, "message", index).textContent()) ?? "").trim();
}
