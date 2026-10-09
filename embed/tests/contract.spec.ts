// CONTRACT.md section 16: the contract tests. They use only the public surface.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  defaults,
  events,
  HOST,
  messageText,
  mount,
  part,
  partCount,
  partStyle,
  player,
  recordEvents,
  STACK,
  stackLog,
  timeText,
  TONE,
  unique,
  waitForEvent,
  watchConsole,
  watchRequests,
} from "./helpers";

const BUNDLE = /^\/embed\/v1\/[0-9a-f]{12}\/player\.js$/;
/** The id of Asha's story in rec-0042: the story with two replies. */
const ASHA = "0192f3a4-7c1e-7b10-9d55-000000000003";
const ASHA_IRI = `${STACK}/stories/river-voices/rec-0042/${ASHA}`;

test.beforeEach(async ({ page }) => {
  await recordEvents(page);
});

test.describe("16.1 the snippet on a bare page", () => {
  test("makes no console errors, and the requests match section 6", async ({ page, browserName }) => {
    const output = watchConsole(page);
    const requests = watchRequests(page);
    await page.goto("/bare.html");
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "waveform")).toBe(1); // request 5 is done
    await expect.poll(() => partCount(page, "region")).toBe(3);

    // WebKit draws its media controls with blob: images. They are not network requests.
    const foreign = requests.filter(
      (r) => !r.url().startsWith(STACK) && !r.url().startsWith(HOST) && !r.url().startsWith("blob:"),
    );
    expect(foreign.map((r) => r.url())).toEqual([]);

    const paths = requests.filter((r) => r.url().startsWith(STACK)).map((r) => new URL(r.url()));
    const count = (test: (u: URL) => boolean) => paths.filter(test).length;
    expect(count((u) => u.pathname === "/embed/v1.js")).toBe(1);
    expect(count((u) => BUNDLE.test(u.pathname))).toBe(1);
    expect(count((u) => u.pathname === "/embed/v1/themes/river-voices.json")).toBe(1);
    expect(count((u) => u.pathname === "/stories/river-voices/rec-0042/")).toBe(1);
    expect(count((u) => u.pathname === "/media/tone.m4a")).toBeGreaterThanOrEqual(1);
    const allowed = (u: URL) =>
      u.pathname === "/embed/v1.js" ||
      BUNDLE.test(u.pathname) ||
      u.pathname === "/embed/v1/themes/river-voices.json" ||
      u.pathname === "/stories/river-voices/rec-0042/" ||
      u.pathname === "/media/tone.m4a" ||
      // Request 7: WebKit can read the start of a voice note although its preload is "none".
      (browserName === "webkit" && u.pathname === "/media/voice.m4a");
    expect(paths.filter((u) => !allowed(u)).map((u) => u.href)).toEqual([]);

    // Requests 2, 3 and 5 are plain GETs: no Prefer, no Accept profile, no custom headers.
    for (const request of requests) {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/stories/") && !url.pathname.startsWith("/embed/v1/themes/")) continue;
      expect(request.method()).toBe("GET");
      const headers = await request.allHeaders();
      expect(headers["prefer"]).toBeUndefined();
      expect(headers["accept"] ?? "").not.toContain("profile");
      for (const name of Object.keys(headers)) expect(name).not.toMatch(/^x-/);
    }
    expect(output.errors).toEqual([]);
  });

  test("sends no preflight and no cookies to the stack", async ({ page, context }) => {
    await context.addCookies([{ name: "annoudio-test", value: "1", domain: "localhost", path: "/" }]);
    const project = unique("river-voices");
    // The host page is same-site with the stack here (localhost), so a Lax cookie would go with
    // `credentials: "include"`. The player must still send none.
    await mount(page, player({ ...defaults, project }), { path: "http://localhost:4520/blank.html" });
    await waitForEvent(page, "annoudio:ready");
    const mine = (await stackLog(page)).filter((r) => r.path.includes(project));
    expect(mine.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      `GET /embed/v1/themes/${project}.json`,
      `GET /stories/${project}/rec-0042/`,
    ]);
    for (const r of mine) expect(r.cookie).toBeNull();
  });

  test("plays audio from a host without CORS (the media element has no crossorigin)", async ({ page }) => {
    await mount(page, player({ ...defaults, src: `${STACK}/media/tone-nocors.m4a` }));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    expect(await events(page, "annoudio:error")).toEqual([]);
    expect(await partCount(page, "waveform")).toBe(0);
    await expect.poll(() => partCount(page, "region")).toBe(3);
  });
});

test("16.2 two copies of the loader define the element once and fetch the bundle once", async ({ page }) => {
  const output = watchConsole(page);
  const requests = watchRequests(page);
  await page.goto("/two-loaders.html");
  await waitForEvent(page, "annoudio:ready", 2);
  const bundles = requests.filter((r) => BUNDLE.test(new URL(r.url()).pathname));
  expect(bundles).toHaveLength(1);
  expect(await page.evaluate(() => typeof customElements.get("annoudio-player"))).toBe("function");
  await expect(part(page, "story", 0)).toHaveCount(3);
  await expect(part(page, "story", 1)).toHaveCount(5);
  expect(output.errors).toEqual([]);
});

test.describe("16.3 each error mode shows its message and dispatches annoudio:error", () => {
  const cases: Array<{ name: string; code: string; attrs: Record<string, string>; says: string }> = [
    { name: "project missing", code: "missing-attribute", attrs: { recording: "rec-0042", src: TONE }, says: "project" },
    { name: "recording missing", code: "missing-attribute", attrs: { project: "river-voices", src: TONE }, says: "recording" },
    { name: "src empty", code: "missing-attribute", attrs: { project: "river-voices", recording: "rec-0042", src: "  " }, says: "src" },
    { name: "src not http", code: "invalid-attribute", attrs: { ...defaults, src: "ftp://example.org/a.m4a" }, says: "src" },
    { name: "origin with a path", code: "invalid-attribute", attrs: { ...defaults, origin: `${STACK}/stack` }, says: "origin" },
    { name: "unknown recording", code: "not-found", attrs: { ...defaults, recording: "rec-missing" }, says: "" },
    { name: "unknown project", code: "not-found", attrs: { ...defaults, project: "nobody" }, says: "" },
    { name: "status 500", code: "stories-unavailable", attrs: { ...defaults, recording: "rec-broken" }, says: "" },
    { name: "not a container", code: "stories-unavailable", attrs: { ...defaults, recording: "rec-notcontainer" }, says: "" },
    { name: "audio 404", code: "audio-unavailable", attrs: { ...defaults, src: `${STACK}/media/missing.m4a` }, says: "" },
  ];
  for (const c of cases) {
    test(`${c.code}: ${c.name}`, async ({ page }) => {
      const requests = watchRequests(page);
      await mount(page, player(c.attrs));
      const [error] = await waitForEvent(page, "annoudio:error");
      expect(error?.detail.code).toBe(c.code);
      expect(typeof error?.detail.message).toBe("string");
      expect(error?.detail).toHaveProperty("project");
      expect(error?.detail).toHaveProperty("recording");
      const text = await messageText(page);
      expect(text.length).toBeGreaterThan(10);
      if (c.says) expect(text).toContain(`"${c.says}"`);
      await expect(part(page, "message")).toHaveAttribute("role", "status");

      if (c.code === "missing-attribute" || c.code === "invalid-attribute") {
        // "Shows only the message. No requests."
        await page.waitForTimeout(300);
        const made = requests.map((r) => new URL(r.url())).filter((u) => u.origin === STACK);
        expect(made.filter((u) => u.pathname !== "/embed/v1.js" && !BUNDLE.test(u.pathname))).toEqual([]);
        await expect(part(page, "play-button")).toHaveCount(0);
        expect(await events(page, "annoudio:ready")).toEqual([]);
      }
      if (c.code === "not-found") {
        await waitForEvent(page, "annoudio:ready");
        await expect(part(page, "annotate-link")).toHaveCount(0);
        await expect(part(page, "play-button")).toBeVisible();
        expect((await events(page, "annoudio:ready"))[0]?.detail.stories).toBeNull();
      }
      if (c.code === "stories-unavailable") {
        await waitForEvent(page, "annoudio:ready");
        await expect(part(page, "annotate-link")).toHaveCount(1);
        await expect(part(page, "play-button")).toBeVisible();
      }
      if (c.code === "audio-unavailable") {
        await expect(part(page, "story")).toHaveCount(3);
        await expect(part(page, "timeline")).toBeHidden();
      }
    });
  }

  test("stories-unavailable: network failure", async ({ page }) => {
    await page.route("**/stories/**", (route) => route.abort());
    await mount(page, player(defaults));
    const [error] = await waitForEvent(page, "annoudio:error");
    expect(error?.detail.code).toBe("stories-unavailable");
    await expect(part(page, "annotate-link")).toHaveCount(1);
    await expect(part(page, "play-button")).toBeVisible();
  });

  test("bundle-unavailable: the bundle import fails", async ({ page }) => {
    await page.route(/\/embed\/v1\/[0-9a-f]{12}\/player\.js$/, (route) => route.abort());
    await mount(page, player(defaults));
    const [error] = await waitForEvent(page, "annoudio:error");
    expect(error?.detail).toMatchObject({ code: "bundle-unavailable", project: "river-voices", recording: "rec-0042" });
    expect(await messageText(page)).toContain("could not load");
    await expect(part(page, "play-button")).toHaveCount(0);
  });
});

test.describe("16.4 tokens", () => {
  const accent = (page: import("@playwright/test").Page) =>
    partStyle(page, "play-button", ["background-color"]).then((s) => s["background-color"]);

  test("a token on :root changes the player", async ({ page }) => {
    await mount(page, `<style>:root { --annoudio-color-accent: rgb(1, 2, 3); }</style>${player({ ...defaults, project: "plain" })}`);
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(1, 2, 3)");
  });

  test("a project theme changes the player", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(138, 28, 43)");
    expect((await partStyle(page, "player", ["border-top-left-radius"]))["border-top-left-radius"]).toBe("0px");
  });

  test("the host token on the element wins over the project theme", async ({ page }) => {
    await mount(page, `<style>annoudio-player { --annoudio-color-accent: rgb(4, 5, 6); }</style>${player(defaults)}`);
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(4, 5, 6)");
  });
});

test.describe("16.5 parts", () => {
  const ALL = [
    "player", "controls", "play-button", "time", "timeline", "waveform", "region", "stories",
    "story", "story-text", "story-media", "story-meta", "tag", "annotate-link", "message",
    "replies", "reply", "reply-text", "reply-meta", "reply-link",
  ];

  test("each part in table 3.3 can be styled with ::part()", async ({ page }) => {
    const css = ALL.map((name) => `annoudio-player::part(${name}) { outline: 3px dashed rgb(7, 8, 9); }`).join("\n");
    // The reply fragment opens Asha's story, so its thread shows.
    const hash = `#annoudio-t=1&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=draft&annoudio-reply=${ASHA}`;
    await mount(page, `<style>${css}</style>${player(defaults)}`, { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "waveform")).toBe(1);
    await expect.poll(() => partCount(page, "region")).toBe(3);
    for (const name of ALL) {
      const style = await partStyle(page, name, ["outline-style", "outline-color"]);
      expect(style, name).toEqual({ "outline-style": "dashed", "outline-color": "rgb(7, 8, 9)" });
    }
  });

  test("active is a second part name on the open story and its region", async ({ page }) => {
    const css = `annoudio-player::part(story active) { outline: 4px solid rgb(1, 1, 1); }
      annoudio-player::part(region active) { outline: 4px solid rgb(2, 2, 2); }`;
    await mount(page, `<style>${css}</style>${player(defaults)}`);
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "region")).toBe(3);
    expect(await partCount(page, "active")).toBe(0);
    await part(page, "story").nth(1).getByRole("button").click();
    await expect.poll(() => partCount(page, "active")).toBe(2);
    expect((await partStyle(page, "active", ["outline-color"]))["outline-color"]).toBe("rgb(1, 1, 1)");
    const regionActive = await page.evaluate(() => {
      const host = document.querySelector("annoudio-player") as HTMLElement;
      const find = (root: ParentNode): Element[] => [
        ...root.querySelectorAll('[part~="region"][part~="active"]'),
        ...[...root.querySelectorAll("*")].flatMap((n) => (n.shadowRoot ? find(n.shadowRoot) : [])),
      ];
      const [region] = find(host.shadowRoot as ShadowRoot);
      return region ? getComputedStyle(region).outlineColor : null;
    });
    expect(regionActive).toBe("rgb(2, 2, 2)");
  });

  test("host CSS for button does not change the player; the player's CSS does not change host elements", async ({ page }) => {
    const sample = () =>
      page.evaluate(() => {
        const props = ["color", "background-color", "padding-top", "margin-top", "font-weight", "line-height", "border-top-width", "text-transform", "box-sizing", "display"];
        const out: Record<string, Record<string, string>> = {};
        for (const sel of ["html", "body", ".host-text", ".host-button", ".host-link"]) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const s = getComputedStyle(el);
          out[sel] = Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
        }
        return {
          styles: out,
          html: document.documentElement.outerHTML,
          sheets: document.styleSheets.length,
          adopted: document.adoptedStyleSheets.length,
        };
      });
    // Before: the same page with the loader blocked.
    await page.route("**/embed/v1.js", (route) => route.abort());
    await page.goto("/hostile.html");
    const before = await sample();
    await page.unroute("**/embed/v1.js");
    await page.goto("/hostile.html");
    await waitForEvent(page, "annoudio:ready");
    const after = await sample();
    expect(after).toEqual(before);

    const play = await partStyle(page, "play-button", ["background-color", "padding-top", "border-top-width", "font-weight", "border-top-left-radius"]);
    expect(play).toEqual({
      "background-color": "rgb(138, 28, 43)",
      "padding-top": "0px",
      "border-top-width": "0px",
      "font-weight": "400",
      "border-top-left-radius": "0px",
    });
    const text = await partStyle(page, "story-text", ["color", "text-transform", "letter-spacing", "font-style"]);
    expect(text).toEqual({ color: "rgb(31, 31, 31)", "text-transform": "none", "letter-spacing": "normal", "font-style": "normal" });
    expect((await partStyle(page, "annotate-link", ["color"])).color).toBe("rgb(138, 28, 43)");
    expect((await partStyle(page, "stories", ["list-style-type"]))["list-style-type"]).toBe("none");
  });
});

test.describe("16.6 events", () => {
  test("each event fires with the documented detail", async ({ page }) => {
    await page.route(`${STACK}/annotate**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Annotate page</p>" }));
    await mount(page, player(defaults));
    const [ready] = await waitForEvent(page, "annoudio:ready");
    expect(ready?.detail).toMatchObject({ project: "river-voices", recording: "rec-0042", stories: 3 });
    expect(ready?.detail.duration === null || ready?.detail.duration === 10 || typeof ready?.detail.duration === "number").toBe(true);
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");

    await part(page, "play-button").click();
    const [play] = await waitForEvent(page, "annoudio:play");
    expect(play?.detail).toMatchObject({ project: "river-voices", recording: "rec-0042" });
    expect(typeof play?.detail.time).toBe("number");
    await expect(part(page, "play-button")).toHaveAttribute("aria-label", "Pause");

    await part(page, "play-button").click();
    const [pause] = await waitForEvent(page, "annoudio:pause");
    expect(pause?.detail).toMatchObject({ project: "river-voices", recording: "rec-0042", ended: false });
    expect(typeof pause?.detail.time).toBe("number");

    await page.evaluate(() => (document.querySelector("annoudio-player") as HTMLElement & { seek(s: number): void }).seek(9.6));
    await part(page, "play-button").click();
    const pauses = await waitForEvent(page, "annoudio:pause", 2);
    expect(pauses[1]?.detail.ended).toBe(true);

    await part(page, "story").nth(2).getByRole("button").click();
    const [open] = await waitForEvent(page, "annoudio:story-open");
    expect(open?.detail).toEqual({
      project: "river-voices",
      recording: "rec-0042",
      story: `${STACK}/stories/river-voices/rec-0042/0192f3a4-7c1e-7b10-9d55-000000000003`,
      start: 7.5,
      end: 9,
    });
    // Opening a story does not start playback.
    expect(await events(page, "annoudio:play")).toHaveLength(2);

    const link = part(page, "annotate-link");
    await link.click();
    await page.waitForURL(`${STACK}/annotate**`);
    const href = new URL(page.url());
    expect(href.searchParams.get("t")).toBe("7");
  });

  test("annoudio:annotate fires before the browser leaves, with the full href", async ({ page }) => {
    await mount(page, player(defaults));
    // The host stops the navigation, so the test can read the event on this page.
    await page.evaluate(() => window.addEventListener("click", (e) => e.preventDefault()));
    await waitForEvent(page, "annoudio:ready");
    await part(page, "annotate-link").click();
    const [annotate] = await waitForEvent(page, "annoudio:annotate");
    expect(annotate?.detail).toMatchObject({ project: "river-voices", recording: "rec-0042", time: 0 });
    const href = String(annotate?.detail.href);
    expect(href).toBe(`${STACK}/annotate?project=river-voices&recording=rec-0042&t=0&return=${encodeURIComponent(`${HOST}/blank.html`)}`);
  });

  test("every event bubbles, is composed and is not cancelable", async ({ page }) => {
    await mount(page, player(defaults) + player({ ...defaults, recording: "rec-missing" }));
    await waitForEvent(page, "annoudio:ready", 2);
    await waitForEvent(page, "annoudio:error");
    await part(page, "play-button").click();
    await waitForEvent(page, "annoudio:play");
    await part(page, "play-button").click();
    await waitForEvent(page, "annoudio:pause");
    await part(page, "story").first().getByRole("button").click();
    await waitForEvent(page, "annoudio:story-open");
    const all = await events(page);
    expect(new Set(all.map((e) => e.type))).toEqual(
      new Set([
        "annoudio:ready",
        "annoudio:error",
        "annoudio:play",
        "annoudio:pause",
        "annoudio:story-open",
        "annoudio:timeupdate",
      ]),
    );
    for (const e of all) {
      expect(e).toMatchObject({ bubbles: true, composed: true, cancelable: false });
      expect(Object.keys(e.detail)).toEqual(expect.arrayContaining(["project", "recording"]));
    }
  });
});

test.describe("4.3 currentTime and annoudio:timeupdate (added 2026-10-09)", () => {
  const currentTime = (page: Page, index = 0) =>
    page.evaluate((i) => (document.querySelectorAll("annoudio-player")[i] as HTMLElement & { currentTime: number }).currentTime, index);
  const seekTo = (page: Page, seconds: number) =>
    page.evaluate((s) => (document.querySelector("annoudio-player") as HTMLElement & { seek(s: number): void }).seek(s), seconds);

  test("currentTime is NaN before annoudio:ready, then the position that the player shows", async ({ page }) => {
    // Hold the stories response, so the test can read the time before ready.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`${STACK}/stories/**`, async (route) => {
      await held;
      await route.continue();
    });
    await mount(page, player(defaults));
    await page.evaluate(() => customElements.whenDefined("annoudio-player"));
    expect(await currentTime(page)).toBeNaN();
    await seekTo(page, 4);
    expect(await currentTime(page)).toBeNaN();
    release();
    await waitForEvent(page, "annoudio:ready");
    // A seek that waits for the duration counts (CONTRACT 4.2, rule 3).
    await expect.poll(() => currentTime(page)).toBe(4);
    await expect.poll(() => timeText(page)).toBe("0:04 / 0:10");

    await part(page, "play-button").click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(4.3);
    await part(page, "play-button").click();
    const [pause] = await waitForEvent(page, "annoudio:pause");
    expect(await currentTime(page)).toBe(pause?.detail.time);
  });

  test("currentTime is read-only and NaN after the element leaves the page", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const result = await page.evaluate(() => {
      const el = document.querySelector("annoudio-player") as HTMLElement & { currentTime: number };
      try {
        el.currentTime = 7;
      } catch {
        // In strict mode, a property with only a getter throws, as audio.duration does.
      }
      const after = el.currentTime;
      el.remove();
      return { after, removed: el.currentTime };
    });
    expect(result.after).toBe(0);
    expect(result.removed).toBeNaN();
  });

  test("annoudio:timeupdate fires at most 4 times per second during playback, with currentTime", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    expect(await events(page, "annoudio:timeupdate")).toHaveLength(0);
    await part(page, "play-button").click();
    await waitForEvent(page, "annoudio:timeupdate", 6);
    await part(page, "play-button").click();
    await waitForEvent(page, "annoudio:pause");
    const updates = await events(page, "annoudio:timeupdate");
    for (const [i, e] of updates.entries()) {
      expect(e).toMatchObject({ bubbles: true, composed: true, cancelable: false, index: 0 });
      expect(Object.keys(e.detail).sort()).toEqual(["currentTime", "project", "recording"]);
      expect(e.detail).toMatchObject({ project: "river-voices", recording: "rec-0042" });
      if (i > 0) {
        expect(e.at - updates[i - 1]!.at).toBeGreaterThanOrEqual(245);
        expect(e.detail.currentTime as number).toBeGreaterThan(updates[i - 1]!.detail.currentTime as number);
      }
    }
    // The last update has the time where playback stopped.
    await expect.poll(async () => (await events(page, "annoudio:timeupdate")).at(-1)?.detail.currentTime).toBe(await currentTime(page));
  });

  test("a seek while paused gives one annoudio:timeupdate with the new time", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    await seekTo(page, 6.5);
    const [update] = await waitForEvent(page, "annoudio:timeupdate");
    expect(update?.detail.currentTime).toBe(6.5);
    await page.waitForTimeout(400);
    expect(await events(page, "annoudio:timeupdate")).toHaveLength(1);
  });
});

test.describe("16.7 the Annotate link and the return fragment", () => {
  test("the link carries the current t and return", async ({ page }) => {
    await mount(page, player(defaults), { path: "/blank.html?page=1" });
    await waitForEvent(page, "annoudio:ready");
    const expected = (t: number) =>
      `${STACK}/annotate?project=river-voices&recording=rec-0042&t=${t}&return=${encodeURIComponent(`${HOST}/blank.html?page=1`)}`;
    await expect(part(page, "annotate-link")).toHaveAttribute("href", expected(0));
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    await page.evaluate(() => (document.querySelector("annoudio-player") as HTMLElement & { seek(s: number): void }).seek(7.6));
    await expect(part(page, "annotate-link")).toHaveAttribute("href", expected(7));
  });

  test("the link leaves out return when it is longer than 2000 characters", async ({ page }) => {
    await mount(page, player(defaults), { path: `/blank.html?long=${"x".repeat(2100)}` });
    await waitForEvent(page, "annoudio:ready");
    const href = (await part(page, "annotate-link").getAttribute("href")) ?? "";
    expect(href).toBe(`${STACK}/annotate?project=river-voices&recording=rec-0042&t=0`);
  });

  test("the return fragment seeks and focuses the matching player only, shows the draft note, and does not play", async ({ page }) => {
    const hash = "#annoudio-t=7.5&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=draft";
    const html = `<div style="height: 3000px">Spacer</div>
      ${player({ ...defaults, recording: "rec-paged" })}
      ${player(defaults)}
      ${player(defaults)}`;
    await mount(page, html, { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready", 3);
    await expect.poll(() => timeText(page, 1)).toBe("0:07 / 0:10");
    expect(await timeText(page, 0)).toBe("0:00 / 0:10");
    expect(await timeText(page, 2)).toBe("0:00 / 0:10");
    const focus = await page.evaluate(() => {
      const players = [...document.querySelectorAll("annoudio-player")];
      const active = document.activeElement;
      return {
        index: players.indexOf(active as Element),
        part: (active?.shadowRoot?.activeElement as Element | null)?.getAttribute("part") ?? null,
      };
    });
    expect(focus).toEqual({ index: 1, part: "play-button" });
    await expect(part(page, "player", 1)).toBeInViewport();
    expect(await messageText(page, 1)).toContain("Your story is sent.");
    expect(await messageText(page, 0)).toBe("");
    expect(await messageText(page, 2)).toBe("");
    await page.waitForTimeout(500);
    expect(await events(page, "annoudio:play")).toEqual([]);
    expect(page.url()).toContain(hash); // The player does not remove the fragment.
  });
});

test.describe("16.9 reply threads (added 2026-10-09)", () => {
  test("the thread of a story shows when the story opens: replies in order, text as text, media as story media", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const asha = part(page, "story").nth(2);
    await expect(asha.getByRole("button").first()).toHaveAttribute("aria-expanded", "false");
    await expect(part(page, "replies")).toBeHidden();

    await asha.getByRole("button").first().click();
    await expect(part(page, "replies")).toBeVisible();
    await expect(asha.getByRole("button").first()).toHaveAttribute("aria-expanded", "true");
    await expect(part(page, "reply")).toHaveCount(2);
    await expect(part(page, "reply-meta").nth(0)).toContainText("Ravi");
    await expect(part(page, "reply-meta").nth(1)).toContainText("Leela");
    await expect(part(page, "reply-text").nth(0)).toHaveText("My uncle blew that horn.");
    await expect(part(page, "reply-text").nth(0)).toHaveAttribute("lang", "en");
    await expect(part(page, "reply-text").nth(1)).toHaveText('<img src=x onerror="window.__xss=2">Thank you!');
    const audio = part(page, "reply").nth(0).locator('[part~="story-media"]');
    await expect(audio).toHaveJSProperty("tagName", "AUDIO");
    await expect(audio).toHaveAttribute("preload", "none");
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null)).toBeNull();

    // Another story closes the thread.
    await part(page, "story").nth(1).getByRole("button").click();
    await expect(part(page, "replies")).toBeHidden();
  });

  test("the Reply link goes to the Annotate page with replyTo and the start of the story, and fires annoudio:annotate", async ({ page }) => {
    await mount(page, player(defaults));
    await page.evaluate(() => window.addEventListener("click", (e) => e.preventDefault()));
    await waitForEvent(page, "annoudio:ready");
    await part(page, "story").nth(2).getByRole("button").first().click();
    const link = part(page, "story").nth(2).locator('[part~="reply-link"]');
    await expect(link).toHaveText("Reply");
    const expected = `${STACK}/annotate?project=river-voices&recording=rec-0042&t=7&replyTo=${ASHA}&return=${encodeURIComponent(`${HOST}/blank.html`)}`;
    await expect(link).toHaveAttribute("href", expected);
    await link.click();
    const [annotate] = await waitForEvent(page, "annoudio:annotate");
    expect(annotate?.detail).toEqual({ project: "river-voices", recording: "rec-0042", time: 7.5, href: expected, story: ASHA_IRI });

    // The Annotate link names no story.
    await part(page, "annotate-link").click();
    const [, plain] = await waitForEvent(page, "annoudio:annotate", 2);
    expect(plain?.detail.story).toBeNull();
  });

  test('annotate="none" hides every Reply link; the replies still show', async ({ page }) => {
    await mount(page, player({ ...defaults, annotate: "none" }));
    await waitForEvent(page, "annoudio:ready");
    await part(page, "story").nth(2).getByRole("button").first().click();
    await expect(part(page, "reply")).toHaveCount(2);
    expect(await partCount(page, "reply-link")).toBe(0);
    // A story with no replies has nothing to expand.
    await expect(part(page, "story").nth(1).getByRole("button")).not.toHaveAttribute("aria-expanded", /.*/);

    await page.evaluate(() => document.querySelector("annoudio-player")?.setAttribute("annotate", "link"));
    await expect(part(page, "story").nth(2).locator('[part~="reply-link"]')).toBeVisible();
    expect(await partCount(page, "reply-link")).toBe(3);
  });

  test("the return fragment with annoudio-reply opens that story and shows the reply note", async ({ page }) => {
    const hash = `#annoudio-t=7&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=draft&annoudio-reply=${ASHA}`;
    await mount(page, player(defaults), { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    const [open] = await waitForEvent(page, "annoudio:story-open");
    expect(open?.detail).toMatchObject({ story: ASHA_IRI, start: 7.5, end: 9 });
    await expect(part(page, "story").nth(2)).toHaveAttribute("part", /\bactive\b/);
    await expect(part(page, "replies")).toBeVisible();
    await expect.poll(() => timeText(page)).toBe("0:07 / 0:10");
    expect(await messageText(page)).toBe("Your reply is sent. It shows here after review.");
    expect(await events(page, "annoudio:play")).toEqual([]);
  });

  test("axe finds no violations with an open thread", async ({ page }) => {
    await mount(page, player({ ...defaults, project: "plain" }));
    await waitForEvent(page, "annoudio:ready");
    await part(page, "story").nth(2).getByRole("button").first().click();
    await expect(part(page, "replies")).toBeVisible();
    const result = await new AxeBuilder({ page }).include("annoudio-player").analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("16.10 the project frame and the new fragment keys (added 2026-10-09)", () => {
  test("a theme with a rights line and a licence gives one rights part below the stories, a link", async ({ page }) => {
    await mount(page, player({ ...defaults, project: "framed" }));
    await waitForEvent(page, "annoudio:ready");
    const rights = part(page, "rights");
    await expect(rights).toHaveText("Stories here: CC BY 4.0");
    await expect(rights.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
    expect(await partCount(page, "rights")).toBe(1);
    // Below the stories, and after the Annotate link.
    const order = await page.evaluate(() => {
      const root = document.querySelector("annoudio-player")?.shadowRoot;
      const parts = [...(root?.querySelectorAll("[part]") ?? [])].map((n) => n.getAttribute("part"));
      return ["stories", "annotate-link", "rights"].map((name) => parts.indexOf(name));
    });
    expect(order[0]).toBeLessThan(order[1] ?? -1);
    expect(order[1]).toBeLessThan(order[2] ?? -1);
  });

  test("no rights part without a rights line; text only without a web licence address", async ({ page }) => {
    await mount(page, `${player(defaults)}${player({ ...defaults, project: "rightsonly" })}${player({ ...defaults, project: "unsafe" })}`);
    await waitForEvent(page, "annoudio:ready", 3);
    expect(await partCount(page, "rights", 0)).toBe(0);
    await expect(part(page, "rights", 1)).toHaveText("Stories here: © 2026 Kochi Heritage Trust");
    await expect(part(page, "rights", 1).getByRole("link")).toHaveCount(0);
    await expect(part(page, "rights", 2)).toHaveText("Stories here: Some rights");
    await expect(part(page, "rights", 2).getByRole("link")).toHaveCount(0);
  });

  test("an empty container shows its note and keeps the Annotate link: Tell a story", async ({ page }) => {
    await mount(page, `${player({ ...defaults, recording: "rec-empty" })}${player({ ...defaults, recording: "rec-empty", annotate: "none" })}`);
    await waitForEvent(page, "annoudio:ready", 2);
    expect(await messageText(page, 0)).toBe("No stories yet. Tell the first one.");
    await expect(part(page, "annotate-link", 0)).toHaveText("Tell a story");
    expect(await messageText(page, 1)).toBe("No stories yet.");
  });

  test("after a save, an empty container shows only the note of the save", async ({ page }) => {
    const hash = "#annoudio-t=2&annoudio-project=river-voices&annoudio-recording=rec-empty&annoudio-saved=draft";
    await mount(page, player({ ...defaults, recording: "rec-empty" }), { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    expect(await messageText(page)).toBe("Your story is sent. It shows here after review.");
  });

  test("annoudio-saved=published shows the published note", async ({ page }) => {
    const hash = "#annoudio-t=2&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=published";
    await mount(page, player(defaults), { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    expect(await messageText(page)).toBe("Your story is published. It can take one minute to show.");
    expect(await events(page, "annoudio:story-open")).toEqual([]);
  });

  test("annoudio-story opens that story with no note", async ({ page }) => {
    const hash = `#annoudio-t=7&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-story=${ASHA}`;
    await mount(page, player(defaults), { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    const [open] = await waitForEvent(page, "annoudio:story-open");
    expect(open?.detail).toMatchObject({ story: ASHA_IRI, start: 7.5 });
    await expect(part(page, "story").nth(2)).toHaveAttribute("part", /\bactive\b/);
    expect(await messageText(page)).toBe("");
    expect(await events(page, "annoudio:play")).toEqual([]);
  });

  test("annoudio-story with the id of a reply opens nothing: a reply is not an item", async ({ page }) => {
    const reply = "0192f3a4-7c1e-7b10-9d55-000000000031";
    await mount(page, player(defaults), {
      path: `/blank.html#annoudio-t=0&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-story=${reply}`,
    });
    await waitForEvent(page, "annoudio:ready");
    await page.waitForTimeout(300);
    expect(await events(page, "annoudio:story-open")).toEqual([]);
  });

  test("axe finds no violations with the rights part, the empty note and a published note", async ({ page }) => {
    const hash = "#annoudio-t=0&annoudio-project=framed&annoudio-recording=rec-empty&annoudio-saved=published";
    await mount(page, player({ ...defaults, project: "framed", recording: "rec-empty" }), { path: `/blank.html${hash}` });
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "rights")).toBeVisible();
    const result = await new AxeBuilder({ page }).include("annoudio-player").analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("16.8 keyboard and accessibility", () => {
  test("keyboard only: play, seek, open a story, follow the Annotate link", async ({ page, browserName }) => {
    await page.route(`${STACK}/annotate**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Annotate</p>" }));
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    const focused = () =>
      page.evaluate(() => {
        const active = document.activeElement?.shadowRoot?.activeElement as HTMLElement | null | undefined;
        if (!active) return null;
        return active.getAttribute("part") ?? active.getAttribute("aria-label") ?? active.tagName;
      });
    // WebKit moves focus to links and buttons with Tab only when the "Tab to all" option is on: use Alt+Tab there.
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";

    await page.keyboard.press(tab);
    expect(await focused()).toBe("play-button");
    await page.keyboard.press("Enter");
    await waitForEvent(page, "annoudio:play");
    await page.keyboard.press("Space");
    await waitForEvent(page, "annoudio:pause");

    await page.keyboard.press(tab);
    expect(await focused()).toBe("Seek");
    await page.keyboard.press("Home");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => timeText(page)).toBe("0:05 / 0:10");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    await page.keyboard.press("PageUp");
    await expect.poll(() => timeText(page)).toBe("0:10 / 0:10");
    await page.keyboard.press("Home");
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    await page.keyboard.press("End");
    await expect.poll(() => timeText(page)).toBe("0:10 / 0:10");

    await page.keyboard.press(tab);
    expect(await focused()).toBe("Story by Leela, 0:02 to 0:04");
    await page.keyboard.press("Enter");
    const [open] = await waitForEvent(page, "annoudio:story-open");
    expect(open?.detail.start).toBe(2);
    await expect.poll(() => timeText(page)).toBe("0:02 / 0:10");

    // The voice note of Leela's story has its own controls: one or more tab stops.
    await page.keyboard.press(tab);
    expect(await focused()).toBe("story-media");
    for (let i = 0; i < 10 && (await focused()) === "story-media"; i++) await page.keyboard.press(tab);
    // The thread of the open story ends with its Reply link (CONTRACT 7.3).
    expect(await focused()).toBe("reply-link");
    await page.keyboard.press(tab);
    expect(await focused()).toBe("Story by Ravi, 0:05 to 0:06");
    await page.keyboard.press(tab);
    expect(await focused()).toBe("Story by Asha, 0:07 to 0:09, 2 replies");
    await page.keyboard.press(tab);
    expect(await focused()).toBe("annotate-link");
    await page.keyboard.press("Enter");
    await page.waitForURL(`${STACK}/annotate**`);
    expect(new URL(page.url()).searchParams.get("t")).toBe("2");
  });

  test("axe finds no violations with default tokens", async ({ page }) => {
    await mount(page, player({ ...defaults, project: "plain" }));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "region")).toBe(3);
    const result = await new AxeBuilder({ page }).include("annoudio-player").analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("axe finds no violations in an error state", async ({ page }) => {
    await mount(page, player({ ...defaults, project: "plain", recording: "rec-missing" }));
    await waitForEvent(page, "annoudio:error");
    const result = await new AxeBuilder({ page }).include("annoudio-player").analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
