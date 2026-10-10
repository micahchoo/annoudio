// Fixture data: WADM containers with the exact shape of
// design/stories-interface-C-common-caller.md sections 1.1 and 1.2.

const CONTEXT = "http://www.w3.org/ns/anno.jsonld";
/** The extension context of a page whose items carry replies (CONTRACT 6, rule 12). */
const REPLIES_CONTEXT = { "annoudio:replies": { "@reverse": "oa:hasTarget" } };
const DC = "http://purl.org/dc/terms/";
const SPK = "http://id.loc.gov/vocabulary/relators/spk";
const SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";

/** Projects that the fixture stack knows. A slug "river-voices-<anything>" acts as "river-voices". */
export const PROJECTS = ["river-voices", "plain", "slow", "bad", "framed", "rightsonly", "unsafe", "fielded", "relabeled"];

export function baseProject(slug) {
  for (const p of PROJECTS) if (slug === p || slug.startsWith(`${p}-`)) return p;
  return null;
}

export const THEMES = {
  "river-voices": { tokens: { "color-accent": "#8a1c2b", radius: "0px" } },
  slow: { tokens: { "color-accent": "#006400" } },
  bad: {
    tokens: {
      "color-accent": "javascript:alert(1)",
      radius: "12px",
      space: "1em; } :host { display: none",
      unknown: "#ff0000",
    },
  },
  // "plain" has no theme: 404.
  // The project frame (CONTRACT 3.2, rule 7; added 2026-10-09). New entries; the ones above
  // do not change.
  framed: {
    tokens: {},
    name: "River Voices",
    rightsLine: "CC BY 4.0",
    rightsIri: "https://creativecommons.org/licenses/by/4.0/",
  },
  rightsonly: { tokens: {}, name: "Hill Songs", rightsLine: "© 2026 Kochi Heritage Trust" },
  unsafe: { tokens: {}, name: "Unsafe", rightsLine: "Some rights", rightsIri: "javascript:alert(1)" },
  // The field labels (CONTRACT 3.2, rule 8; added 2026-10-09). New entries.
  fielded: { tokens: {}, name: "River Voices", fields: FIELDS("Place") },
  relabeled: { tokens: {}, name: "River Voices", fields: FIELDS("Where") },
};
export const SLOW_THEME_MS = 2500;


/** The fields of the "fielded" project, in field order. Hoisted: THEMES uses it above. */
function FIELDS(placeLabel) {
  return [
    { property: `${DC}title`, label: "Short title", showAs: "line", valueType: "text" },
    { property: `${DC}temporal`, label: "When it happened", showAs: "line", valueType: "date" },
    { property: `${DC}spatial`, label: placeLabel, showAs: "line", valueType: "list" },
    { property: SPK, label: "Who is speaking", showAs: "line", valueType: "entity" },
    { property: SEE_ALSO, label: "Link to more", showAs: "line", valueType: "link" },
    { property: `${DC}subject`, label: "Topics", showAs: "tags", valueType: "list" },
    { property: `${DC}description`, label: "What you hear", showAs: "none", valueType: "text" },
    // A field that no story answers: no line.
    { property: `${DC}source`, label: "Where you know this from", showAs: "line", valueType: "text" },
  ];
}

function story(origin, project, recording, n, { start, end, nickname, bodies, created }) {
  return {
    "@context": CONTEXT,
    id: `${origin}/stories/${project}/${recording}/0192f3a4-7c1e-7b10-9d55-${String(n).padStart(12, "0")}`,
    type: "Annotation",
    motivation: "commenting",
    created: created ?? "2026-10-08T19:02:11Z",
    modified: "2026-10-09T10:14:00Z",
    creator: { id: `${origin}/members/m-${100 + n}`, type: "Person", nickname },
    rights: "https://creativecommons.org/licenses/by-nc/4.0/",
    body: bodies,
    target: {
      type: "SpecificResource",
      source: `${origin}/recordings/${recording}`,
      scope: `${origin}/projects/${project}`,
      selector: { type: "FragmentSelector", conformsTo: "http://www.w3.org/TR/media-frags/", value: `t=${start},${end}` },
    },
  };
}

/** A reply to `parent`: a complete annotation without @context, as a page item holds it. */
function reply(origin, project, recording, parent, n, { nickname, bodies, created }) {
  return {
    id: `${origin}/stories/${project}/${recording}/0192f3a4-7c1e-7b10-9d55-${String(n).padStart(12, "0")}`,
    type: "Annotation",
    motivation: "replying",
    created,
    modified: created,
    creator: { id: `${origin}/members/m-${100 + n}`, type: "Person", nickname },
    body: bodies,
    target: parent.id,
  };
}

const tag = (origin, project, concept, label) => [
  { type: "SpecificResource", source: `${origin}/vocab/${project}/c/${concept}`, purpose: "tagging" },
  { type: "TextualBody", value: label, purpose: "tagging", language: "en" },
];

/** The three stories of rec-0042 (10 s of tone). Times in timeline order. Asha's story has two replies. */
export function threeStories(origin, project, recording) {
  const stories = [
    story(origin, project, recording, 1, {
      start: 2,
      end: 4,
      nickname: "Leela",
      bodies: [
        { type: "TextualBody", value: "My grandmother sang this on the ferry.", format: "text/plain", language: "ml" },
        { id: `${origin}/media/voice.m4a`, type: "Sound", format: "audio/mp4" },
        ...tag(origin, project, "ferry", "Ferry"),
      ],
    }),
    story(origin, project, recording, 2, {
      start: 5,
      end: 6.5,
      nickname: "Ravi",
      bodies: [
        {
          type: "TextualBody",
          value: '<img src=x onerror="window.__xss=1"><b>bold?</b>',
          format: "text/plain",
          language: "en",
        },
      ],
    }),
    story(origin, project, recording, 3, {
      start: 7.5,
      end: 9,
      nickname: "Asha",
      created: "2026-10-09T08:00:00Z",
      bodies: [
        { type: "TextualBody", value: "The horn sounds here.", format: "text/plain", language: "en" },
        ...tag(origin, project, "horn", "Horn"),
        ...tag(origin, project, "river", "River"),
      ],
    }),
  ];
  const asha = stories[2];
  asha["annoudio:replies"] = [
    reply(origin, project, recording, asha, 31, {
      nickname: "Ravi",
      created: "2026-10-09T09:00:00Z",
      bodies: [
        { type: "TextualBody", value: "My uncle blew that horn.", format: "text/plain", language: "en" },
        { id: `${origin}/media/voice.m4a`, type: "Sound", format: "audio/mp4" },
      ],
    }),
    reply(origin, project, recording, asha, 32, {
      nickname: "Leela",
      created: "2026-10-09T09:30:00Z",
      bodies: [{ type: "TextualBody", value: '<img src=x onerror="window.__xss=2">Thank you!', format: "text/plain", language: "en" }],
    }),
  ];
  return stories;
}

function manyStories(origin, project, recording, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = Math.round(((i * 9.5) / count) * 100) / 100;
    out.push(
      story(origin, project, recording, 10 + i, {
        start,
        end: Math.round((start + 0.3) * 100) / 100,
        nickname: `Member ${i + 1}`,
        bodies: [{ type: "TextualBody", value: `Story number ${i + 1}.`, format: "text/plain", language: "en" }],
      }),
    );
  }
  return out;
}

/** rec-media: one story for each media body type, with the files of fixture/media. */
function mediaStories(origin, project, recording) {
  const text = (value) => ({ type: "TextualBody", value, format: "text/plain", language: "en" });
  return [
    story(origin, project, recording, 21, {
      start: 1,
      end: 2,
      nickname: "Leela",
      bodies: [text("Listen to my grandmother."), { id: `${origin}/media/voice.m4a`, type: "Sound", format: "audio/mp4" }],
    }),
    story(origin, project, recording, 22, {
      start: 3,
      end: 4,
      nickname: "Ravi",
      bodies: [text("The ferry in 1962."), { id: `${origin}/media/photo.jpg`, type: "Image", format: "image/jpeg" }],
    }),
    story(origin, project, recording, 23, {
      start: 5,
      end: 6,
      nickname: "Asha",
      bodies: [
        text("The river today."),
        { id: `${origin}/media/clip.mp4`, type: "Video", format: "video/mp4" },
        // Never a src: the player takes only http and https URLs.
        { id: "javascript:alert(1)", type: "Image", format: "image/png" },
      ],
    }),
  ];
}

/** A value body (CONTRACT 6, rule 13) about the time range of `story`. */
const value = (origin, recording, range, predicate, purpose, text, object, language) => ({
  type: ["TextualBody", "rdf:Statement"],
  purpose,
  value: text,
  ...(language ? { language } : {}),
  "rdf:subject": { id: `${origin}/recordings/${recording}#t=${range}` },
  "rdf:predicate": { id: predicate },
  "rdf:object": object,
});

/** rec-values: two stories with answers (design/vocab.md §3.3). */
function valueStories(origin, project, recording) {
  const item = (key) => ({ id: `${origin}/vocab/${project}/c/${key}` });
  const v = (range, ...rest) => value(origin, recording, range, ...rest);
  return [
    story(origin, project, recording, 41, {
      start: 1,
      end: 3,
      nickname: "Asha",
      bodies: [
        { type: "TextualBody", value: "My father ran this ferry from Fort Kochi.", format: "text/plain", language: "en" },
        v("1,3", `${DC}title`, "describing", "The last ferry", { "@value": "The last ferry", "@language": "en" }, "en"),
        v("1,3", `${DC}temporal`, "describing", "1962", { "@value": "1962", type: "xsd:gYear" }),
        v("1,3", `${DC}spatial`, "tagging", "Fort Kochi", item("fort-kochi"), "en"),
        v("1,3", SPK, "describing", "K. Joseph", item("k-joseph")),
        v("1,3", SPK, "describing", "Ravi", { type: "http://xmlns.com/foaf/0.1/Person", "rdfs:label": { "@value": "Ravi", "@language": "en" } }, "en"),
        v("1,3", SEE_ALSO, "describing", "Archive", { id: "https://archive.example/ferry" }),
        v("1,3", SEE_ALSO, "describing", "Bad link", { id: "javascript:alert(1)" }),
        v("1,3", `${DC}subject`, "tagging", "Ferries", item("ferries"), "en"),
        v("1,3", `${DC}subject`, "tagging", "Work", item("work"), "en"),
        v("1,3", `${DC}description`, "describing", "Engine noise", { "@value": "Engine noise", "@language": "en" }, "en"),
        v("1,3", "http://example.org/p/boat", "describing", "<b>Kerala Queen</b>", { "@value": "<b>Kerala Queen</b>" }),
      ],
    }),
    story(origin, project, recording, 42, {
      start: 4,
      end: 5,
      nickname: "Ravi",
      bodies: [
        { type: "TextualBody", value: "The horn in May.", format: "text/plain", language: "en" },
        v("4,5", `${DC}temporal`, "describing", "1962-05", { "@value": "1962-05", type: "xsd:gYearMonth" }),
      ],
    }),
  ];
}

/** Recordings: stories and page size. Others answer 404. */
export const RECORDINGS = {
  "rec-0042": { make: threeStories, pageSize: 100 },
  "rec-paged": { make: (o, p, r) => manyStories(o, p, r, 5), pageSize: 2 },
  "rec-long": { make: (o, p, r) => manyStories(o, p, r, 25), pageSize: 1 },
  "rec-empty": { make: () => [], pageSize: 100 },
  "rec-media": { make: mediaStories, pageSize: 100 },
  "rec-values": { make: valueStories, pageSize: 100 },
};

/** Builds the container (page = null) or page n. Returns null for a page out of range. */
export function representation(origin, project, recording, page) {
  const spec = RECORDINGS[recording];
  const items = spec.make(origin, project, recording);
  const id = `${origin}/stories/${project}/${recording}/`;
  const pages = Math.ceil(items.length / spec.pageSize);
  const pageId = (n) => `${id}?page=${n}`;
  const label = "River Voices: Ferry crossing, 1962";
  const modified = "2026-10-09T10:14:00Z";
  const hasReplies = (n) => items.slice(n * spec.pageSize, (n + 1) * spec.pageSize).some((item) => item["annoudio:replies"]);
  const makePage = (n) => {
    const p = {
      id: pageId(n),
      type: "AnnotationPage",
      startIndex: n * spec.pageSize,
      items: items.slice(n * spec.pageSize, (n + 1) * spec.pageSize),
    };
    if (n + 1 < pages) p.next = pageId(n + 1);
    if (n > 0) p.prev = pageId(n - 1);
    return p;
  };
  if (page === null) {
    const container = {
      "@context": [CONTEXT, "http://www.w3.org/ns/ldp.jsonld", ...(pages > 0 && hasReplies(0) ? [REPLIES_CONTEXT] : [])],
      id,
      type: ["BasicContainer", "AnnotationCollection"],
      label,
      total: items.length,
      modified,
    };
    if (pages > 0) {
      container.first = makePage(0);
      container.last = pageId(pages - 1);
    }
    return container;
  }
  if (page < 0 || page >= pages) return null;
  return { "@context": hasReplies(page) ? [CONTEXT, REPLIES_CONTEXT] : CONTEXT, partOf: { id, total: items.length, modified }, ...makePage(page) };
}
