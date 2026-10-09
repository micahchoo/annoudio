// Reads the Web Annotation Protocol container of one instance
// (design/stories-interface-C-common-caller.md 1.1 and 1.2; CONTRACT 6).

import { timeRange } from "./format";
import { SharedRequests } from "./shared";

export interface StoryText {
  value: string;
  language: string | null;
}

/** A sound, image or video body. `url` is an absolute http(s) URL. */
export interface StoryMedia {
  kind: "Sound" | "Image" | "Video";
  url: string;
  format: string | null;
}

/** A reply to a story: an annotation with `motivation: replying` (CONTRACT 6, rule 12). */
export interface Reply {
  id: string;
  nickname: string | null;
  created: string | null;
  texts: StoryText[];
  media: StoryMedia[];
}

export interface Story extends Reply {
  start: number;
  /** null: the range goes to the end of the recording. */
  end: number | null;
  tags: StoryText[];
  /** In the order of the container. */
  replies: Reply[];
}

/** The page item key that holds the replies of a story (CONTRACT 6, rule 12). */
const REPLIES = "annoudio:replies";

export type StoriesResult =
  | { kind: "ok"; label: string | null; stories: Story[]; truncated: boolean }
  | { kind: "not-found" }
  | { kind: "unavailable"; reason: string };

/** The player follows at most this number of `next` links (CONTRACT 6, rule 6). */
export const MAX_PAGES = 20;

const requests = new SharedRequests<StoriesResult>();

export function containerUrl(origin: string, project: string, recording: string): string {
  return `${origin}/stories/${encodeURIComponent(project)}/${encodeURIComponent(recording)}/`;
}

export function loadStories(url: string, signal: AbortSignal): Promise<StoriesResult> {
  return requests.get(url, (shared) => read(url, shared), signal);
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const types = (v: Json): string[] => list(v.type).filter((t): t is string => typeof t === "string");
const MEDIA_TYPES = ["Sound", "Image", "Video"] as const;

/** Only http and https: a `javascript:` or `data:` URL never reaches a `src`. */
function mediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

class Unavailable extends Error {}

async function getJson(url: string, signal: AbortSignal): Promise<{ status: number; body: unknown }> {
  // A plain GET: no Prefer, no Accept profile, no custom headers (CONTRACT 6, rule 1).
  const response = await fetch(url, { mode: "cors", credentials: "omit", signal });
  if (response.status === 404) return { status: 404, body: null };
  if (response.status !== 200 && response.status !== 304) {
    throw new Unavailable(`status ${response.status} from ${url}`);
  }
  try {
    return { status: response.status, body: await response.json() };
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Unavailable(`the body of ${url} is not JSON`);
  }
}

async function read(url: string, signal: AbortSignal): Promise<StoriesResult> {
  try {
    const first = await getJson(url, signal);
    if (first.status === 404) return { kind: "not-found" };
    const container = first.body;
    if (!isObject(container) || !types(container).some((t) => t === "AnnotationCollection" || t === "BasicContainer")) {
      throw new Unavailable(`the body of ${url} is not a container`);
    }
    const origin = new URL(url).origin;
    const items: unknown[] = [];
    let truncated = false;

    let page: unknown = container.first;
    if (typeof page === "string") page = await fetchPage(page, url, origin, signal);
    let followed = 0;
    while (isObject(page)) {
      items.push(...list(page.items));
      const next = typeof page.next === "string" ? page.next : isObject(page.next) ? str(page.next.id) : null;
      if (!next) break;
      if (followed >= MAX_PAGES) {
        truncated = true;
        break;
      }
      followed += 1;
      page = await fetchPage(next, url, origin, signal);
      if (page === null) break;
    }

    const stories: Story[] = [];
    for (const item of items) {
      const story = parseStory(item);
      if (story) stories.push(story);
    }
    return { kind: "ok", label: str(container.label), stories, truncated };
  } catch (error) {
    if (error instanceof Unavailable) return { kind: "unavailable", reason: error.message };
    if (signal.aborted) throw error;
    return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Returns null when the link goes to another origin: the player does not follow it. */
async function fetchPage(link: string, base: string, origin: string, signal: AbortSignal): Promise<unknown> {
  const target = new URL(link, base);
  if (target.origin !== origin) {
    console.warn(`annoudio: the player does not follow a page link to another origin: ${target.href}`);
    return null;
  }
  const page = await getJson(target.href, signal);
  if (page.status === 404) throw new Unavailable(`page ${target.href} answered 404`);
  return page.body;
}

function readTarget(target: unknown): { start: number; end: number | null } | null {
  for (const t of list(target)) {
    if (typeof t === "string") {
      const hash = t.indexOf("#");
      if (hash >= 0) {
        const range = timeRange(t.slice(hash + 1));
        if (range) return range;
      }
      continue;
    }
    if (!isObject(t)) continue;
    for (const selector of list(t.selector)) {
      if (isObject(selector) && types(selector).includes("FragmentSelector") && typeof selector.value === "string") {
        const range = timeRange(selector.value);
        if (range) return range;
      }
    }
    if (typeof t.source === "string" && t.source.includes("#")) {
      const range = timeRange(t.source.slice(t.source.indexOf("#") + 1));
      if (range) return range;
    }
  }
  return null;
}

function parseStory(item: unknown): Story | null {
  if (!isObject(item)) return null;
  const id = str(item.id) ?? "";
  const range = readTarget(item.target);
  if (!range) {
    console.warn(`annoudio: the player skips a story whose time range it cannot read: ${id || "(no id)"}`);
    return null;
  }
  const replies = list(item[REPLIES]).flatMap((reply) => {
    // A reply targets its story. Anything else in the list is not a reply of this story.
    if (!isObject(reply) || !list(reply.motivation).includes("replying")) return [];
    if (!list(reply.target).some((t) => t === item.id || (isObject(t) && t.id === item.id))) return [];
    const { tags: _tags, ...content } = parseContent(reply);
    return [content];
  });
  return { ...parseContent(item), ...range, replies };
}

/** The id, creator, date and bodies of a story or a reply. */
function parseContent(item: Json): Reply & { tags: StoryText[] } {
  const texts: StoryText[] = [];
  const tags: StoryText[] = [];
  const media: StoryMedia[] = [];
  const bodies = [...list(item.body)];
  if (typeof item.bodyValue === "string") bodies.push({ type: "TextualBody", value: item.bodyValue });
  for (const body of bodies) {
    if (!isObject(body)) continue;
    const kind = types(body);
    const mediaKind = MEDIA_TYPES.find((t) => kind.includes(t));
    const url = mediaKind ? mediaUrl(body.id) : null;
    if (mediaKind && url) {
      media.push({ kind: mediaKind, url, format: str(body.format) });
      continue;
    }
    const isText = kind.includes("TextualBody") || (kind.length === 0 && typeof body.value === "string");
    if (!isText || typeof body.value !== "string") continue; // Unknown body types are ignored (CONTRACT 6, rule 9).
    const text = { value: body.value, language: str(body.language) };
    if (list(body.purpose).includes("tagging")) tags.push(text);
    else texts.push(text);
  }
  const creator = isObject(item.creator) ? item.creator : null;
  return {
    id: str(item.id) ?? "",
    nickname: creator ? (str(creator.nickname) ?? str(creator.name)) : null,
    created: str(item.created),
    texts,
    tags,
    media,
  };
}
