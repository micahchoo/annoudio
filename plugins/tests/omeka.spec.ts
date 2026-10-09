// The Omeka S module on the test host (Omeka S 4.2.1, :8092), with the HTML purifier ON.
// CONTRACT.md 13: the purifier removes a pasted <script> and <annoudio-player>. The block
// stores data only and PHP renders the snippet, so the purifier never sees it.
// Phase 7b: the editor types only the recording ID; the audio address is the attached
// Omeka media, else the admin's (CONTRACT.md 5.2) at render time, else the stored copy.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  connectedText,
  DOWN,
  expectPlayers,
  OMEKA,
  RECORDING,
  recordingFromStack,
  STORED,
  storiesTotal,
  waitForStack,
  watch,
} from "./helpers";
import type { Published, Recording } from "./helpers";

test.describe.configure({ mode: "serial" });

const SLUG = "annoudio-editor";
const MEDIA_SRC = new RegExp(`^${OMEKA}/files/original/[0-9a-f]+\\.m4a$`);
let total: Published;
let recording: Recording;
let connected: string;

test.beforeAll(async ({ request }) => {
  await waitForStack(request);
  total = await storiesTotal(request);
  recording = await recordingFromStack(request);
  connected = await connectedText(request);
  expect(recording.url).not.toBe(STORED);
});

async function logIn(page: Page) {
  await page.goto(`${OMEKA}/login`);
  await page.fill("#email", "admin@example.org");
  await page.fill("#password", "omeka-admin-test");
  await page.click('input[type="submit"], button[type="submit"]');
  await expect(page).toHaveURL(/\/admin/);
}

/** Runs PHP in the Omeka container, signed in as the global administrator. */
function omekaPhp(body: string): string {
  const compose = fileURLToPath(new URL("../../deploy/test-hosts/docker-compose.yml", import.meta.url));
  const php = `chdir('/var/www/html'); require 'bootstrap.php';
    $s = Laminas\\Mvc\\Application::init(require 'application/config/application.config.php')->getServiceManager();
    $em = $s->get('Omeka\\EntityManager');
    $s->get('Omeka\\AuthenticationService')->getStorage()->write($em->getRepository(Omeka\\Entity\\User::class)->findOneBy(['role' => 'global_admin']));
    ${body}`;
  return execFileSync("docker", ["compose", "-f", compose, "exec", "-T", "-u", "www-data", "omeka", "php", "-r", php], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Removes the page that the editor test makes, so the test can run again. */
function deleteEditorPage() {
  omekaPhp(`$api = $s->get('Omeka\\ApiManager');
    $site = $api->read('sites', ['slug' => 'annoudio'])->getContent();
    foreach ($api->search('site_pages', ['site_id' => $site->id(), 'slug' => '${SLUG}'])->getContent() as $p) { $api->delete('site_pages', $p->id()); }`);
}

/** Reads or writes the module's server address. Settings::set writes the table directly. */
function serverOrigin(value?: string): string {
  if (value === undefined) {
    return omekaPhp(`echo json_decode($em->getConnection()->fetchOne("SELECT value FROM setting WHERE id = 'annoudio_server_origin'"));`);
  }
  omekaPhp(`$s->get('Omeka\\Settings')->set('annoudio_server_origin', ${JSON.stringify(value)});`);
  return value;
}

test("the HTML purifier is on", async ({ page }) => {
  await logIn(page);
  await page.goto(`${OMEKA}/admin/setting`);
  await expect(page.locator("#use_htmlpurifier")).toBeChecked();
});

test("the module configuration says it is connected to the project", async ({ page }) => {
  await logIn(page);
  await page.goto(`${OMEKA}/admin/module/configure?id=Annoudio`);
  await expect(page.locator("#annoudio-status")).toHaveText(connected);
});

test("the module configuration shows a plain error for an unknown project, and a bad address is refused", async ({ page }) => {
  await logIn(page);
  const configure = `${OMEKA}/admin/module/configure?id=Annoudio`;
  const submit = () => page.locator("#page-actions").getByRole("button", { name: "Submit" }).click();
  await page.goto(configure);
  try {
    await page.getByLabel("Project").fill("no-such-project");
    await submit();
    await page.goto(configure);
    await expect(page.locator("#annoudio-status")).toHaveText(
      'The stack has no project "no-such-project". Copy the project slug from the Annoudio admin, page Projects.',
    );
    await page.getByLabel("Stack address").fill("http://127.0.0.1:3500/embed/v1.js");
    await submit();
    await expect(page.getByText('"http://127.0.0.1:3500/embed/v1.js" is not a stack address.')).toBeVisible();
  } finally {
    await page.goto(configure);
    await page.getByLabel("Project").fill("river-voices");
    await submit();
    await page.goto(configure);
    await expect(page.locator("#annoudio-status")).toHaveText(connected);
  }
});

test("a page with an Omeka media block and an ID-only block: one loader, two players", async ({ page }) => {
  const { errors } = await watch(page);
  await page.goto(`${OMEKA}/s/annoudio/page/annoudio-media`);
  // The first block's src is the original file of the attached Omeka media; the second
  // block has only the ID, so its src is the admin's.
  await expectPlayers(page, 2, total, MEDIA_SRC);
  await expect(page.locator("annoudio-player").nth(1)).toHaveAttribute("src", recording.url);
  expect(errors).toEqual([]);
});

test("the admin's address wins over the stored copy; with the stack down for this server, the stored copy plays", async ({ page }) => {
  await page.goto(`${OMEKA}/s/annoudio/page/annoudio-fallback`);
  await expect(page.locator("annoudio-player")).toHaveAttribute("src", recording.url);

  const saved = serverOrigin();
  expect(saved).toMatch(/^http/);
  serverOrigin(DOWN);
  try {
    const visitor = await page.context().newPage();
    const { errors } = await watch(visitor);
    await visitor.goto(`${OMEKA}/s/annoudio/page/annoudio-fallback`);
    // The visitor's browser still reaches the stack: the player is complete.
    await expectPlayers(visitor, 1, total, STORED);
    expect(errors).toEqual([]);
  } finally {
    serverOrigin(saved);
  }
});

test("the page editor: an unknown ID is refused; an ID with an Omeka media and an ID alone save and play", async ({ page, browser }) => {
  deleteEditorPage();
  await logIn(page);
  await page.goto(`${OMEKA}/admin/site/s/annoudio/add-page`);
  await page.fill("#title", "Ferry crossing, from the page editor");
  await page.fill("#slug", SLUG);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/page/${SLUG}`));
  await page.goto(`${OMEKA}/admin/site/s/annoudio/page/${SLUG}/edit`);

  await page.locator('#new-block button[value="annoudioPlayer"]').click();
  const block = page.locator('.block[data-block-layout="annoudioPlayer"]').last();
  await expect(block.getByLabel("Audio address")).toHaveCount(0);
  await block.getByLabel("Recording ID").fill("999999");
  await page.locator("#page-actions").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText('Annoudio player: The project "river-voices" has no recording with the ID "999999".')).toBeVisible();

  await page.goto(`${OMEKA}/admin/site/s/annoudio/page/${SLUG}/edit`);
  // Block 1: the ID and the Omeka media picker (the core attachments form, one attachment).
  await page.locator('#new-block button[value="annoudioPlayer"]').click();
  const withMedia = page.locator('.block[data-block-layout="annoudioPlayer"]').last();
  await withMedia.getByLabel("Recording ID").fill(RECORDING);
  await withMedia.getByRole("button", { name: "Add attachment" }).click();
  await page.locator("#select-resource").getByText("Ferry crossing, 1962 (Annoudio test)").first().click();
  await page.locator("#attachment-options .media-list .media").first().click();
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(withMedia.locator(".attachment .item-title")).toContainText("Ferry crossing, 1962 (Annoudio test)");
  // Block 2: only the ID. The block form comes by XHR: wait for it.
  await page.locator('#new-block button[value="annoudioPlayer"]').click();
  await expect(page.locator('.block[data-block-layout="annoudioPlayer"]')).toHaveCount(2);
  await page.locator('.block[data-block-layout="annoudioPlayer"]').nth(1).getByLabel("Recording ID").fill(RECORDING);
  await page.locator("#page-actions").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Page successfully updated")).toBeVisible();
  await expect(page.locator(".annoudio-status")).toHaveText([`Recording found: ${recording.title}`, `Recording found: ${recording.title}`]);

  // onHydrate kept the admin's address as the copy of each block.
  const copies = omekaPhp(`$api = $s->get('Omeka\\ApiManager');
    $site = $api->read('sites', ['slug' => 'annoudio'])->getContent();
    $p = $api->search('site_pages', ['site_id' => $site->id(), 'slug' => '${SLUG}'])->getContent()[0];
    $mine = array_filter($p->blocks(), fn ($b) => $b->layout() === 'annoudioPlayer');
    echo json_encode(array_values(array_map(fn ($b) => $b->data(), $mine)));`);
  expect(JSON.parse(copies)).toEqual([
    { recording: RECORDING, src: recording.url },
    { recording: RECORDING, src: recording.url },
  ]);

  const visitor = await browser.newPage();
  const { errors } = await watch(visitor);
  await visitor.goto(`${OMEKA}/s/annoudio/page/${SLUG}`);
  await expectPlayers(visitor, 2, total, MEDIA_SRC);
  await expect(visitor.locator("annoudio-player").nth(1)).toHaveAttribute("src", recording.url);
  expect(errors).toEqual([]);
  await visitor.close();
  deleteEditorPage();
});
