// <annoudio-player>: the read side of Annoudio. CONTRACT.md is its interface.
// Everything in this file is implementation and can change in any v1 release.

import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { clock } from "./format";
import { isAbort } from "./shared";
import { containerUrl, loadStories, type Reply, type Story, type StoryMedia, type StoriesResult } from "./stories";
import { baseSheet, waveformSheet } from "./styles";
import { uiText, type ErrorCode, type UiText } from "./text";
import { themeFor, type Rights } from "./theme";
import { loadPeaks } from "./waveform";

export const NAME = "annoudio-player";
const SHOW_CONTROLS_AFTER_MS = 500;
/** `annoudio:timeupdate` fires at most once in this time (CONTRACT 4.1: at most 4 per second). */
const TIMEUPDATE_MS = 250;
const RETURN_LIMIT = 2000;
/** One path segment: the story id at the end of a story IRI. */
const SEGMENT = /^[^/?#]+$/;
const IDENTITY = ["project", "recording", "src", "origin"] as const;

let defaultOrigin = "";
/** Elements that already used the return fragment: it applies once per element. */
const fragmentUsed = new WeakSet<Element>();
/** Players that this bundle defined and that are running (CONTRACT 5, rule 8). */
const running = new Set<Run>();

export function setDefaultOrigin(origin: string): void {
  defaultOrigin = origin;
}

function warn(...args: unknown[]): void {
  try {
    console.warn("annoudio:", ...args);
  } catch {
    // Never throw into the host page.
  }
}

function attr(host: Element, name: string): string | null {
  const value = host.getAttribute(name);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function svg(path: string): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(ns, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", path);
  icon.appendChild(p);
  return icon;
}
const PLAY_ICON = "M7 4.5v15l13-7.5z";
const PAUSE_ICON = "M6 4h4.5v16H6zM13.5 4H18v16h-4.5z";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { part?: string; className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.part) node.setAttribute("part", options.part);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

function readFragment(): URLSearchParams | null {
  try {
    const hash = location.hash.slice(1);
    return hash ? new URLSearchParams(hash) : null;
  } catch {
    return null;
  }
}

/** One start of one player (CONTRACT 2.1, rule 1). A restart makes a new Run. */
class Run {
  readonly #host: AnnoudioPlayer;
  readonly #root: ShadowRoot;
  readonly #abort = new AbortController();
  readonly #signal = this.#abort.signal;
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();

  readonly project: string | null;
  readonly recording: string | null;
  #origin = "";
  #src = "";
  #text: UiText;
  #lang: string;

  #frame!: HTMLDivElement;
  #message!: HTMLParagraphElement;
  #messages = new Map<string, string>();
  #controls: HTMLDivElement | null = null;
  #play: HTMLButtonElement | null = null;
  #time: HTMLSpanElement | null = null;
  #timeline: HTMLDivElement | null = null;
  #wave: HTMLDivElement | null = null;
  #seek: HTMLInputElement | null = null;
  #list: HTMLOListElement | null = null;
  #annotate: HTMLAnchorElement | null = null;
  /** The `rights` part (CONTRACT 3.2, rule 7). The Annotate link goes before it. */
  #rights: HTMLParagraphElement | null = null;
  #probe: HTMLSpanElement | null = null;
  #audio: HTMLAudioElement | null = null;

  #wavesurfer: WaveSurfer | null = null;
  #regions: ReturnType<typeof RegionsPlugin.create> | null = null;
  #regionByStory = new Map<Story, Region>();
  #observer: IntersectionObserver | null = null;
  #frameRequest = 0;

  #stories: Story[] = [];
  #storyItems = new Map<Story, HTMLLIElement>();
  /** The thread under each story: its replies and its Reply link. It shows when the story is open. */
  #threads = new Map<Story, HTMLDivElement>();
  /** The story id (the last segment of its IRI), when the IRI is in this container. */
  #storyIds = new Map<Story, string>();
  #active: Story | null = null;
  /** The story id of `annoudio-reply` or `annoudio-story` in the fragment (CONTRACT 7.2). */
  #fragmentOpen: string | null = null;
  #pendingSeek: number | null = null;
  #notFound = false;
  /** The container has no stories: the empty note shows (CONTRACT 3.3, `message`). */
  #empty = false;
  #shown = "";
  #stopped = false;
  #ready = false;
  #reportedTime = 0;
  #reportedAt = -Infinity;
  #reportTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: AnnoudioPlayer, root: ShadowRoot, pendingSeek: number | null) {
    this.#host = host;
    this.#root = root;
    this.project = attr(host, "project");
    this.recording = attr(host, "recording");
    this.#pendingSeek = pendingSeek;
    const ui = uiText(this.#requestedLang());
    this.#text = ui.text;
    this.#lang = ui.lang;
  }

  #requestedLang(): string {
    const holder = this.#host.closest("[lang]");
    return holder?.getAttribute("lang") ?? document.documentElement.lang ?? "";
  }

  // ---- events (CONTRACT 4.1) ----

  #emit(name: string, extra: Record<string, unknown>): void {
    try {
      this.#host.dispatchEvent(
        new CustomEvent(name, {
          bubbles: true,
          composed: true,
          cancelable: false,
          detail: { project: this.project, recording: this.recording, ...extra },
        }),
      );
    } catch (error) {
      warn(error);
    }
  }

  #error(code: ErrorCode, name = "", details?: unknown): void {
    const message = this.#text.error[code](name);
    warn(`${code}: ${message}`, ...(details === undefined ? [] : [details]));
    this.#setMessage(code, message);
    this.#emit("annoudio:error", { code, message });
  }

  #setMessage(key: string, value: string | null): void {
    if (value === null) this.#messages.delete(key);
    else this.#messages.set(key, value);
    this.#message.textContent = [...this.#messages.values()].join(" ");
  }

  // ---- start and stop ----

  start(): void {
    running.add(this);
    this.#root.adoptedStyleSheets = [baseSheet()];
    this.#frame = el("div", { part: "player", className: "frame" });
    this.#frame.setAttribute("role", "group");
    this.#frame.setAttribute("lang", this.#lang);
    this.#frame.setAttribute("aria-label", this.#text.player);
    this.#message = el("p", { part: "message", className: "message" });
    this.#message.setAttribute("role", "status");
    this.#frame.appendChild(this.#message);
    this.#root.replaceChildren(this.#frame);

    // Attribute checks (CONTRACT 9: missing-attribute, invalid-attribute). No requests.
    for (const name of ["project", "recording", "src"] as const) {
      if (attr(this.#host, name) === null) return this.#error("missing-attribute", name);
    }
    const src = attr(this.#host, "src") as string;
    try {
      const url = new URL(src, document.baseURI);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
      this.#src = url.href;
    } catch {
      return this.#error("invalid-attribute", "src");
    }
    const origin = attr(this.#host, "origin");
    if (origin !== null) {
      try {
        const url = new URL(origin);
        const bare = origin.replace(/\/$/, "");
        if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== bare) throw new Error("origin");
        this.#origin = url.origin;
      } catch {
        return this.#error("invalid-attribute", "origin");
      }
    } else {
      this.#origin = defaultOrigin;
    }

    this.#build();

    // The audio request starts now and does not wait for theme or stories (CONTRACT 10, rule 4).
    const audio = el("audio");
    audio.preload = "metadata";
    this.#audio = audio;
    this.#listenAudio(audio);
    audio.src = this.#src; // No crossorigin attribute (CONTRACT 6, rule 3).
    this.#root.appendChild(audio);

    const project = this.project as string;
    const recording = this.recording as string;
    const theme = themeFor(this.#origin, project);
    this.#root.adoptedStyleSheets = [baseSheet(), theme.sheet];
    const themeSettled = theme.load(this.#signal).then(
      (rights) => {
        this.#recolor();
        this.#renderRights(rights);
      },
      (error: unknown) => {
        if (!isAbort(error)) warn(error);
      },
    );
    const storiesSettled = loadStories(containerUrl(this.#origin, project, recording), this.#signal).then(
      (result) => this.#showStories(result),
      (error: unknown) => {
        if (!isAbort(error)) warn(error);
        return null;
      },
    );
    const controlsShown = Promise.race([themeSettled, this.#delay(SHOW_CONTROLS_AFTER_MS)]).then(() => {
      if (this.#stopped) return;
      if (this.#controls) this.#controls.hidden = false;
    });
    Promise.all([controlsShown, storiesSettled]).then(([, count]) => {
      if (this.#stopped) return;
      // Open the story of the fragment first, so that the player's height is final for the scroll.
      this.#applyFragmentOpen();
      // Scroll and focus after the own stories show, so that the player's height is final.
      this.#applyFragmentFocus();
      const duration = audio.duration;
      this.#ready = true;
      this.#reportedTime = this.#currentTime();
      this.#emit("annoudio:ready", {
        stories: typeof count === "number" ? count : null,
        duration: Number.isFinite(duration) ? duration : null,
      });
    }, warn);

    this.#readFragment();
    this.#watchViewport();
  }

  stop(): void {
    this.#stopped = true;
    running.delete(this);
    this.#abort.abort();
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    cancelAnimationFrame(this.#frameRequest);
    this.#observer?.disconnect();
    try {
      this.#wavesurfer?.destroy();
    } catch (error) {
      warn(error);
    }
    const audio = this.#audio;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      try {
        audio.load(); // Cancels the media request.
      } catch {
        // Ignore.
      }
    }
  }

  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        resolve();
      }, ms);
      this.#timers.add(timer);
    });
  }

  // ---- DOM ----

  #build(): void {
    const t = this.#text;
    const controls = el("div", { part: "controls", className: "controls" });
    controls.hidden = true;

    const play = el("button", { part: "play-button", className: "play" });
    play.type = "button";
    play.setAttribute("aria-label", t.play);
    play.appendChild(svg(PLAY_ICON));
    play.addEventListener("click", () => this.#toggle(), { signal: this.#signal });

    const time = el("span", { part: "time", className: "time", text: `${clock(0)} / ${clock(0)}` });

    const timeline = el("div", { part: "timeline", className: "timeline" });
    const wave = el("div", { className: "wave" });
    const seek = el("input", { className: "seek" });
    seek.type = "range";
    seek.min = "0";
    seek.max = "0";
    seek.step = "any";
    seek.value = "0";
    seek.setAttribute("aria-label", t.seek);
    seek.addEventListener("input", () => this.#seekTo(Number(seek.value)), { signal: this.#signal });
    seek.addEventListener("keydown", (event) => this.#seekKey(event), { signal: this.#signal });
    timeline.append(wave, seek);
    controls.append(play, time, timeline);

    const list = el("ol", { part: "stories", className: "stories" });
    list.setAttribute("aria-label", t.stories);

    const probe = el("span", { className: "probe" });

    this.#frame.append(controls, list, probe);
    this.#controls = controls;
    this.#play = play;
    this.#time = time;
    this.#timeline = timeline;
    this.#wave = wave;
    this.#seek = seek;
    this.#list = list;
    this.#probe = probe;
    this.#renderAnnotate();
  }

  /** Display-only updates: `annotate` and `lang` (CONTRACT 2.1, rule 1). */
  updateDisplay(): void {
    if (this.#stopped || !this.#controls) return;
    const ui = uiText(this.#requestedLang());
    this.#text = ui.text;
    this.#lang = ui.lang;
    this.#frame.setAttribute("lang", ui.lang);
    this.#renderAnnotate();
  }

  #renderAnnotate(): void {
    const value = attr(this.#host, "annotate");
    if (value !== null && value !== "link" && value !== "none") {
      warn(`the annotate value "${value}" is not known. The player uses "link".`);
    }
    const show = value !== "none" && !this.#notFound;
    this.#renderEmpty(show);
    if (!show) {
      this.#annotate?.remove();
      this.#annotate = null;
      return;
    }
    if (!this.#annotate) {
      const link = el("a", { part: "annotate-link", className: "annotate", text: this.#text.annotate });
      const follow = () => {
        link.href = this.#annotateHref();
        this.#emit("annoudio:annotate", { time: this.#currentTime(), href: link.href, story: null });
      };
      link.addEventListener("click", follow, { signal: this.#signal });
      link.addEventListener("auxclick", follow, { signal: this.#signal });
      link.addEventListener("focus", () => (link.href = this.#annotateHref()), { signal: this.#signal });
      link.addEventListener("pointerenter", () => (link.href = this.#annotateHref()), { signal: this.#signal });
      this.#annotate = link;
      this.#frame.insertBefore(link, this.#rights);
    }
    this.#annotate.textContent = this.#text.annotate;
    this.#annotate.href = this.#annotateHref();
    this.#renderReplyLinks();
  }

  /**
   * The empty note invites a first story when the Annotate link shows. Not next to the note
   * of a save: the member has just told a story, which is not public yet.
   */
  #renderEmpty(link: boolean): void {
    const show = this.#empty && !this.#messages.has("saved");
    this.#setMessage("empty", show ? (link ? this.#text.empty : this.#text.emptyNoLink) : null);
  }

  /** The rights line of the project, once, below the stories (CONTRACT 3.2, rule 7). */
  #renderRights(rights: Rights | null): void {
    if (this.#stopped || !rights) return;
    const line = el("p", { part: "rights", className: "rights", text: `${this.#text.rights} ` });
    if (rights.iri) {
      const link = el("a", { text: rights.line });
      link.href = rights.iri;
      link.rel = "license";
      line.appendChild(link);
    } else {
      line.appendChild(document.createTextNode(rights.line));
    }
    this.#rights = line;
    this.#frame.appendChild(line);
  }

  /** The Reply link of each story shows when the Annotate link shows (CONTRACT 7.3). */
  #renderReplyLinks(): void {
    const show = this.#annotate !== null;
    for (const [story, thread] of this.#threads) {
      const id = this.#storyIds.get(story);
      let link = thread.querySelector<HTMLAnchorElement>(".reply-link");
      if (!show || id === undefined) {
        link?.remove();
      } else if (!link) {
        link = el("a", { part: "reply-link", className: "reply-link annotate" });
        const target = link;
        const update = () => (target.href = this.#annotateHref({ story, id }));
        const follow = () => {
          update();
          this.#emit("annoudio:annotate", { time: this.#currentTime(), href: target.href, story: story.id });
        };
        link.addEventListener("click", follow, { signal: this.#signal });
        link.addEventListener("auxclick", follow, { signal: this.#signal });
        link.addEventListener("focus", update, { signal: this.#signal });
        link.addEventListener("pointerenter", update, { signal: this.#signal });
        update();
        thread.appendChild(link);
      }
      if (link) {
        link.textContent = this.#text.reply;
        link.setAttribute("aria-label", this.#text.replyTo(story.nickname));
      }
      // The open button of a story controls its thread only when the thread has content.
      const open = this.#storyItems.get(story)?.querySelector(".open");
      if (thread.childElementCount > 0) open?.setAttribute("aria-expanded", String(this.#active === story));
      else open?.removeAttribute("aria-expanded");
    }
  }

  /** CONTRACT 7.1; with `reply`, the Reply link of 7.3. */
  #annotateHref(reply?: { story: Story; id: string }): string {
    const enc = encodeURIComponent;
    const t = reply ? reply.story.start : this.#currentTime();
    let href =
      `${this.#origin}/annotate?project=${enc(this.project ?? "")}&recording=${enc(this.recording ?? "")}` +
      `&t=${Math.floor(t)}`;
    if (reply) href += `&replyTo=${enc(reply.id)}`;
    const page = location.href.split("#")[0] ?? "";
    const back = enc(page);
    if (back.length <= RETURN_LIMIT) href += `&return=${back}`;
    return href;
  }

  // ---- stories ----

  #showStories(result: StoriesResult): number | null {
    if (this.#stopped) return null;
    if (result.kind === "not-found") {
      this.#notFound = true;
      this.#renderAnnotate();
      this.#error("not-found");
      return null;
    }
    if (result.kind === "unavailable") {
      this.#error("stories-unavailable", "", result.reason);
      return null;
    }
    if (result.label) this.#frame.setAttribute("aria-label", result.label);
    if (result.truncated) this.#setMessage("truncated", this.#text.truncated(result.stories.length));
    this.#stories = result.stories;
    const container = containerUrl(this.#origin, this.project as string, this.recording as string);
    const list = this.#list as HTMLOListElement;
    for (const story of result.stories) {
      const id = story.id.startsWith(container) ? story.id.slice(container.length) : "";
      if (SEGMENT.test(id)) this.#storyIds.set(story, id);
      const item = this.#renderStory(story);
      this.#storyItems.set(story, item);
      list.appendChild(item);
    }
    this.#empty = result.stories.length === 0;
    this.#renderEmpty(this.#annotate !== null);
    this.#renderReplyLinks();
    this.#addRegions();
    return result.stories.length;
  }

  #storyEnd(story: Story): number {
    if (story.end !== null) return story.end;
    const d = this.#audio?.duration;
    return d !== undefined && Number.isFinite(d) ? d : story.start;
  }

  #renderStory(story: Story): HTMLLIElement {
    const t = this.#text;
    const item = el("li", { part: "story", className: "story" });
    const from = clock(story.start);
    const to = story.end === null ? t.toEnd : clock(story.end);

    const open = el("button", { className: "open" });
    open.type = "button";
    const count = story.replies.length > 0 ? t.replies(story.replies.length) : null;
    open.setAttribute("aria-label", [t.storyName(story.nickname, from, to), count].filter(Boolean).join(", "));
    const meta = el("span", { part: "story-meta", className: "meta" });
    const bits = [story.nickname ?? t.member, `${from}–${story.end === null ? "" : to}`];
    const date = this.#date(story.created);
    if (date) bits.push(date);
    meta.textContent = bits.join(" · ");
    open.appendChild(meta);
    if (count) open.appendChild(el("span", { className: "count", text: count }));
    open.addEventListener("click", () => this.#open(story), { signal: this.#signal });
    item.appendChild(open);

    for (const text of story.texts) {
      const p = el("p", { part: "story-text", className: "text" });
      p.textContent = text.value; // textContent only (CONTRACT 6, rule 10).
      if (text.language) p.lang = text.language;
      item.appendChild(p);
    }
    for (const body of story.media) item.appendChild(this.#renderMedia(story, body));
    if (story.tags.length) {
      const tags = el("ul", { className: "tags" });
      for (const tag of story.tags) {
        const li = el("li", { part: "tag", className: "tag" });
        li.textContent = tag.value;
        if (tag.language) li.lang = tag.language;
        tags.appendChild(li);
      }
      item.appendChild(tags);
    }
    item.appendChild(this.#renderThread(story));
    return item;
  }

  /** The replies of a story, in container order. The Reply link comes later (#renderReplyLinks). */
  #renderThread(story: Story): HTMLDivElement {
    const thread = el("div", { className: "thread" });
    thread.hidden = true;
    this.#threads.set(story, thread);
    if (story.replies.length === 0) return thread;
    const list = el("ol", { part: "replies", className: "replies" });
    list.setAttribute("aria-label", this.#text.repliesTo(story.nickname));
    for (const reply of story.replies) {
      const item = el("li", { part: "reply", className: "reply" });
      const date = this.#date(reply.created);
      const meta = el("p", { part: "reply-meta", className: "meta" });
      meta.textContent = [reply.nickname ?? this.#text.member, date].filter(Boolean).join(" · ");
      item.appendChild(meta);
      for (const text of reply.texts) {
        const p = el("p", { part: "reply-text", className: "text" });
        p.textContent = text.value; // textContent only (CONTRACT 6, rule 10).
        if (text.language) p.lang = text.language;
        item.appendChild(p);
      }
      for (const body of reply.media) item.appendChild(this.#renderMedia(reply, body));
      list.appendChild(item);
    }
    thread.appendChild(list);
    return thread;
  }

  /** A date in the UI language, or null. */
  #date(created: string | null): string | null {
    if (!created) return null;
    const date = new Date(created);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(this.#lang, { dateStyle: "medium" }).format(date);
    } catch {
      return created.slice(0, 10);
    }
  }

  /**
   * A media body loads no bytes before the visitor needs it: audio on play, an image near
   * the viewport, a video only its metadata (CONTRACT 6, request 7). No `crossorigin`, so
   * any media host works (CONTRACT 6, rule 3).
   */
  #renderMedia(story: Reply, body: StoryMedia): HTMLElement {
    const label = this.#text.media[body.kind](story.nickname);
    if (body.kind === "Image") {
      const img = el("img", { part: "story-media", className: "media" });
      img.loading = "lazy";
      img.decoding = "async";
      // The story text is the short text that comes with every media body.
      img.alt = story.texts[0]?.value ?? label;
      img.src = body.url;
      return img;
    }
    const options = { part: "story-media", className: "media" };
    const media = body.kind === "Sound" ? el("audio", options) : el("video", options);
    media.controls = true;
    media.preload = body.kind === "Sound" ? "none" : "metadata";
    media.setAttribute("aria-label", label);
    media.src = body.url;
    // One sound at a time: a media body pauses the recording.
    media.addEventListener("play", () => this.#audio?.pause(), { signal: this.#signal });
    return media;
  }

  #open(story: Story): void {
    if (this.#active) {
      const old = this.#storyItems.get(this.#active);
      old?.classList.remove("active");
      old?.part.remove("active");
      old?.querySelector(".open")?.removeAttribute("aria-current");
      this.#regionByStory.get(this.#active)?.element?.part.remove("active");
      const thread = this.#threads.get(this.#active);
      if (thread) thread.hidden = true;
    }
    this.#active = story;
    const item = this.#storyItems.get(story);
    item?.classList.add("active");
    item?.part.add("active");
    item?.querySelector(".open")?.setAttribute("aria-current", "true");
    this.#regionByStory.get(story)?.element?.part.add("active");
    const thread = this.#threads.get(story);
    if (thread) thread.hidden = false;
    this.#renderReplyLinks();
    this.#seekTo(story.start);
    this.#emit("annoudio:story-open", { story: story.id, start: story.start, end: this.#storyEnd(story) });
  }

  // ---- timeline (wavesurfer.js and its regions plugin) ----

  #watchViewport(): void {
    if (typeof IntersectionObserver === "undefined") {
      this.#startTimeline();
      return;
    }
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.#observer?.disconnect();
          this.#observer = null;
          this.#startTimeline();
        }
      },
      { rootMargin: "400px" },
    );
    this.#observer.observe(this.#host);
  }

  #startTimeline(): void {
    if (this.#stopped) return;
    const audio = this.#audio as HTMLAudioElement;
    let real = false;
    loadPeaks(this.#src, this.#signal).then((data) => {
      if (this.#stopped || !data) return;
      real = true;
      if (this.#wavesurfer) {
        // Same URL as the media element: wavesurfer does not reset the media and does not fetch.
        this.#wavesurfer.load(this.#src, [data.peaks], data.duration).catch(warn);
      } else {
        this.#createWavesurfer([data.peaks], data.duration);
      }
      this.#wave?.setAttribute("part", "waveform");
    }, warn);
    const flat = () => {
      if (this.#stopped || this.#wavesurfer || real || !Number.isFinite(audio.duration)) return;
      this.#createWavesurfer([[0, 0]], audio.duration);
    };
    if (Number.isFinite(audio.duration)) flat();
    else audio.addEventListener("loadedmetadata", flat, { once: true, signal: this.#signal });
  }

  #createWavesurfer(peaks: Array<Float32Array | number[]>, duration: number): void {
    const wave = this.#wave as HTMLDivElement;
    const colors = this.#colors();
    try {
      const regions = RegionsPlugin.create();
      const ws = WaveSurfer.create({
        container: wave,
        media: this.#audio as HTMLAudioElement,
        peaks,
        duration,
        height: "auto",
        waveColor: colors.wave,
        progressColor: colors.accent,
        cursorColor: colors.accent,
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        interact: true,
        dragToSeek: false,
        autoScroll: false,
        hideScrollbar: true,
        normalize: true,
        plugins: [regions],
      });
      // Regions live in wavesurfer's own shadow tree. Export their parts so that
      // `annoudio-player::part(region)` works with no exportparts on the host (CONTRACT 3.3, rule 1).
      const inner = wave.lastElementChild;
      inner?.setAttribute("exportparts", "region, active");
      if (inner?.shadowRoot) inner.shadowRoot.adoptedStyleSheets = [waveformSheet()];
      regions.on("region-clicked", (region, event) => {
        event.stopPropagation(); // Do not let wavesurfer seek to the click point.
        const story = [...this.#regionByStory].find(([, r]) => r === region)?.[0];
        if (story) this.#open(story);
      });
      this.#wavesurfer = ws;
      this.#regions = regions;
      ws.on("ready", () => this.#addRegions());
      this.#addRegions();
    } catch (error) {
      warn("the timeline could not start:", error);
    }
  }

  #addRegions(): void {
    const regions = this.#regions;
    // The regions plugin clamps a new region to the duration it knows. Wait for "ready" when it is 0.
    if (!regions || this.#stopped || !(this.#wavesurfer && this.#wavesurfer.getDuration() > 0)) return;
    this.#stories.forEach((story, index) => {
      if (this.#regionByStory.has(story)) return;
      const region = regions.addRegion({
        id: `annoudio-${index}`,
        start: story.start,
        end: Math.max(this.#storyEnd(story), story.start + 0.25),
        color: "var(--annoudio-color-region, #d5e3f3)",
        drag: false,
        resize: false,
      });
      const element = region.element;
      if (element) {
        element.setAttribute("part", this.#active === story ? "region active" : "region");
        element.style.transition = "none";
        element.style.cursor = "pointer";
      }
      this.#regionByStory.set(story, region);
    });
  }

  /** Canvas colours cannot read var(); read the tokens from a probe element. */
  #colors(): { wave: string; accent: string } {
    const probe = this.#probe as HTMLSpanElement;
    probe.style.color = "var(--annoudio-color-wave, #8c8c8c)";
    probe.style.backgroundColor = "var(--annoudio-color-accent, #0b5cad)";
    const style = getComputedStyle(probe);
    return { wave: style.color || "#8c8c8c", accent: style.backgroundColor || "#0b5cad" };
  }

  #recolor(): void {
    if (this.#stopped || !this.#wavesurfer) return;
    const colors = this.#colors();
    this.#wavesurfer.setOptions({ waveColor: colors.wave, progressColor: colors.accent, cursorColor: colors.accent });
  }

  // ---- playback ----

  #listenAudio(audio: HTMLAudioElement): void {
    const signal = this.#signal;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        if (this.#pendingSeek !== null) {
          const value = this.#pendingSeek;
          this.#pendingSeek = null;
          this.#seekTo(value);
        }
        this.#tick();
        // Stories with an open end need the duration.
        for (const [story, region] of this.#regionByStory) {
          if (story.end === null) region.setOptions({ end: this.#storyEnd(story) });
        }
      },
      { signal },
    );
    audio.addEventListener(
      "play",
      () => {
        for (const other of running) if (other !== this) other.pause();
        this.#setPlaying(true);
        this.#emit("annoudio:play", { time: audio.currentTime });
        this.#loop();
      },
      { signal },
    );
    audio.addEventListener(
      "pause",
      () => {
        this.#setPlaying(false);
        this.#tick();
        this.#emit("annoudio:pause", { time: audio.currentTime, ended: audio.ended });
      },
      { signal },
    );
    audio.addEventListener("seeked", () => this.#tick(), { signal });
    audio.addEventListener("timeupdate", () => this.#tick(), { signal });
    audio.addEventListener(
      "error",
      () => {
        if (this.#stopped || !audio.getAttribute("src")) return;
        if (this.#timeline) this.#timeline.hidden = true;
        if (this.#play) this.#play.disabled = true;
        this.#error("audio-unavailable", "", audio.error ? `media error ${audio.error.code}` : undefined);
      },
      { signal },
    );
  }

  pause(): void {
    this.#audio?.pause();
  }

  #toggle(): void {
    const audio = this.#audio;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((error: unknown) => {
        if (!isAbort(error)) warn("playback did not start:", error);
      });
    } else {
      audio.pause();
    }
  }

  #setPlaying(playing: boolean): void {
    const play = this.#play;
    if (!play) return;
    play.setAttribute("aria-label", playing ? this.#text.pause : this.#text.play);
    play.replaceChildren(svg(playing ? PAUSE_ICON : PLAY_ICON));
  }

  /** Playback updates use requestAnimationFrame; browsers stop it in hidden tabs (CONTRACT 10, rule 6). */
  #loop(): void {
    cancelAnimationFrame(this.#frameRequest);
    const step = () => {
      if (this.#stopped || !this.#audio || this.#audio.paused) return;
      this.#tick();
      this.#frameRequest = requestAnimationFrame(step);
    };
    this.#frameRequest = requestAnimationFrame(step);
  }

  #currentTime(): number {
    const audio = this.#audio;
    if (this.#pendingSeek !== null) return this.#pendingSeek;
    return audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  }

  /** CONTRACT 4.3: NaN before `annoudio:ready` and after the player stops. */
  get currentTime(): number {
    return this.#ready && !this.#stopped ? this.#currentTime() : NaN;
  }

  /** Dispatch `annoudio:timeupdate` when the time changed, at most once per TIMEUPDATE_MS. */
  #reportTime(): void {
    if (!this.#ready || this.#stopped || this.#reportTimer !== null) return;
    if (this.#currentTime() === this.#reportedTime) return;
    const wait = this.#reportedAt + TIMEUPDATE_MS - performance.now();
    if (wait > 0) {
      // The trailing call sends the newest time, so the last change is never lost.
      this.#reportTimer = setTimeout(() => {
        if (this.#reportTimer !== null) this.#timers.delete(this.#reportTimer);
        this.#reportTimer = null;
        this.#reportTime();
      }, wait);
      this.#timers.add(this.#reportTimer);
      return;
    }
    this.#reportedTime = this.#currentTime();
    this.#reportedAt = performance.now();
    this.#emit("annoudio:timeupdate", { currentTime: this.#reportedTime });
  }

  #tick(): void {
    const audio = this.#audio;
    if (!audio || !this.#seek || !this.#time) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const now = this.#currentTime();
    this.#seek.max = String(duration);
    this.#seek.value = String(now);
    const shown = `${clock(now)} / ${clock(duration)}`;
    if (shown !== this.#shown) {
      this.#shown = shown;
      this.#time.textContent = shown;
      this.#seek.setAttribute("aria-valuetext", this.#text.of(clock(now), clock(duration)));
      if (this.#annotate) this.#annotate.href = this.#annotateHref();
    }
    this.#reportTime();
  }

  /** CONTRACT 4.2. The caller checks that `seconds` is a finite number. */
  seek(seconds: number): void {
    this.#seekTo(seconds);
  }

  #seekTo(seconds: number): void {
    const audio = this.#audio;
    if (!audio) {
      this.#pendingSeek = seconds;
      return;
    }
    if (!Number.isFinite(audio.duration)) {
      this.#pendingSeek = Math.max(0, seconds);
      this.#tick();
      return;
    }
    this.#pendingSeek = null;
    audio.currentTime = Math.min(Math.max(0, seconds), audio.duration);
    this.#tick();
  }

  #seekKey(event: KeyboardEvent): void {
    const duration = this.#audio && Number.isFinite(this.#audio.duration) ? this.#audio.duration : Infinity;
    const now = this.#currentTime();
    const moves: Record<string, number> = {
      ArrowLeft: now - 5,
      ArrowDown: now - 5,
      ArrowRight: now + 5,
      ArrowUp: now + 5,
      PageDown: now - 30,
      PageUp: now + 30,
      Home: 0,
      End: duration,
    };
    const target = moves[event.key];
    if (target === undefined || !Number.isFinite(target)) return;
    event.preventDefault();
    this.#seekTo(target);
  }

  // ---- the return fragment (CONTRACT 7.2) ----

  #fragmentFocus = false;

  #readFragment(): void {
    if (fragmentUsed.has(this.#host)) return;
    const params = readFragment();
    if (!params) return;
    if (params.get("annoudio-project") !== this.project || params.get("annoudio-recording") !== this.recording) return;
    const first = [...document.querySelectorAll(NAME)].find(
      (p) => attr(p, "project") === this.project && attr(p, "recording") === this.recording,
    );
    if (first !== this.#host) return;
    fragmentUsed.add(this.#host);
    const raw = params.get("annoudio-t");
    if (raw !== null && /^\d+(?:\.\d{1,3})?$/.test(raw.trim())) {
      this.#seekTo(Number(raw));
    }
    this.#fragmentFocus = true;
    const reply = params.get("annoudio-reply");
    // `annoudio-story` (a link from a mail or the admin) opens a story with no note.
    this.#fragmentOpen = reply ?? params.get("annoudio-story");
    const saved = params.get("annoudio-saved");
    if (saved === "draft") {
      this.#setMessage("saved", reply ? this.#text.replySaved : this.#text.draftSaved);
    } else if (saved === "published") {
      this.#setMessage("saved", reply ? this.#text.replyPublished : this.#text.publishedSaved);
    }
  }

  /** `annoudio-reply` or `annoudio-story` opens the story with that id; a reply id opens nothing. */
  #applyFragmentOpen(): void {
    const id = this.#fragmentOpen;
    this.#fragmentOpen = null;
    if (id === null) return;
    const story = [...this.#storyIds].find(([, value]) => value === id)?.[0];
    if (story) this.#open(story);
  }

  #applyFragmentFocus(): void {
    if (!this.#fragmentFocus) return;
    this.#fragmentFocus = false;
    try {
      this.#host.scrollIntoView({ behavior: "instant", block: "center" });
    } catch {
      this.#host.scrollIntoView();
    }
    this.#play?.focus({ preventScroll: true });
  }
}

export class AnnoudioPlayer extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["project", "recording", "src", "origin", "annotate", "lang"];
  }

  #run: Run | null = null;
  #identity = "";
  #pendingSeek: number | null = null;

  constructor() {
    super();
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    try {
      this.#start();
    } catch (error) {
      warn(error);
    }
  }

  disconnectedCallback(): void {
    try {
      this.#run?.stop();
      this.#run = null;
    } catch (error) {
      warn(error);
    }
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    try {
      if (!this.#run || before === after) return;
      if ((IDENTITY as readonly string[]).includes(name)) {
        if (this.#identityKey() === this.#identity) return;
        this.#run.stop();
        this.#run = null;
        this.#start();
      } else {
        this.#run.updateDisplay();
      }
    } catch (error) {
      warn(error);
    }
  }

  /** CONTRACT 4.3: read-only. Seconds, or NaN before `annoudio:ready`. Never throws. */
  get currentTime(): number {
    try {
      return this.#run ? this.#run.currentTime : NaN;
    } catch (error) {
      warn(error);
      return NaN;
    }
  }

  /** CONTRACT 4.2: the only public method. Never throws. Returns undefined. */
  seek(seconds: number): void {
    try {
      if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
        warn(`seek() needs a finite number of seconds. It got: ${String(seconds)}`);
        return;
      }
      if (this.#run) this.#run.seek(seconds);
      else this.#pendingSeek = seconds;
    } catch (error) {
      warn(error);
    }
  }

  #identityKey(): string {
    return IDENTITY.map((name) => attr(this, name) ?? "").join("\u0000");
  }

  #start(): void {
    if (this.#run || !this.isConnected) return;
    this.#identity = this.#identityKey();
    const root = this.shadowRoot as ShadowRoot;
    const pending = this.#pendingSeek;
    this.#pendingSeek = null;
    this.#run = new Run(this, root, pending);
    this.#run.start();
  }
}
