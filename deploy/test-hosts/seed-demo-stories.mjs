#!/usr/bin/env node
// Adds demo stories to recording 1 of the demo stack (deploy/DEMO.md), through the real
// Annotate page and the admin's Publish button. Safe to run again: a story whose text is
// already in the stack is not added again.
//
//   Leela: "My grandmother sang this on the ferry."  0:02–0:04, topic Ferry   → published
//   Leela: "The ferry at the north landing."         0:05–0:08, a photo body  → published
//   Ravi:  "The horn meant the last crossing."       0:06–0:09, topic Horn    → waits for review
//
// Use (repository root): node deploy/test-hosts/seed-demo-stories.mjs
// Exit code 1: a story could not be published (a photo that is still processing). The
// other stories are in place; run the script again when the photo is ready.
// Needs: the demo stack, Mailpit (login codes), and Playwright from plugins/tests
// (cd plugins/tests && pnpm install). Prints the IRIs of the published stories.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(new URL("../../plugins/tests/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const ORIGIN = process.env.ANNOUDIO_ORIGIN ?? "http://127.0.0.1:3500";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:8025";
const PROJECT = "river-voices";
const RECORDING = "1";
const OPERATOR = { email: "operator@example.org", password: "demo-operator-pass-1" };

const STORIES = [
  { member: "leela@example.org", nickname: "Leela", text: "My grandmother sang this on the ferry.", start: "2", end: "4", topic: "Ferry", publish: true },
  { member: "leela@example.org", nickname: "Leela", text: "The ferry at the north landing.", start: "5", end: "8", photo: true, publish: true },
  { member: "ravi@example.org", nickname: "Ravi", text: "The horn meant the last crossing.", start: "6", end: "9", topic: "Horn", publish: false },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/** The published stories of the instance, followed through every page of the container. */
async function published() {
  const container = await json(`${ORIGIN}/stories/${PROJECT}/${RECORDING}/`);
  const out = [];
  let next = container.first;
  while (next) {
    const page = typeof next === "string" ? await json(next) : next;
    for (const item of page.items ?? []) out.push(item);
    next = page.next;
  }
  return out;
}

const textOf = (story) =>
  [story.body].flat().filter((b) => b?.type === "TextualBody" && b.purpose !== "tagging").map((b) => b.value).join(" ");

/** The newest Mailpit message to `email`, or null. */
async function newestMail(email) {
  const result = await json(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`);
  return result.messages?.[0] ?? null;
}

async function signIn(page, email, nickname) {
  await page.goto(`${ORIGIN}/annotate?project=${PROJECT}&recording=${RECORDING}`);
  await page.waitForLoadState("networkidle");
  const signedIn = page.locator(".member-menu summary");
  if (await signedIn.isVisible().catch(() => false)) return;
  const before = (await newestMail(email))?.ID;
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Send the code" }).click();
  await page.getByRole("heading", { name: "Type your login code" }).waitFor();
  let mail = null;
  for (let i = 0; i < 30 && !mail; i++) {
    const newest = await newestMail(email);
    if (newest && newest.ID !== before) mail = newest;
    else await sleep(1000);
  }
  if (!mail) throw new Error(`No login code arrived for ${email}`);
  const { Text } = await json(`${MAILPIT}/api/v1/message/${mail.ID}`);
  const code = /\b(\d{6})\b/.exec(Text)?.[1];
  await page.getByRole("textbox", { name: "Login code" }).fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  const name = page.getByRole("heading", { name: "Choose your name" });
  await Promise.race([name.waitFor(), signedIn.waitFor()]);
  if (await name.isVisible()) {
    await page.getByRole("textbox", { name: "Name" }).fill(nickname);
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await signedIn.waitFor();
}

/** A real JPEG, drawn by the browser: no image file in the repository. */
async function makePhoto(page, dir) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 400;
    const g = canvas.getContext("2d");
    g.fillStyle = "#7fb3d5";
    g.fillRect(0, 0, 640, 260);
    g.fillStyle = "#1f618d";
    g.fillRect(0, 260, 640, 140);
    g.fillStyle = "#6e2c00";
    g.fillRect(180, 210, 280, 60);
    g.fillStyle = "#ffffff";
    g.font = "28px sans-serif";
    g.fillText("North landing, 1962", 190, 120);
    return canvas.toDataURL("image/jpeg", 0.9);
  });
  const file = join(dir, "north-landing.jpg");
  writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  return file;
}

async function tell(page, story, dir) {
  await signIn(page, story.member, story.nickname);
  // A story of this member with this text already exists (for example one that waits): skip it.
  await page.goto(`${ORIGIN}/annotate/mine`);
  if (await page.locator(".card__text", { hasText: story.text }).first().isVisible().catch(() => false)) {
    console.log(`exists for ${story.nickname}: ${story.text}`);
    return;
  }
  await page.goto(`${ORIGIN}/annotate?project=${PROJECT}&recording=${RECORDING}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Start", exact: true }).fill(story.start);
  await page.getByRole("textbox", { name: "End", exact: true }).fill(story.end);
  await page.getByRole("textbox", { name: "Story", exact: true }).fill(story.text);
  if (story.topic) await page.getByRole("checkbox", { name: story.topic }).check();
  if (story.photo) {
    await page.getByLabel("Attach a photo or a video").setInputFiles(await makePhoto(page, dir));
    await page.locator(".attachments li").filter({ hasText: /Processing|Ready/ }).first().waitFor({ timeout: 60_000 });
  }
  await page.getByRole("button", { name: "Send for review" }).click();
  await page.getByRole("status").filter({ hasText: "Sent." }).waitFor();
  console.log(`saved for ${story.nickname}: ${story.text}`);
}

/** True when the story is published. A media body must finish processing first: try for two minutes. */
async function publish(admin, text) {
  for (let i = 0; i < 24; i++) {
    if ((await published()).some((s) => textOf(s) === text)) return true;
    await admin.goto(`${ORIGIN}/admin/collections/stories`);
    const link = admin.getByRole("link", { name: text });
    if (await link.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.first().click();
      // The Publish button is off while a body is processing: wait and try again.
      const button = admin.getByRole("button", { name: "Publish", exact: true });
      if (await button.isEnabled({ timeout: 5000 }).catch(() => false)) {
        await button.click();
        await admin.getByRole("dialog", { name: "Publish this story?" }).getByRole("button", { name: "Publish the story" }).click();
        await admin.getByText("Published. Visitors see it within one minute.").waitFor().catch(() => {});
      } else {
        await sleep(5000);
      }
    } else {
      await sleep(5000);
    }
  }
  return false;
}

const dir = mkdtempSync(join(tmpdir(), "annoudio-seed-"));
const browser = await chromium.launch({ args: ["--mute-audio"] });
try {
  const already = (await published()).map(textOf);
  for (const story of STORIES) {
    if (already.includes(story.text)) {
      console.log(`published already: ${story.text}`);
      continue;
    }
    const context = await browser.newContext();
    await tell(await context.newPage(), story, dir);
    await context.close();
  }
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${ORIGIN}/admin/login`);
  await admin.fill("#field-email", OPERATOR.email);
  await admin.fill("#field-password", OPERATOR.password);
  await admin.click('button[type="submit"]');
  await admin.waitForURL(`${ORIGIN}/admin`);
  await admin.getByRole("heading", { level: 1, name: "Today" }).waitFor();
  let missing = 0;
  for (const story of STORIES.filter((s) => s.publish)) {
    if (await publish(admin, story.text)) continue;
    missing++;
    // The photo needs the app's `media.settled` consumer (ANNOUDIO_MEDIA_CONSUMER=1). Without
    // it the body stays "processing" and the story waits in the queue; run this again later.
    console.error(`NOT published (still processing?): ${story.text}`);
  }

  const final = await published();
  const waiting = STORIES.find((s) => !s.publish);
  if (final.some((s) => textOf(s) === waiting.text)) throw new Error(`"${waiting.text}" is published; it must wait for review`);
  console.log(`published stories: ${final.length}`);
  for (const s of final) console.log(`  ${s.id}  ${textOf(s)}`);
  process.exitCode = missing ? 1 : 0;
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
