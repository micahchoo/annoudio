// ROADMAP Phase 2 "done when": the snippet, pasted by hand into three host pages, works in
// Chromium, Firefox and WebKit with no CSS leak either way.
// The WordPress and Omeka S pages come from deploy/test-hosts (run its setup.sh first).

import { expect, test, type Page } from "@playwright/test";
import { events, part, partCount, recordEvents, STACK, timeText, waitForEvent, watchConsole } from "./helpers";

const HOSTS = [
  { name: "bare static page", url: "http://127.0.0.1:4520/bare.html" },
  { name: "WordPress (Custom HTML block)", url: "http://localhost:8091/?pagename=player" },
  { name: "Omeka S (page HTML block)", url: "http://localhost:8092/s/annoudio/page/player" },
];

/** Properties that do not depend on the inherited font: they must be equal on every host. */
const PART_PROPS = [
  "color", "background-color", "border-top-color", "border-top-style", "border-top-width",
  "border-top-left-radius", "padding-top", "padding-left", "margin-top", "margin-left",
  "font-weight", "font-style", "text-transform", "letter-spacing", "word-spacing", "text-align",
  "text-decoration-line", "list-style-type", "box-sizing", "visibility", "text-shadow", "outline-style",
];
const PARTS = ["player", "controls", "play-button", "time", "timeline", "stories", "story", "story-meta", "story-text", "tag", "annotate-link"];

async function partSnapshot(page: Page) {
  return page.evaluate(
    ({ parts, props }) => {
      const host = document.querySelector("annoudio-player") as HTMLElement;
      const root = host.shadowRoot as ShadowRoot;
      const out: Record<string, Record<string, string>> = {};
      for (const name of parts) {
        const el = root.querySelector(`[part~="${name}"]`);
        if (!el) continue;
        const s = getComputedStyle(el);
        // Spacing is in em on purpose (table 3.1: sizes scale from the inherited font size):
        // compare it in proportion to the font size.
        const size = Number.parseFloat(s.fontSize);
        const value = (p: string) =>
          /^(padding|margin)-/.test(p) ? (Number.parseFloat(s.getPropertyValue(p)) / size).toFixed(3) : s.getPropertyValue(p);
        out[name] = Object.fromEntries(props.map((p) => [p, value(p)]));
        // Line height in proportion to the font size: the player sets 1.4 on its frame.
        out[name]["line-height-ratio"] = (Number.parseFloat(s.lineHeight) / Number.parseFloat(s.fontSize)).toFixed(2);
      }
      return out;
    },
    { parts: PARTS, props: PART_PROPS },
  );
}

/** A sample of host elements, to show that the player changes nothing outside itself. */
async function hostSnapshot(page: Page) {
  return page.evaluate(() => {
    const props = ["color", "background-color", "font-family", "font-size", "font-weight", "line-height", "margin-top", "padding-top", "text-transform", "letter-spacing", "display"];
    const player = document.querySelector("annoudio-player");
    const targets: Record<string, Element | null> = {
      html: document.documentElement,
      body: document.body,
      h1: document.querySelector("h1"),
      p: document.querySelector("p"),
      a: document.querySelector("a"),
      button: document.querySelector("button"),
      "player parent": player?.parentElement ?? null,
    };
    const styles: Record<string, Record<string, string>> = {};
    for (const [key, el] of Object.entries(targets)) {
      if (!el) continue;
      const s = getComputedStyle(el);
      styles[key] = Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    }
    return {
      styles,
      styleElements: document.querySelectorAll("style, link[rel=stylesheet]").length,
      adopted: document.adoptedStyleSheets.length,
      // Scripts are left out: WordPress's emoji loader adds one later on some browsers.
      elements: document.querySelectorAll("body *:not(script)").length,
    };
  });
}

async function reachable(page: Page, url: string): Promise<boolean> {
  try {
    const response = await page.request.get(url, { timeout: 5000 });
    return response.ok() && (await response.text()).includes("annoudio-player");
  } catch {
    return false;
  }
}

test.beforeEach(async ({ page }) => {
  await recordEvents(page);
});

for (const host of HOSTS) {
  test.describe(host.name, () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!(await reachable(page, host.url)), `${host.url} is not up: run deploy/test-hosts/setup.sh`);
    });

    test("renders stories, fires annoudio:ready, makes no console errors, and has a correct Annotate link", async ({ page }) => {
      const output = watchConsole(page);
      await page.goto(host.url);
      const [ready] = await waitForEvent(page, "annoudio:ready");
      expect(ready?.detail).toMatchObject({ project: "river-voices", recording: "rec-0042", stories: 3 });
      await expect(part(page, "story")).toHaveCount(3);
      await expect(part(page, "story-text").first()).toHaveText("My grandmother sang this on the ferry.");
      await expect.poll(() => partCount(page, "region")).toBe(3);
      await expect.poll(() => timeText(page)).toBe("0:00 / 0:10");
      const pageUrl = page.url().split("#")[0] ?? "";
      await expect(part(page, "annotate-link")).toHaveAttribute(
        "href",
        `${STACK}/annotate?project=river-voices&recording=rec-0042&t=0&return=${encodeURIComponent(pageUrl)}`,
      );
      expect(output.errors).toEqual([]);
      expect(await events(page, "annoudio:error")).toEqual([]);
    });

    test("no CSS leaks in: the player's parts look the same as on the bare page", async ({ page }) => {
      await page.goto(HOSTS[0]?.url ?? "");
      await waitForEvent(page, "annoudio:ready");
      const reference = await partSnapshot(page);
      await page.goto(host.url);
      await waitForEvent(page, "annoudio:ready");
      expect(await partSnapshot(page)).toEqual(reference);
    });

    test("no CSS leaks out: host elements look the same with and without the player", async ({ page }) => {
      await page.route("**/embed/v1.js", (route) => route.abort());
      await page.goto(host.url);
      await page.waitForLoadState("load");
      const without = await hostSnapshot(page);
      await page.unroute("**/embed/v1.js");
      await page.goto(host.url);
      await waitForEvent(page, "annoudio:ready");
      const withPlayer = await hostSnapshot(page);
      expect(withPlayer).toEqual(without);
    });

    test("the return fragment seeks and focuses the player without autoplay", async ({ page }) => {
      await page.goto(`${host.url}#annoudio-t=7.5&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=draft`);
      await waitForEvent(page, "annoudio:ready");
      await expect.poll(() => timeText(page)).toBe("0:07 / 0:10");
      const focus = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          player: active?.tagName.toLowerCase() ?? null,
          part: (active?.shadowRoot?.activeElement as Element | null)?.getAttribute("part") ?? null,
        };
      });
      expect(focus).toEqual({ player: "annoudio-player", part: "play-button" });
      await expect(part(page, "player")).toBeInViewport();
      await expect(part(page, "message")).toContainText("Your story is sent.");
      await page.waitForTimeout(500);
      expect(await events(page, "annoudio:play")).toEqual([]);
    });
  });
}

test.describe("host notes (CONTRACT 13)", () => {
  test("WordPress removes the snippet when an author without unfiltered_html pastes it", async ({ page }) => {
    const url = "http://localhost:8091/?name=player-by-author";
    test.skip(!(await page.request.get(url).then((r) => r.ok()).catch(() => false)), "WordPress is not up");
    const html = await (await page.request.get(url)).text();
    expect(html).toContain("Pasted by an author");
    expect(html).not.toContain("embed/v1.js");
    expect(html).not.toContain("<annoudio-player");
  });

  test("Omeka S removes the snippet when the HTML purifier is on", async ({ page }) => {
    const url = "http://localhost:8092/s/annoudio/page/purified";
    test.skip(!(await page.request.get(url).then((r) => r.ok()).catch(() => false)), "Omeka S is not up");
    const html = await (await page.request.get(url)).text();
    expect(html).toContain("block-html");
    expect(html).not.toContain("embed/v1.js");
    expect(html).not.toContain("<annoudio-player");
  });
});
