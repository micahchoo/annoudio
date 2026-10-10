// The widget's own UI text. v1 has English only; other languages fall back to English
// (CONTRACT 2.1, rule 6). Message texts are not part of the contract; error codes are.

export type ErrorCode =
  | "missing-attribute"
  | "invalid-attribute"
  | "not-found"
  | "stories-unavailable"
  | "audio-unavailable"
  | "bundle-unavailable";

const en = {
  play: "Play",
  pause: "Pause",
  seek: "Seek",
  frame: "Recording and its stories",
  stories: "Stories",
  /** Above the stories (part `intro`, CONTRACT 3.3). */
  intro: "Each story is about one part of the recording. Select a story to hear that part.",
  /** The range of the `range` attribute (CONTRACT 2.1, 3.3). */
  range: (from: string, to: string) => `Your story: ${from} to ${to}`,
  annotate: "Tell a story",
  member: "A member",
  media: {
    Sound: (who: string | null) => `Voice note by ${who ?? "a member"}`,
    Image: (who: string | null) => `Photo by ${who ?? "a member"}`,
    Video: (who: string | null) => `Video by ${who ?? "a member"}`,
  },
  of: (a: string, b: string) => `${a} of ${b}`,
  toEnd: "the end",
  storyName: (who: string | null, from: string, to: string) => `Story by ${who ?? "a member"}, ${from} to ${to}`,
  replies: (n: number) => (n === 1 ? "1 reply" : `${n} replies`),
  repliesTo: (who: string | null) => `Replies to the story by ${who ?? "a member"}`,
  reply: "Reply",
  replyTo: (who: string | null) => `Reply to the story by ${who ?? "a member"}`,
  draftSaved: "Your story is sent. It shows here after review.",
  replySaved: "Your reply is sent. It shows here after review.",
  publishedSaved: "Your story is published. It can take one minute to show.",
  replyPublished: "Your reply is published. It can take one minute to show.",
  /** The note of an empty container: with the Annotate link, and without it. */
  empty: "No stories yet. Tell the first one.",
  emptyNoLink: "No stories yet.",
  truncated: (n: number) => `Only the first ${n} stories show here.`,
  error: {
    "missing-attribute": (name: string) => `This widget is not set up correctly. The "${name}" value is missing.`,
    "invalid-attribute": (name: string) =>
      name === "src"
        ? `This widget is not set up correctly. The "src" value is not a web address.`
        : `This widget is not set up correctly. The "${name}" value is not an origin.`,
    "not-found": () => "Stories for this recording are not available.",
    "stories-unavailable": () => "Stories could not load. Reload the page to try again.",
    "audio-unavailable": () => "The audio could not load.",
    "bundle-unavailable": () => "The widget could not load. Reload the page to try again.",
  } satisfies Record<ErrorCode, (name: string) => string>,
};

export type UiText = typeof en;

/** Returns the UI language that the widget can show, and its text. */
export function uiText(_requested: string): { lang: string; text: UiText } {
  return { lang: "en", text: en };
}
