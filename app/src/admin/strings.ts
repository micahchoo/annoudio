// All text of the custom admin components. English only. Field labels and descriptions
// are next to their fields, in the collection configs of each module.
// Words: CONTEXT.md (Operator, Member, Project, Recording, Story, Concept, Vocabulary,
// Draft, Published).

import { countWords, verbFor, waitLine } from '@/plural'

export const strings = {
  nav: {
    today: 'Today',
    review: 'Review stories',
    addPlayer: 'Add a player',
    concepts: 'Concepts',
    members: 'Members',
    account: 'Your account',
    /** The badge on Review stories, for a screen reader. */
    waiting: (n: number) => (n === 1 ? '1 waits for review' : `${n} wait for review`),
  },
  today: {
    title: 'Today',
    setup: 'Put your first player on a site',
    steps: {
      project: 'Make a project for your site',
      recording: 'Add a recording',
      snippet: 'Put the snippet on a site',
      story: 'Publish the first story',
    },
    done: 'Done',
    notDone: 'Not done',
    next: {
      project: 'Make a project',
      recording: 'Add a recording',
      snippet: 'Copy the snippet',
      story: 'Review stories',
    },
    pasted: 'I pasted it',
    snippetHint:
      'Paste the snippet into a page of your site. This step ticks when you select "I pasted it", or when the first story comes from your site.',
    storyHint: 'When a member tells a story, it waits for review. Publish it, and visitors see it.',
    optional: 'Optional: add concepts, so that members can choose topics.',
    addConcepts: 'Add concepts',
    hide: 'Hide the list',
    work: 'Stories',
    waiting: (stories: number, replies: number) => `${waitLine(stories, replies)}.`,
    oldest: (age: string) => `The oldest came in ${age}.`,
    start: 'Start reviewing',
    noneWaiting: 'No stories wait for review.',
    lastStory: (age: string) => `The last story came in ${age}.`,
    processing: (stories: number, replies: number) =>
      `${countWords(stories, replies)} ${verbFor(stories, replies, 'is', 'are')} processing. You can publish when the files are ready.`,
    returned: (stories: number, replies: number) =>
      `${countWords(stories, replies)} ${verbFor(stories, replies, 'is', 'are')} returned. The members must change them.`,
    automatic: (n: number) =>
      n === 1
        ? '1 of them is automatic: a file failed.'
        : `${n} of them are automatic: a file failed.`,
    otherJobs: 'Other jobs',
    recent: (r: { told: number; published: number; returned: number }) =>
      `Last 7 days: ${r.told} came in, ${r.published} published, ${r.returned} returned.`,
    countFailed: 'We could not count the stories. Reload the page.',
  },
  review: {
    tabs: 'Show',
    tab: {
      waiting: 'Waiting for review',
      processing: 'Processing',
      returned: 'Returned',
      published: 'Published',
      all: 'All',
    },
    /** The text of an empty tab. */
    empty: {
      waiting: 'No stories wait for review.',
      processing: 'No stories are processing.',
      returned: 'No stories are returned to members.',
      published: 'No stories are published yet.',
      all: 'No stories yet. Members tell stories on the Annotate page.',
    },
    lastStory: (age: string) => `The last story came in ${age}.`,
    start: 'Start reviewing',
    badge: {
      processing: 'Processing',
      waiting: 'Waiting for review',
      returned: 'Returned',
      automatic: 'Returned (automatic)',
      published: 'Published',
      change: 'Published · change waiting',
      changeProcessing: 'Published · change processing',
      changeReturned: 'Published · change returned',
    },
    /** What the state means, on the review screen. */
    stateLong: {
      processing: 'Processing. You can publish when the file is ready.',
      waiting: 'Waiting for review. Visitors do not see it.',
      returned: 'Returned to the member. Visitors do not see it. The member can change it.',
      automatic:
        'Returned automatically: a file failed. The member can attach a different file.',
      published: 'Published. Visitors see it in the player.',
      change:
        'Change to a published story. Visitors see the published version until you publish the change.',
      changeProcessing:
        'Change to a published story. Its file is processing. Visitors see the published version.',
      changeReturned:
        'Change to a published story, returned to the member. Visitors see the published version.',
    },
    since: (age: string) => `since ${age}`,
    panel: 'The story',
    by: 'Member',
    created: 'Written',
    range: 'Time range',
    replyTo: (excerpt: string | null) =>
      excerpt ? `Reply to: “${excerpt}”` : 'Reply to a story that is gone',
    replyHeading: 'The story that this reply answers',
    replyBy: (nickname: string) => `Story by ${nickname}`,
    replyIntro:
      'Visitors see this reply under that story, when that story is published.',
    play: 'Play the time range',
    noAudio: 'The recording has no audio address.',
    text: 'Text',
    tags: 'Topics',
    noTags: 'No topics.',
    goneTag: 'A concept that was removed',
    addConcept: (project: string) => `Add a concept to ${project}`,
    noTopicFits: 'No topic fits?',
    media: 'Voice note, photo or video',
    mediaStates: {
      ready: 'Ready',
      processing: 'Still processing. You can publish when it is ready.',
      failed: 'Cannot play. Ask the member to attach the file again.',
    },
    mediaKinds: { sound: 'Voice note', image: 'Photo', video: 'Video' },
    mediaColumn: { ready: 'Ready', processing: 'Processing', failed: 'Cannot play' },
    project: 'Project',
    recording: 'Recording',
    toldOn: 'Told on',
    openOnSite: 'Open on the site',
    notOnSite: 'Not from a site: the member opened the Annotate page directly.',
    reason: 'Reason',
    notFound: 'This story does not exist now.',
    next: 'Next story',
    publish: 'Publish',
    publishHeading: 'Publish this story?',
    publishHeadingReply: 'Publish this reply?',
    publishIntro: 'Visitors see it like this, within one minute:',
    mails: (nickname: string) => `We mail ${nickname} that it is published.`,
    noMail: (nickname: string) => `We send no mail to ${nickname}.`,
    confirmPublish: 'Publish the story',
    confirmPublishReply: 'Publish the reply',
    published: 'Published. Visitors see it within one minute.',
    stillProcessing: 'The voice note, photo or video is still processing.',
    publishErrors: {
      'media-not-ready':
        'A voice note, photo or video is not ready, or it failed. Wait, or return the story to the member.',
      forbidden: 'Sign in again.',
      'not-found': 'This story does not exist now. Reload the page.',
    },
    return: 'Return to the member',
    returnHeading: 'Return this story to the member',
    returnIntro:
      'The member sees your reason on the Annotate page and in a mail, and can change the story.',
    returnPublished: 'Visitors stop seeing this story.',
    returnChange: 'Visitors keep seeing the published version.',
    reasonHint: 'Example: Please remove the full name of your neighbour.',
    noReason: 'Write the reason. The member sees it.',
    confirmReturn: 'Return the story',
    returned: 'Returned to the member.',
    remove: 'Remove',
    removeHeading: 'Remove this story?',
    removeIntro:
      'The story goes for ever. Visitors stop seeing it within one minute. We mail the member.',
    removeReplies: (n: number) =>
      n === 1 ? 'Its reply is removed too.' : `Its ${n} replies are removed too.`,
    removeReason: 'Reason (optional). The member reads it in the mail.',
    confirmRemove: 'Remove the story',
    removed: 'The story is removed.',
    cancel: 'Cancel',
    failed: 'This did not work. Reload the page and try again.',
  },
  history: {
    tab: 'History',
    story: 'Story',
    heading: 'History of this story',
    intro: 'Each line is one change, newest first. Times are in the time zone of this browser.',
    sent: (nickname: string) => `Sent for review by ${nickname} (member)`,
    changed: (nickname: string) => `Changed by ${nickname} (member)`,
    published: (by: string) => `Published by ${by}`,
    publishedBySystem: 'Published at once: the project publishes each story when it is ready.',
    returned: (by: string, reason: string) => `Returned by ${by}: ${reason}`,
    automatic: 'Returned automatically: a file failed.',
    sentAgain: 'Sent again after a return',
  },
  addPlayer: {
    title: 'Put a recording on a site',
    steps: { recording: 'Recording', site: 'Site', snippet: 'Snippet' },
    stepsLabel: 'Steps',
    next: 'Next',
    change: 'Change',
    failed: 'This did not work. Reload the page and try again.',
    recording: {
      choose: 'Choose a recording',
      search: 'Search the recordings',
      noMatch: 'No recording has this title.',
      new: 'New recording',
      title: 'Title',
      url: 'Audio address',
      urlHint: 'The web address of the audio file, for example https://media.example.org/ferry.m4a.',
      pick: 'Choose a recording.',
      chosen: (title: string) => `Recording: ${title}`,
    },
    site: {
      question: 'Which site shows the player?',
      one: (name: string) => `Site: ${name}`,
      new: 'New project',
      newHint: 'A project is one site: its topics, look and review rule. You can change its other settings later, in Projects.',
      name: 'Name',
      website: 'Website address',
      websiteHint: 'For example https://www.example.org. Members come back only to this site.',
      noWebsite: 'no website address yet',
      pick: 'Choose a site.',
      chosen: (name: string) => `Site: ${name}`,
    },
    snippet: {
      intro: 'Paste these two lines into the page. A page needs the first line one time only.',
      comeBack: (sites: string) => `Members come back only to ${sites}.`,
      noSites:
        'This project has no website address. After a story, members do not come back to a site. Add the address in Projects.',
      plugins: (id: string) => `WordPress or Omeka S: type the recording number ${id} in the block.`,
      preview: 'Preview: the player with the look of this project',
      done: 'Done',
    },
  },
  recordings: {
    add: 'Add a player',
    empty: 'No recordings yet. Select "Add a player" to add the first one and put it on a site.',
  },
  recording: {
    snippet: 'Snippet',
    snippetIntro:
      'Paste these two lines into a web page to show the player with its stories. A page needs the first line one time only.',
    project: 'Project',
    noProject: 'Make a project first. Each snippet belongs to one project.',
    unsaved: 'Save the recording first. Then the snippet shows here.',
    copy: 'Copy the snippet',
    copied: 'Copied.',
    copyRefused: 'This browser did not copy. The snippet is selected: press Ctrl+C (⌘C on a Mac).',
    id: (id: string) => `Recording ID: ${id}`,
    probing: 'Checking the audio address…',
    plays: (length: string) => `The audio plays in this browser. Length: ${length}.`,
    cannotPlay:
      'This browser cannot play the audio at this address. Check the address, or add a different format.',
    noUrl: 'Type the audio address. The length shows here.',
    length: 'Length',
    unknown: 'Not known',
  },
  concepts: {
    title: 'Concepts',
    intro: 'Members see concepts as topics. They choose topics when they tell a story.',
    project: 'Project',
    noProject: 'Make a project first. Each project has its own concepts.',
  },
  overview: {
    tab: 'Overview',
    settings: 'Settings',
    heading: (name: string) => `${name}: overview`,
    stories: 'Stories and replies',
    states: {
      waiting: 'Waiting for review',
      processing: 'Processing',
      returned: 'Returned',
      published: 'Published',
    },
    review: 'Review the stories of this project',
    recordings: 'Recordings with stories here',
    noRecordings: 'No recording has stories in this project yet.',
    storyCount: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    concepts: (n: number) => (n === 1 ? '1 concept' : `${n} concepts`),
    conceptsLink: 'Open the concepts',
    members: (n: number) =>
      n === 1 ? '1 member told stories here.' : `${n} members told stories here.`,
    unsaved: 'Save the project first. Then its overview shows here.',
  },
  vocabulary: {
    heading: 'Vocabulary',
    intro:
      'The concepts that members can choose as topics. To add one, select "Add a concept" and type the label. The app makes the concept address.',
    unsaved: 'Save the project first. Then you can add concepts.',
    none: 'No concepts yet. Members see no topics.',
    add: 'Add a concept',
    stories: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    hidden: 'hidden',
    download: 'Download as SKOS',
    turtle: 'Turtle (.ttl)',
    jsonLd: 'JSON-LD (.jsonld)',
    upload: 'Upload SKOS file',
    uploadIntro:
      'A Turtle or JSON-LD file with skos:Concept items. The upload adds new concepts and updates the label and broader concept of known ones. It never removes a concept.',
    preview: (r: { concepts: number; added: number; changed: number; unchanged: number }) =>
      `The file has ${r.concepts} concepts: ${r.added} new, ${r.changed} changed, ${r.unchanged} with no change.`,
    skipped: (n: number) => (n === 1 ? '1 concept is left out:' : `${n} concepts are left out:`),
    skipReasons: {
      'not-a-web-address': 'it has no web address',
      'no-label': 'it has no label',
      'other-project': 'a different project has it',
    },
    ignoredParents: (n: number) =>
      n === 1 ? '1 broader link is ignored.' : `${n} broader links are ignored.`,
    apply: 'Import these changes',
    applied: 'The vocabulary is updated.',
    errors: {
      'unknown-project': 'This project does not exist now.',
      'too-large': 'The file is too large. The limit is 1 MB and 5000 concepts.',
      'not-skos': 'This file is not a SKOS file that the app can read.',
      forbidden: 'Sign in again.',
    },
  },
  concept: {
    usage: 'Stories',
    uses: (n: number) =>
      n === 0
        ? 'No story uses this concept. You can delete it.'
        : `${n === 1 ? '1 story uses' : `${n} stories use`} this concept. You cannot delete it. To stop members choosing it, select "Hide from new stories".`,
    unsaved: 'Save the concept first.',
  },
  theme: {
    heading: 'Preview',
    intro:
      'The player as it shows on a host site, with the values below. The preview changes while you type. Host sites get the change after you save, within 5 minutes.',
    noRecording: 'Add a recording to the catalogue to see a preview here.',
    unsaved: 'Save the project first. Then the preview shows here.',
  },
} as const
