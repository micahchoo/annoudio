// Tests beyond CONTRACT section 16: sharing, cascade, timing, paging, waveform, motion, CSP,
// lifecycle and the seek() rules. They use only the public surface.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  defaults,
  events,
  messageText,
  mount,
  part,
  partCount,
  partStyle,
  player,
  recordEvents,
  STACK,
  timeText,
  unique,
  waitForEvent,
  watchConsole,
  watchRequests,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await recordEvents(page);
});

const seek = (page: Page, seconds: unknown, index = 0) =>
  page.evaluate(
    ({ seconds, index }) =>
      (document.querySelectorAll("annoudio-player")[index] as HTMLElement & { seek(s: unknown): unknown }).seek(seconds),
    { seconds, index },
  );

test.describe("two players on one page", () => {
  test("both render; one theme request per project; one stories request per instance", async ({ page }) => {
    const output = watchConsole(page);
    const requests = watchRequests(page);
    const project = unique("river-voices");
    await mount(
      page,
      player({ ...defaults, project }) + player({ ...defaults, project }) + player({ ...defaults, project, recording: "rec-paged" }),
    );
    await waitForEvent(page, "annoudio:ready", 3);
    await expect(part(page, "story", 0)).toHaveCount(3);
    await expect(part(page, "story", 1)).toHaveCount(3);
    await expect(part(page, "story", 2)).toHaveCount(5);
    const paths = requests.map((r) => new URL(r.url())).filter((u) => u.pathname.includes(project));
    const count = (p: string, search = "") => paths.filter((u) => u.pathname === p && u.search === search).length;
    expect(count(`/embed/v1/themes/${project}.json`)).toBe(1);
    expect(count(`/stories/${project}/rec-0042/`)).toBe(1);
    expect(count(`/stories/${project}/rec-paged/`)).toBe(1);
    expect(output.errors).toEqual([]);
  });

  test("when one player starts, the other pauses", async ({ page }) => {
    await mount(page, player(defaults) + player({ ...defaults, recording: "rec-paged" }));
    await waitForEvent(page, "annoudio:ready", 2);
    await part(page, "play-button", 0).click();
    await waitForEvent(page, "annoudio:play", 1);
    await part(page, "play-button", 1).click();
    await waitForEvent(page, "annoudio:play", 2);
    const pauses = await waitForEvent(page, "annoudio:pause", 1);
    expect(pauses[0]).toMatchObject({ index: 0, detail: { recording: "rec-0042", ended: false } });
    await expect(part(page, "play-button", 0)).toHaveAttribute("aria-label", "Play");
    await expect(part(page, "play-button", 1)).toHaveAttribute("aria-label", "Pause");
  });
});

test.describe("theme cascade (CONTRACT 3.1, rule 3)", () => {
  const accent = (page: Page) => partStyle(page, "play-button", ["background-color"]).then((s) => s["background-color"]);
  const ANCESTOR = "<style>body { --annoudio-color-accent: rgb(30, 30, 30); }</style>";
  const ELEMENT = "<style>annoudio-player { --annoudio-color-accent: rgb(40, 40, 40); }</style>";

  test("element rule beats project theme beats ancestor rule beats default", async ({ page }) => {
    // Default: no theme, no host token.
    await mount(page, player({ ...defaults, project: "plain" }));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(11, 110, 153)"); // #0b6e99 (design-system §7)

    // Ancestor beats default.
    await mount(page, ANCESTOR + player({ ...defaults, project: "plain" }));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(30, 30, 30)");

    // Project theme beats ancestor.
    await mount(page, ANCESTOR + player(defaults));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(138, 28, 43)");

    // Element rule beats project theme (and ancestor).
    await mount(page, ANCESTOR + ELEMENT + player(defaults));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(40, 40, 40)");
  });

  test("a project theme value that fails CSS.supports is ignored with one warning; other keys are ignored", async ({ page }) => {
    const output = watchConsole(page);
    await mount(page, player({ ...defaults, project: "bad" }));
    await waitForEvent(page, "annoudio:ready");
    expect(await accent(page)).toBe("rgb(11, 110, 153)");
    expect((await partStyle(page, "player", ["border-top-left-radius"]))["border-top-left-radius"]).toBe("12px");
    await expect(part(page, "player")).toBeVisible();
    const themeWarnings = output.warnings.filter((w) => w.includes("project theme"));
    expect(themeWarnings).toHaveLength(2); // color-accent and space
  });
});

test.describe("the 500 ms rule (CONTRACT 3.2, rule 5)", () => {
  test("controls show before a slow theme arrives; the theme then replaces the defaults in place", async ({ page }) => {
    const start = Date.now();
    await mount(page, player({ ...defaults, project: "slow" }));
    await waitForEvent(page, "annoudio:ready");
    const readyAfter = Date.now() - start;
    expect(readyAfter).toBeLessThan(2000); // The theme takes 2500 ms.
    await expect(part(page, "play-button")).toBeVisible();
    expect((await partStyle(page, "play-button", ["background-color"]))["background-color"]).toBe("rgb(11, 110, 153)");
    await expect
      .poll(async () => (await partStyle(page, "play-button", ["background-color"]))["background-color"], { timeout: 6000 })
      .toBe("rgb(0, 100, 0)");
    expect(await events(page, "annoudio:ready")).toHaveLength(1);
  });

  test("controls wait for a fast theme, so the defaults never flash", async ({ page }) => {
    await mount(page, player(defaults));
    await expect(part(page, "play-button")).toBeVisible();
    expect((await partStyle(page, "play-button", ["background-color"]))["background-color"]).toBe("rgb(138, 28, 43)");
  });
});

test.describe("paging (CONTRACT 6, rules 4 and 6)", () => {
  test("follows next links and shows the stories in container order", async ({ page }) => {
    const requests = watchRequests(page);
    const project = unique("river-voices");
    await mount(page, player({ ...defaults, project, recording: "rec-paged" }));
    const [ready] = await waitForEvent(page, "annoudio:ready");
    expect(ready?.detail.stories).toBe(5);
    await expect(part(page, "story-text")).toHaveText([1, 2, 3, 4, 5].map((n) => `Story number ${n}.`));
    const searches = requests
      .map((r) => new URL(r.url()))
      .filter((u) => u.pathname === `/stories/${project}/rec-paged/`)
      .map((u) => u.search);
    expect(searches).toEqual(["", "?page=1", "?page=2"]);
  });

  test("follows at most 20 next links, then shows a note", async ({ page }) => {
    await mount(page, player({ ...defaults, recording: "rec-long" }));
    const [ready] = await waitForEvent(page, "annoudio:ready");
    expect(ready?.detail.stories).toBe(21);
    await expect(part(page, "story")).toHaveCount(21);
    expect(await messageText(page)).toContain("21");
    expect(await events(page, "annoudio:error")).toEqual([]);
  });

  test("an instance with no stories shows the controls and no list items", async ({ page }) => {
    await mount(page, player({ ...defaults, recording: "rec-empty" }));
    const [ready] = await waitForEvent(page, "annoudio:ready");
    expect(ready?.detail.stories).toBe(0);
    await expect(part(page, "story")).toHaveCount(0);
    await expect(part(page, "play-button")).toBeVisible();
  });
});

test.describe("waveform (CONTRACT 6, request 5)", () => {
  test("with CORS and Content-Length, the player draws a waveform", async ({ page }) => {
    await mount(page, player(defaults));
    await expect.poll(() => partCount(page, "waveform")).toBe(1);
    await expect.poll(() => partCount(page, "region")).toBe(3);
  });

  test("without Content-Length, the player skips the waveform and still shows the timeline and regions", async ({ page }) => {
    const output = watchConsole(page);
    await mount(page, player({ ...defaults, src: `${STACK}/media/tone-nolength.m4a` }));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "region")).toBe(3);
    await page.waitForTimeout(500);
    expect(await partCount(page, "waveform")).toBe(0);
    await expect(part(page, "timeline")).toBeVisible();
    expect(await events(page, "annoudio:error")).toEqual([]);
    expect(output.errors).toEqual([]);
  });
});

test.describe("story bodies", () => {
  test("text renders with textContent only (XSS invariant)", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "story-text").nth(1)).toHaveText('<img src=x onerror="window.__xss=1"><b>bold?</b>');
    const injected = await page.evaluate(() => {
      const root = (document.querySelector("annoudio-player") as HTMLElement).shadowRoot as ShadowRoot;
      return { xss: (window as unknown as { __xss?: number }).__xss ?? null, img: root.querySelectorAll("img, b").length };
    });
    expect(injected).toEqual({ xss: null, img: 0 });
  });

  test("text bodies carry their language; tags show their labels", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "story-text").first()).toHaveAttribute("lang", "ml");
    await expect(part(page, "tag")).toHaveText(["Ferry", "Horn", "River"]);
    await expect(part(page, "tag").first()).toHaveAttribute("lang", "en");
    await expect(part(page, "story-meta").first()).toContainText("Leela");
    await expect(part(page, "story").first().getByRole("button")).toHaveAccessibleName("Story by Leela, 0:02 to 0:04");
    await expect(part(page, "player")).toHaveAttribute("aria-label", "River Voices: Ferry crossing, 1962");
    await expect(part(page, "player")).toHaveAttribute("lang", "en");
  });
});

test.describe("media bodies (CONTRACT 3.3 story-media, 6 request 7)", () => {
  const media = { ...defaults, recording: "rec-media" };

  test("Sound is an audio element, Image a lazy img with the story text as alt, Video a video element", async ({ page }) => {
    const output = watchConsole(page);
    await mount(page, player(media));
    await waitForEvent(page, "annoudio:ready");
    const parts = part(page, "story-media");
    await expect(parts).toHaveCount(3);

    const audio = part(page, "story").nth(0).locator('[part~="story-media"]');
    await expect(audio).toHaveJSProperty("tagName", "AUDIO");
    await expect(audio).toHaveAttribute("src", `${STACK}/media/voice.m4a`);
    await expect(audio).toHaveJSProperty("controls", true);
    await expect(audio).toHaveJSProperty("preload", "none");
    await expect(audio).toHaveAttribute("aria-label", "Voice note by Leela");
    expect(await audio.getAttribute("crossorigin")).toBeNull();

    const img = part(page, "story").nth(1).locator('[part~="story-media"]');
    await expect(img).toHaveJSProperty("tagName", "IMG");
    await expect(img).toHaveAttribute("src", `${STACK}/media/photo.jpg`);
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("alt", "The ferry in 1962.");
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(64);

    const video = part(page, "story").nth(2).locator('[part~="story-media"]');
    await expect(video).toHaveJSProperty("tagName", "VIDEO");
    await expect(video).toHaveAttribute("src", `${STACK}/media/clip.mp4`);
    await expect(video).toHaveJSProperty("controls", true);
    await expect(video).toHaveJSProperty("preload", "metadata");
    await expect(video).toHaveAttribute("aria-label", "Video by Asha");
    expect(output.errors).toEqual([]);
  });

  test("a body URL that is not http or https never becomes a src", async ({ page }) => {
    await mount(page, player(media));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "story").nth(2).locator("img")).toHaveCount(0);
    const sources = await page.evaluate(() => {
      const root = (document.querySelector("annoudio-player") as HTMLElement).shadowRoot as ShadowRoot;
      return [...root.querySelectorAll("[src]")].map((node) => node.getAttribute("src"));
    });
    expect(sources.filter((src) => !src?.startsWith("http"))).toEqual([]);
  });

  test("a voice note loads no bytes before the visitor plays it (WebKit: one request)", async ({ page, browserName }) => {
    const requests = watchRequests(page);
    await mount(page, player(media));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "story-media")).toHaveCount(3);
    await page.waitForTimeout(500);
    const voice = requests.filter((r) => r.url().endsWith("/media/voice.m4a"));
    if (browserName !== "webkit") {
      expect(voice.map((r) => r.url())).toEqual([]);
      return;
    }
    // WebKit takes `preload="none"` as a hint only: it gets the file once (phase4b-notes).
    expect(voice.length).toBeLessThanOrEqual(1);
  });

  test("playing a voice note pauses the recording", async ({ page }) => {
    await mount(page, player(media));
    await waitForEvent(page, "annoudio:ready");
    await part(page, "play-button").click();
    await waitForEvent(page, "annoudio:play");
    await part(page, "story").nth(0).locator('[part~="story-media"]').evaluate((node: HTMLAudioElement) => node.play());
    await waitForEvent(page, "annoudio:pause");
  });

  test("axe finds no violations in a story list with media bodies", async ({ page }) => {
    await mount(page, player(media));
    await waitForEvent(page, "annoudio:ready");
    const results = await new AxeBuilder({ page }).include("annoudio-player").analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("attributes (CONTRACT 2.1)", () => {
  test("a change to recording restarts the player", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "story")).toHaveCount(3);
    await page.evaluate(() => document.querySelector("annoudio-player")?.setAttribute("recording", "rec-paged"));
    const ready = await waitForEvent(page, "annoudio:ready", 2);
    expect(ready[1]?.detail).toMatchObject({ recording: "rec-paged", stories: 5 });
    await expect(part(page, "story")).toHaveCount(5);
  });

  test("spaces around values are trimmed; a change that trims to the same value does not restart", async ({ page }) => {
    await mount(page, player({ ...defaults, recording: "  rec-0042  " }));
    const [ready] = await waitForEvent(page, "annoudio:ready");
    expect(ready?.detail.recording).toBe("rec-0042");
    await page.evaluate(() => document.querySelector("annoudio-player")?.setAttribute("recording", "rec-0042"));
    await page.waitForTimeout(500);
    expect(await events(page, "annoudio:ready")).toHaveLength(1);
  });

  test('annotate="none" hides the link; an unknown value counts as "link" with one warning', async ({ page }) => {
    const output = watchConsole(page);
    await mount(page, player({ ...defaults, annotate: "none" }));
    await waitForEvent(page, "annoudio:ready");
    await expect(part(page, "annotate-link")).toHaveCount(0);
    await page.evaluate(() => document.querySelector("annoudio-player")?.setAttribute("annotate", "sometimes"));
    await expect(part(page, "annotate-link")).toHaveCount(1);
    expect(output.warnings.filter((w) => w.includes("sometimes"))).toHaveLength(1);
    expect(await events(page, "annoudio:ready")).toHaveLength(1); // Display update only.
  });

  test("the origin attribute sets where the player reads stories", async ({ page }) => {
    const requests = watchRequests(page);
    await mount(page, player({ ...defaults, origin: "http://127.0.0.1:4510" }));
    await waitForEvent(page, "annoudio:ready");
    expect(requests.some((r) => r.url() === "http://127.0.0.1:4510/stories/river-voices/rec-0042/")).toBe(true);
    await expect(part(page, "annotate-link")).toHaveAttribute("href", /^http:\/\/127\.0\.0\.1:4510\/annotate\?/);
  });
});

test.describe("lifecycle", () => {
  test("elements that the page adds later also start", async ({ page }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), player({ ...defaults, recording: "rec-paged" }));
    await waitForEvent(page, "annoudio:ready", 2);
    await expect(part(page, "story", 1)).toHaveCount(5);
  });

  test("fallback content shows until the loader runs, and the player hides it when it starts", async ({ page }) => {
    await page.route("**/embed/v1.js", (route) => route.abort());
    await page.goto("/fallback.html");
    await expect(page.locator("a.fallback")).toBeVisible();
    await page.unroute("**/embed/v1.js");
    await page.goto("/fallback.html");
    await waitForEvent(page, "annoudio:ready");
    await expect(page.locator("a.fallback")).toBeHidden();
  });

  test("when the element leaves the document, it cancels its open requests", async ({ page }) => {
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(new URL(r.url()).pathname));
    const project = unique("slow");
    await mount(page, player({ ...defaults, project }));
    await page.waitForTimeout(300); // The slow theme takes 2500 ms.
    await page.evaluate(() => document.querySelector("annoudio-player")?.remove());
    await expect.poll(() => failed).toContain(`/embed/v1/themes/${project}.json`);
    expect(await events(page, "annoudio:ready")).toEqual([]);
  });

  test("the loader in a page with no custom elements support does nothing (fallback stays)", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "customElements", { value: undefined, configurable: true });
    });
    const output = watchConsole(page);
    await page.goto("/fallback.html");
    await page.waitForTimeout(500);
    await expect(page.locator("a.fallback")).toBeVisible();
    expect(output.errors).toEqual([]);
  });
});

test.describe("seek() (CONTRACT 4.2)", () => {
  test("limits the value, keeps it before the duration is known, ignores non-numbers, never throws", async ({ page }) => {
    const output = watchConsole(page);
    await mount(page, player(defaults));
    await page.evaluate(() => customElements.whenDefined("annoudio-player"));
    // Before the duration is known: kept, then applied.
    expect(await seek(page, 3)).toBeUndefined();
    await expect.poll(() => timeText(page)).toBe("0:03 / 0:10");
    await seek(page, 99);
    await expect.poll(() => timeText(page)).toBe("0:10 / 0:10");
    await seek(page, -4);
    await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
    for (const bad of ["5", Number.NaN, null, Number.POSITIVE_INFINITY]) {
      expect(await seek(page, bad)).toBeUndefined();
    }
    expect(await timeText(page)).toBe("0:00 / 0:10");
    expect(output.warnings.filter((w) => w.includes("seek()"))).toHaveLength(4);
    expect(await events(page, "annoudio:play")).toEqual([]);
  });
});

test.describe("motion and layout (CONTRACT 11)", () => {
  test("prefers-reduced-motion: no transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "region")).toBe(3);
    for (const name of ["play-button", "region", "annotate-link", "story"]) {
      const style = await partStyle(page, name, ["transition-duration"]);
      expect(style["transition-duration"].split(",").every((d) => d.trim() === "0s"), name).toBe(true);
    }
  });

  test("without reduced motion, the play button has a transition (the reduce rule above is not empty)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const style = await partStyle(page, "play-button", ["transition-duration"]);
    expect(style["transition-duration"]).not.toBe("0s");
  });

  test("reflow: the player works at 280 CSS px with no horizontal scroll inside it", async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 800 });
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const overflow = await page.evaluate(() => {
      const frame = (document.querySelector("annoudio-player") as HTMLElement).shadowRoot?.querySelector('[part~="player"]') as HTMLElement;
      return { scroll: frame.scrollWidth, client: frame.clientWidth, page: document.documentElement.scrollWidth };
    });
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    expect(overflow.page).toBeLessThanOrEqual(280);
  });

  test("target size: every control is at least 24 x 24 CSS px; the focus ring is at least 2 px", async ({ page, browserName }) => {
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    const ring = await partStyle(page, "play-button", ["outline-style", "outline-width", "outline-color"]);
    expect(ring["outline-style"]).toBe("solid");
    expect(Number.parseFloat(ring["outline-width"] ?? "0")).toBeGreaterThanOrEqual(2);
    expect(ring["outline-color"]).toBe("rgb(11, 110, 153)");

    // Open the story with replies, so that its thread and Reply link show.
    await part(page, "story").nth(2).getByRole("button").first().click();
    const sizes = await page.evaluate(() => {
      const root = (document.querySelector("annoudio-player") as HTMLElement).shadowRoot as ShadowRoot;
      // A control in a closed thread renders no box: a visitor cannot reach it.
      return [...root.querySelectorAll("button, a, input")]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const box = el.getBoundingClientRect();
          return { w: box.width, h: box.height, label: el.getAttribute("aria-label") ?? el.textContent };
        });
    });
    expect(sizes.map((size) => size.label)).toContain("Reply to the story by Asha");
    for (const size of sizes) {
      expect(size.w, String(size.label)).toBeGreaterThanOrEqual(24);
      expect(size.h, String(size.label)).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe("content security policy (CONTRACT 13)", () => {
  test("style-src 'self' does not block the constructed stylesheets; the player works", async ({ page }) => {
    await page.goto("/csp-bare.html");
    await waitForEvent(page, "annoudio:ready");
    // Base sheet and project theme sheet both apply.
    const play = await partStyle(page, "play-button", ["background-color", "border-top-left-radius"]);
    expect(play).toEqual({ "background-color": "rgb(138, 28, 43)", "border-top-left-radius": "0px" });
    await expect(part(page, "story")).toHaveCount(3);
    await expect.poll(() => partCount(page, "region")).toBe(3);
    const violations = await page.evaluate(() => (window as unknown as { __csp: Array<{ directive: string }> }).__csp);
    // The only violation is the <style> element that wavesurfer.js puts in its own shadow root.
    expect(new Set(violations.map((v) => v.directive.split(" ")[0]))).toEqual(new Set(["style-src-elem"]));
  });

  test("under the strict CSP, the waveform layout holds: nothing overflows the timeline", async ({ page }) => {
    await page.goto("/csp-bare.html");
    await waitForEvent(page, "annoudio:ready");
    await expect.poll(() => partCount(page, "waveform")).toBe(1);
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const root = (document.querySelector("annoudio-player") as HTMLElement).shadowRoot as ShadowRoot;
      const timeline = root.querySelector('[part~="timeline"]') as HTMLElement;
      const waveform = root.querySelector('[part~="waveform"]') as HTMLElement;
      return { timeline: [timeline.scrollHeight, timeline.clientHeight], waveform: [waveform.scrollHeight, waveform.clientHeight] };
    });
    expect(box.timeline[0]).toBeLessThanOrEqual((box.timeline[1] ?? 0) + 1);
    expect(box.waveform[0]).toBeLessThanOrEqual((box.waveform[1] ?? 0) + 1);
  });
});

test("size: v1.js is at most 1 KB and the bundle at most 80 KB after gzip (CONTRACT 10, rule 1)", async ({ browserName }) => {
  test.skip(browserName !== "chromium", "A build check: run it once.");
  const out = resolve(import.meta.dirname, "../../app/public/embed");
  const loader = readFileSync(join(out, "v1.js"));
  expect(gzipSync(loader).length).toBeLessThanOrEqual(1024);
  const current = /\/embed\/v1\/([0-9a-f]{12})\/player\.js/.exec(loader.toString())?.[1];
  expect(current).toBeTruthy();
  const bundle = readFileSync(join(out, "v1", String(current), "player.js"));
  expect(gzipSync(bundle).length).toBeLessThanOrEqual(80 * 1024);
  // At most two older bundles stay next to the current one.
  const dirs = readdirSync(join(out, "v1")).filter((d) => statSync(join(out, "v1", d)).isDirectory() && /^[0-9a-f]{12}$/.test(d));
  expect(dirs).toContain(current);
  expect(dirs.length).toBeLessThanOrEqual(3);
});

test.describe("more invariants", () => {
  test("the loader and the bundle create no global variables (CONTRACT 5, rule 2)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __before: string[] }).__before = Object.getOwnPropertyNames(window);
    });
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const added = await page.evaluate(() => {
      const before = new Set((window as unknown as { __before: string[] }).__before);
      return Object.getOwnPropertyNames(window).filter((n) => !before.has(n) && n !== "__before" && n !== "__events" && n !== "__csp");
    });
    expect(added).toEqual([]);
  });

  test("the player does no timeline work before it is near the viewport (CONTRACT 10, rule 5)", async ({ page }) => {
    const requests = watchRequests(page);
    await mount(page, `<div style="height: 6000px">Spacer</div>${player(defaults)}`);
    await waitForEvent(page, "annoudio:ready"); // Stories still load.
    await page.waitForTimeout(500);
    const waveformFetches = () =>
      requests.filter((r) => r.url() === `${STACK}/media/tone.m4a` && r.resourceType() === "fetch").length;
    expect(waveformFetches()).toBe(0);
    expect(await partCount(page, "region")).toBe(0);
    await part(page, "player").scrollIntoViewIfNeeded();
    await expect.poll(waveformFetches).toBe(1);
    await expect.poll(() => partCount(page, "region")).toBe(3);
  });

  test("forced colours: the player uses system colours, not the colour tokens (CONTRACT 3.1, rule 5)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium can emulate forced-colors.");
    await page.emulateMedia({ forcedColors: "active" });
    await mount(page, player(defaults));
    await waitForEvent(page, "annoudio:ready");
    const play = await partStyle(page, "play-button", ["background-color", "border-top-style"]);
    expect(play["background-color"]).not.toBe("rgb(138, 28, 43)");
    expect(play["border-top-style"]).toBe("solid");
  });
});
