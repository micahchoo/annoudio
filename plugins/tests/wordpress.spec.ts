// The WordPress plugin on the test host (WordPress 7.1.3, :8091).
// CONTRACT.md 13: a hand-pasted snippet survives only with unfiltered_html. The block
// must work for an author without it, because the post stores attributes, not HTML.
// Phase 7b: the author types only the recording ID; the audio address comes from the
// admin (CONTRACT.md 5.2) at render time, and the stored copy is the fallback.

import { expect, test, type Page } from "@playwright/test";

import {
  connectedText,
  DOWN,
  expectPlayers,
  RECORDING,
  recordingFromStack,
  snippetFromAdmin,
  STORED,
  storiesTotal,
  waitForStack,
  watch,
  WP,
  wp,
} from "./helpers";
import type { Published, Recording } from "./helpers";

test.describe.configure({ mode: "serial" });

let total: Published;
let recording: Recording;
let connected: string;
let snippet: string;

test.beforeAll(async ({ browser, request }) => {
  await waitForStack(request);
  total = await storiesTotal(request);
  recording = await recordingFromStack(request);
  connected = await connectedText(request);
  snippet = await snippetFromAdmin(browser);
  // The fallback test needs the admin's address to differ from the stored copy.
  expect(recording.url).not.toBe(STORED);
});

async function logIn(page: Page, user: string, password: string) {
  await page.goto(`${WP}/wp-login.php`);
  await page.fill("#user_login", user);
  await page.fill("#user_pass", password);
  await page.click("#wp-submit");
  await expect(page).toHaveURL(/wp-admin/);
}

test("the author has no unfiltered_html", () => {
  const caps = wp("user", "list-caps", "author1").split("\n");
  expect(caps).toContain("edit_posts");
  expect(caps).not.toContain("unfiltered_html");
});

test("the settings page says it is connected to the project, by name", async ({ page }) => {
  await logIn(page, "admin", "wp-admin-test");
  await page.goto(`${WP}/wp-admin/options-general.php?page=annoudio`);
  await expect(page.locator("#annoudio-status")).toHaveText(connected);
  await expect(page.getByLabel("Stack address")).toHaveValue(/^http/);
});

test("the settings page shows a plain error for an unknown project, and a bad address is refused", async ({ page }) => {
  await logIn(page, "admin", "wp-admin-test");
  await page.goto(`${WP}/wp-admin/options-general.php?page=annoudio`);
  const origin = await page.getByLabel("Stack address").inputValue();
  try {
    await page.getByLabel("Project").fill("no-such-project");
    await page.getByRole("button", { name: "Save and check" }).click();
    await expect(page.locator("#annoudio-status")).toHaveText(
      'The stack has no project "no-such-project". Copy the project slug from the Annoudio admin, page Projects.',
    );
    await page.getByLabel("Stack address").fill("http://127.0.0.1:3500/embed/v1.js");
    await page.getByRole("button", { name: "Save and check" }).click();
    await expect(page.getByText('"http://127.0.0.1:3500/embed/v1.js" is not a stack address.')).toBeVisible();
    await expect(page.getByLabel("Stack address")).toHaveValue(origin);
  } finally {
    await page.getByLabel("Project").fill("river-voices");
    await page.getByRole("button", { name: "Save and check" }).click();
    await expect(page.locator("#annoudio-status")).toHaveText(connected);
  }
});

async function newPostWithBlock(page: Page, title: string) {
  await logIn(page, "author1", "wp-author-test");
  await page.goto(`${WP}/wp-admin/post-new.php`);
  const guide = page.getByRole("dialog", { name: /welcome/i });
  if (await guide.isVisible({ timeout: 5000 }).catch(() => false)) {
    await guide.getByRole("button", { name: "Close" }).click();
  }
  const canvas = page.frameLocator('iframe[name="editor-canvas"]');
  await canvas.getByRole("textbox", { name: "Add title" }).fill(title);
  await page.getByRole("button", { name: /block inserter/i }).click();
  // The admin's word finds the block: "widget" (recordings audit, 17).
  await page.getByRole("searchbox", { name: /search/i }).fill("widget");
  await page.getByRole("option", { name: "Annoudio widget" }).click();
  return canvas;
}

test("an author types only the recording number; visitors see the player with the admin's audio and the stories", async ({ page, browser }) => {
  const canvas = await newPostWithBlock(page, "Ferry crossing, from the block editor");
  await expect(canvas.getByLabel("Audio address")).toHaveCount(0);

  // An unknown id, then a word: the editor says so in plain words.
  await canvas.getByLabel("Recording number").fill("999999");
  await expect(canvas.getByText('The project "river-voices" has no recording with the number "999999".')).toBeVisible();
  await canvas.getByLabel("Recording number").fill("one");
  await expect(canvas.getByText('"one" is not a recording number. Type a number, for example 1.')).toBeVisible();

  // The number from the admin's Snippet panel ("Recording number: 1").
  await canvas.getByLabel("Recording number").fill(RECORDING);
  await expect(canvas.getByText(`Recording found: ${recording.title}`)).toBeVisible();
  await expect(canvas.getByText(`Audio address (from the Annoudio admin): ${recording.url}`)).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("region", { name: /publish/i }).getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByTestId("snackbar").filter({ hasText: "Post published." })).toBeVisible();
  const { id, link } = await page.evaluate(() => {
    const editor = (window as unknown as { wp: { data: { select: (s: string) => { getCurrentPostId(): number; getPermalink(): string } } } }).wp.data.select("core/editor");
    return { id: editor.getCurrentPostId(), link: editor.getPermalink() };
  });

  // What WordPress stored for this author: the block comment with the id and the admin's
  // address as the copy, no HTML.
  const stored = wp("post", "get", String(id), "--field=post_content");
  expect(stored).toBe(`<!-- wp:annoudio/player {"recording":"${RECORDING}","src":"${recording.url}"} /-->`);

  const visitor = await browser.newPage();
  const { errors } = await watch(visitor);
  await visitor.goto(link);
  await expectPlayers(visitor, 1, total, recording.url);
  expect(errors).toEqual([]);
  await visitor.close();
  wp("post", "delete", String(id), "--force");
});

test("the pasted snippet still fills the block", async ({ page }) => {
  const canvas = await newPostWithBlock(page, "Ferry crossing, from a pasted snippet");
  await canvas.getByLabel("Or paste the snippet").fill(snippet);
  await expect(canvas.getByLabel("Recording number")).toHaveValue(RECORDING);
  await expect(canvas.getByText(`Recording found: ${recording.title}`)).toBeVisible();
  const src = await page.evaluate(
    () =>
      (window as unknown as { wp: { data: { select: (s: string) => { getSelectedBlock(): { attributes: { src: string } } } } } }).wp.data
        .select("core/block-editor")
        .getSelectedBlock().attributes.src,
  );
  expect(src).toBe(recording.url);
});

test("a post with two blocks that hold only the ID: two players, one loader (post made with WP-CLI)", async ({ page }) => {
  const { errors } = await watch(page);
  await page.goto(`${WP}/?name=annoudio-block-by-author`);
  await expectPlayers(page, 2, total, recording.url);
  await expect(page.locator("annoudio-player").nth(1)).toHaveAttribute("src", recording.url);
  expect(errors).toEqual([]);
});

test("the admin's address wins over the stored copy; with the stack down for this server, the stored copy plays", async ({ page }) => {
  await page.goto(`${WP}/?name=annoudio-block-fallback`);
  await expect(page.locator("annoudio-player")).toHaveAttribute("src", recording.url);

  const saved = wp("option", "pluck", "annoudio", "server_origin");
  wp("option", "patch", "update", "annoudio", "server_origin", DOWN);
  try {
    const visitor = await page.context().newPage();
    const { errors } = await watch(visitor);
    await visitor.goto(`${WP}/?name=annoudio-block-fallback`);
    // The visitor's browser still reaches the stack: the player is complete.
    await expectPlayers(visitor, 1, total, STORED);
    expect(errors).toEqual([]);
    // A post with no stored copy prints nothing, not a broken player.
    await visitor.goto(`${WP}/?name=annoudio-block-by-author`);
    await expect(visitor.locator("annoudio-player")).toHaveCount(0);
  } finally {
    wp("option", "patch", "update", "annoudio", "server_origin", saved);
  }
});
