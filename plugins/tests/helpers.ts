// Shared steps of the plugin tests. The tests use the hosts' own pages and the player's
// public surface (CONTRACT.md: the snippet, `annoudio:*` events), nothing inside the plugins.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const ORIGIN = process.env.ANNOUDIO_ORIGIN ?? "http://127.0.0.1:3500";
export const PROJECT = "river-voices";
export const RECORDING = "1";
export const AUDIO = "http://127.0.0.1:4610/media/tone.m4a";
/** The stored copy of the fallback pages (install-plugins.sh STORED): plays, but is not the admin's. */
export const STORED = "http://127.0.0.1:4610/media/tone-nolength.m4a";
/** A server address that nothing answers: the stack is "down" for the host's PHP only. */
export const DOWN = "http://127.0.0.1:9";
export const WP = "http://localhost:8091";
export const OMEKA = "http://localhost:8092";
const OPERATOR = { email: "operator@example.org", password: "demo-operator-pass-1" };

const compose = ["compose", "-f", fileURLToPath(new URL("../../deploy/test-hosts/docker-compose.yml", import.meta.url))];

/** WP-CLI in the test host stack (as setup.sh runs it). */
export function wp(...args: string[]): string {
  return execFileSync("docker", [...compose, "run", "--rm", "-T", "wp-cli", "wp", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** The stack can restart for a minute (demo rebuild): wait for it. */
export async function waitForStack(request: APIRequestContext): Promise<void> {
  await expect
    .poll(async () => (await request.get(`${ORIGIN}/embed/v1.js`).catch(() => null))?.status() ?? 0, {
      timeout: 120_000,
      intervals: [2000],
    })
    .toBe(200);
}

export interface Recording {
  title: string;
  url: string;
}

/** The demo recording as the admin has it now (CONTRACT.md 5.2). */
export async function recordingFromStack(request: APIRequestContext): Promise<Recording> {
  const response = await request.get(`${ORIGIN}/embed/v1/recordings/${PROJECT}/${RECORDING}.json`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Recording;
}

/** The status line of a host's settings page for the demo project (CONTRACT.md 3.2, rule 7). */
export async function connectedText(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${ORIGIN}/embed/v1/themes/${PROJECT}.json`);
  expect(response.status()).toBe(200);
  const { name } = (await response.json()) as { name?: string };
  expect(name, "the stack sends the project name").toBeTruthy();
  return `Connected to ${name} (project ${PROJECT}) at ${ORIGIN}.`;
}

export interface Published {
  total: number;
  /** The main text of each story on the first container page. */
  texts: string[];
}

/** The published stories of the demo instance, read from the stack itself. */
export async function storiesTotal(request: APIRequestContext): Promise<Published> {
  const response = await request.get(`${ORIGIN}/stories/${PROJECT}/${RECORDING}/`);
  expect(response.status()).toBe(200);
  type Body = { type: string; value?: string; purpose?: string };
  const container = (await response.json()) as { total: number; first?: { items?: { body: Body | Body[] }[] } };
  const texts = (container.first?.items ?? []).map(
    (story) => [story.body].flat().find((b) => b.type === "TextualBody" && b.purpose !== "tagging")?.value ?? "",
  );
  return { total: container.total, texts };
}

/** The snippet exactly as the operator copies it from the recording page of the admin. */
export async function snippetFromAdmin(browser: Browser): Promise<string> {
  const page = await browser.newPage();
  await page.goto(`${ORIGIN}/admin/login`);
  await page.fill("#field-email", OPERATOR.email);
  await page.fill("#field-password", OPERATOR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${ORIGIN}/admin`);
  await page.goto(`${ORIGIN}/admin/collections/recordings/${RECORDING}`);
  // The Snippet panel (app/src/admin, Phase 5). Its class is the admin's, not a contract.
  const code = page.locator(".annoudio-snippet__code");
  await expect(code).toContainText("<annoudio-player");
  const text = (await code.textContent()) ?? "";
  await page.close();
  return text;
}

/** Records the player events and console errors. Call before goto. */
export async function watch(page: Page): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const w = window as unknown as { __annoudio: { type: string; detail: Record<string, unknown> }[] };
    w.__annoudio = [];
    for (const type of ["annoudio:ready", "annoudio:error"]) {
      window.addEventListener(type, (e) => w.__annoudio.push({ type, detail: (e as CustomEvent).detail }), true);
    }
  });
  return { errors };
}

/**
 * The page holds `count` players of the demo instance, made from the snippet: one loader
 * (async, classic), each player ready with the stack's stories, no player error.
 */
export async function expectPlayers(page: Page, count: number, stories: Published, src: string | RegExp = AUDIO) {
  const total = stories.total;
  const players = page.locator("annoudio-player");
  await expect(players).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await expect(players.nth(i)).toHaveAttribute("project", PROJECT);
    await expect(players.nth(i)).toHaveAttribute("recording", RECORDING);
  }
  await expect(players.first()).toHaveAttribute("src", src);

  const loader = page.locator(`script[src="${ORIGIN}/embed/v1.js"]`);
  await expect(loader).toHaveCount(1);
  expect(await loader.getAttribute("async")).not.toBeNull();
  expect(await loader.getAttribute("type")).toBeNull();
  expect(await loader.getAttribute("crossorigin")).toBeNull();

  const events = () =>
    page.evaluate(() => (window as unknown as { __annoudio: { type: string; detail: Record<string, unknown> }[] }).__annoudio);
  await expect.poll(async () => (await events()).filter((e) => e.type === "annoudio:ready").length).toBe(count);
  const all = await events();
  expect(all.filter((e) => e.type === "annoudio:error")).toEqual([]);
  for (const ready of all.filter((e) => e.type === "annoudio:ready")) {
    expect(ready.detail).toMatchObject({ project: PROJECT, recording: RECORDING, stories: total });
  }
  // The stories show in the player's shadow tree (CONTRACT.md 3.3 part names).
  await expect
    .poll(() => page.evaluate(() => document.querySelector("annoudio-player")?.shadowRoot?.querySelectorAll('[part~="story"]').length ?? -1))
    .toBe(total);
  const shown = await page.evaluate(() => document.querySelector("annoudio-player")?.shadowRoot?.textContent ?? "");
  for (const text of stories.texts) expect(shown).toContain(text);
}
