// All text of the custom admin components. English only. Field labels and descriptions
// are next to their fields, in the collection configs of each module.
// Words: CONTEXT.md (Operator, Member, Project, Recording, Story, Concept, Vocabulary,
// Draft, Published).

import { countWords, verbFor, waitLine } from '@/plural'

export const strings = {
  /** Names for Payload's own buttons that have none (admin/ui/AccessibleNames.tsx). */
  payload: {
    documentMenu: 'More actions for this document',
    copyMenu: 'Copy or paste these rows',
    listMenu: 'More actions for this list',
    selectAll: 'Select all rows',
    selectRow: 'Select this row',
  },
  nav: {
    today: 'Today',
    review: 'Review stories',
    addWidget: 'Add a widget',
    vocabulary: 'Vocabulary',
    members: 'Members',
    recordings: 'Recordings',
    account: 'Your account',
    /** The badge on Review stories, for a screen reader. */
    waiting: (n: number) => (n === 1 ? '1 waits for review' : `${n} wait for review`),
  },
  today: {
    title: 'Today',
    help: 'Members tell stories about parts of your recordings, and you decide which stories visitors see. Start with the work below.',
    aboutHeading: 'What Annoudio does',
    about:
      'Annoudio is a tool for audio annotation. A member selects a part of a recording and tells a story about it. The story can have text, a voice note, a photo or a video. You read each story and publish it. Then visitors see it in the widget on your site, on the timeline of the recording. Annoudio keeps each story as a W3C Web Annotation, so other archive tools can read it.',
    setup: 'Put your first widget on a site',
    steps: {
      project: 'Make a project for your site',
      recording: 'Add a recording',
      snippet: 'Paste the snippet into your site',
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
    storyHint:
      'A visitor selects "Tell a story" in the widget and becomes a member. Publish the story, and visitors see it in the widget.',
    optional: 'Optional: add questions, so members tell you place and time.',
    addConcepts: 'Add questions',
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
    stats: {
      waiting: 'Waiting for review',
      processing: 'Processing',
      returned: 'Returned to members',
    },
    statNote: {
      waiting: 'Your move: publish or return them.',
      processing: 'The system: files are being processed.',
      returned: "The members' move: they change them.",
    },
    recent: (r: { told: number; published: number; returned: number }) =>
      `Last 7 days: ${r.told} came in, ${r.published} published, ${r.returned} returned.`,
    countFailed: 'We could not count the stories. Reload the page.',
    noMail: 'No mail server: members sign in with invite codes.',
    noMailHint:
      'Make the codes on the page of a project, in the tab Sign-in. To send login codes by email, set SMTP_URL on the stack.',
  },
  review: {
    help: 'A story is a note that a member made on a time range of a recording. Read each story, then publish it or return it to the member.',
    storyHelp: (range: string, recording: string) =>
      `This story is a note on ${range} of "${recording}". Play the range, read the story, then publish it or return it.`,
    replyHelp: (recording: string) =>
      `This reply answers a story about "${recording}". Read both, then publish the reply or return it.`,
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
      all: 'No stories yet. Visitors select "Tell a story" in a widget to tell one.',
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
      sentAgain: 'Sent again',
    },
    /** What the state means, on the review screen. */
    stateLong: {
      processing: 'Processing. You can publish when the file is ready.',
      waiting: 'Waiting for review. Visitors do not see it.',
      returned: 'Returned to the member. Visitors do not see it. The member can change it.',
      automatic: 'Returned automatically: a file failed. The member can attach a different file.',
      published: 'Published. Visitors see it in the widget.',
      change:
        'Change to a published story. Visitors see the published version until you publish the change.',
      changeProcessing:
        'Change to a published story. Its file is processing. Visitors see the published version.',
      changeReturned:
        'Change to a published story, returned to the member. Visitors see the published version.',
      sentAgain: 'The member changed the story after a return and sent it again.',
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
    replyIntro: 'Visitors see this reply under that story, when that story is published.',
    play: 'Play the time range',
    noAudio: 'The recording has no audio address.',
    text: 'Text',
    /** The answers of a story (design/vocab.md §8, O5). */
    tags: 'Answers',
    noTags: 'No answers.',
    noLabel: 'Answer',
    ownAnswer: (text: string) => `${text} (new)`,
    addOwn: (text: string, list: string) => `Add "${text}" to ${list}`,
    addedOwn: (text: string, list: string) =>
      `"${text}" is in ${list} now. This story keeps its own answer.`,
    addConcept: (list: string) => `Add an item to ${list}`,
    noTopicFits: 'No item fits?',
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
    notOnSite:
      'Not known. The member came from a page that is not on the website list of this project, or opened the Annotate page directly.',
    notListed: (host: string) => `${host} (not on the website list)`,
    notListedHint:
      'The Annotate page did not send the member back to this page, because the website is not on the list of this project. Add it, so that members come back to it.',
    addWebsite: 'Add this website',
    previewPage: 'The preview page of the admin (an operator tried the widget)',
    openPreview: 'Open the preview',
    memberStories: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    addedWebsite: (host: string) => `${host} is on the website list now.`,
    reason: 'Reason',
    notFound: 'This story does not exist now.',
    next: 'Next story',
    publish: 'Publish',
    publishHeading: 'Publish this story?',
    publishHeadingReply: 'Publish this reply?',
    publishIntro: 'Visitors see it like this in the widget, within one minute:',
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
      'The member sees your reason on the Annotate page and in a mail. Write what the member must change.',
    returnPublished: 'Visitors stop seeing this story.',
    returnChange: 'Visitors keep seeing the published version.',
    reasonHint: 'Example: Please remove the full name of your neighbour.',
    noReason: 'Write the reason. The member sees it.',
    confirmReturn: 'Return the story',
    returned: 'Returned to the member.',
    remove: 'Remove',
    removeHeading: 'Remove this story?',
    removeIntro:
      'The widget stops showing this story and its replies within one minute. The story goes for ever, and we mail the member.',
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
  },
  addWidget: {
    title: 'Add a widget to a site',
    help: 'A widget plays one recording on a page of your site and shows the stories about it. Choose the recording, then the site, then copy the snippet.',
    steps: { recording: 'Recording', site: 'Site', snippet: 'Snippet' },
    stepsLabel: 'Steps',
    next: 'Next',
    change: 'Change',
    failed: 'This did not work. Reload the page and try again.',
    recording: {
      help: 'The widget plays this recording, and every story marks a time range on it. Choose a recording, or add a new one with its audio address.',
      label: 'Recording',
      placeholder: 'Choose a recording…',
      newOption: 'A new recording: type its audio address',
      new: 'New recording',
      title: 'Title',
      url: 'Audio address',
      urlHint:
        'The web address of the audio file, for example https://media.example.org/ferry.m4a.',
      pick: 'Choose a recording.',
      chosen: (title: string) => `Recording: ${title}`,
    },
    site: {
      question: 'Which site shows the widget?',
      help: 'The project of the site sets the look, the lists and the review rule of the widget. Choose the site, or add a new one.',
      one: (name: string) => `Site: ${name}`,
      placeholder: 'Choose a site…',
      newOption: 'A new project for a new site',
      option: (name: string, hosts: string) => (hosts ? `${name} · ${hosts}` : name),
      more: (host: string, n: number) => `${host} and ${n} more`,
      new: 'New project',
      newHint:
        'A project holds the settings for one site: its lists, look, review rule and rights line. You can change them later, in Projects.',
      name: 'Name',
      website: 'Website address',
      websiteHint: 'For example https://www.example.org. Members come back only to this site.',
      noWebsite: 'no website address yet',
      pick: 'Choose a site.',
      chosen: (name: string) => `Site: ${name}`,
    },
    snippet: {
      intro: (recording: string) =>
        `These two lines show the widget for "${recording}" on a page. Paste them into the page: a page needs the first line one time only.`,
      comeBack: (sites: string) => `Members come back only to ${sites}.`,
      noSites:
        'This project has no website address. After a story, members do not come back to a site. Add the address in Projects.',
      plugins: (id: string) =>
        `WordPress or Omeka S: type the recording number ${id} in the block.`,
      preview: 'The widget with the look of this project, as visitors see it. Its links work: try them.',
      done: 'Done',
      doneHint: 'Done goes to Today. The widget stays in the project, on its Overview.',
    },
  },
  recordings: {
    add: 'Add a widget',
    empty: 'No recordings yet. Select "Add a widget" to add the first recording and put it on a site.',
  },
  recording: {
    help: 'Members tell stories about time ranges of this recording. Copy the snippet to show its widget on a page of your site.',
    snippet: 'Snippet',
    snippetIntro:
      'Paste these two lines into a web page. The page then shows the widget of this recording, with its stories.',
    tryIt: 'Try it: tell a story',
    tryItHint:
      'Opens the Annotate page as a member sees it. After the story, it sends you to the preview of the widget.',
    widgets: 'Widgets of this recording',
    usedIn: 'Used in projects',
    addToProject: 'Add to a project',
    noWidget:
      'This recording has no widget yet. Add it to a project: then you get its snippet and can try it.',
    preview: 'Open the preview',
    annotateAt: 'Members tell stories about this recording on this page:',
    snippetFor: (project: string) => `Snippet for ${project}`,
    project: 'Project',
    noProject: 'Make a project first. Each snippet belongs to one project.',
    unsaved: 'Save the recording first. Then the snippet shows here.',
    copy: 'Copy the snippet',
    copied: 'Copied.',
    copyRefused: 'This browser did not copy. The snippet is selected: press Ctrl+C (⌘C on a Mac).',
    id: (id: string) => `Recording number: ${id}. WordPress or Omeka S: type this number in the block.`,
    probing: 'Checking the audio address…',
    plays: (length: string) => `The audio plays in this browser. Length: ${length}.`,
    cannotPlay:
      'This browser cannot play the audio at this address. Check the address, or add a different format.',
    noUrl: 'Type the audio address. The length shows here.',
    length: 'Length',
    unknown: 'Not known',
  },
  /** The empty state of each list, with its next move (design/concept-map.md §2.1). */
  empty: {
    projects: 'No projects yet. A project holds the settings for one site: the lists, the look of the widget, the review rule and the rights line.',
    newProject: 'New project',
    members:
      'No members yet. A person becomes a member when they select "Tell a story" in a widget and sign in.',
    operators:
      'You are the only operator. Add a colleague, so that review does not stop when you are away.',
    addOperator: 'Add an operator',
    media:
      'No voice notes, photos or videos yet. Members attach them to their stories on the Annotate page.',
    items: 'No items yet. Each list of a project holds its items: open the lists of a project.',
    openLists: 'Open the lists',
  },
  /** The sign-in screen of the admin (O1, O2). */
  login: {
    heading: 'Sign in to Annoudio',
    help: 'Annoudio keeps the stories that members tell about your recordings. Sign in with the email and password of your operator account.',
  },
  /** The page of one member (O14). */
  member: {
    help: 'These are the stories that this member told about your recordings. To stop new stories from this member, set Status to Blocked.',
    blocked: 'This member cannot sign in. Their published stories stay.',
    stories: 'Stories and replies',
    all: (n: number) => (n === 1 ? 'All: 1 story or reply' : `All: ${n} stories and replies`),
    none: 'This member has no stories now.',
    invites: 'Signed in with an invite code',
    invite: (hint: string, label: string | null) => (label ? `${hint}… (${label})` : `${hint}…`),
    test: 'Test',
    testMeaning: 'An operator made this member to try the member steps. Member counts leave it out.',
    testLine: 'Test member: an operator made it to try the member steps. Member counts leave it out.',
  },
  concepts: {
    title: 'Lists',
    intro: 'Members pick from these lists when they answer a question.',
    project: 'Project',
    noProject: 'Make a project first. Each project has its own lists.',
  },
  project: {
    /** The label of a website row with no address yet. */
    newWebsite: 'New website',
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
    help: 'These counts show the stories that members told about recordings on this site. Open a list to review or change them.',
    review: (n: number) => `Waiting for review (${n})`,
    allStories: 'All stories of this project',
    recordings: 'Widgets of this project',
    recordingsHelp: 'Each widget plays one recording on a page of this site. Open one to copy its snippet.',
    noRecordings:
      'This project has no widget yet. Select "Add a widget" to put a recording on a page of this site.',
    addWidget: 'Add a widget',
    stateLink: (state: string) => `Open the list: ${state}`,
    storyCount: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    concepts: (n: number) => (n === 1 ? '1 item in lists' : `${n} items in lists`),
    conceptsLink: 'Open the lists',
    members: (n: number) =>
      n === 1 ? '1 member told stories here.' : `${n} members told stories here.`,
    unsaved: 'Save the project first. Then its overview shows here.',
  },
  vocabulary: {
    heading: 'Vocabulary',
    intro:
      'Members choose items from this list to say what a story is about. Add, rename or hide items here.',
    unsaved: 'Save the project first. Then you can add items.',
    none: 'Topics is empty. Members can choose no subject until you add an item.',
    add: 'Add an item',
    stories: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    hidden: 'hidden',
    download: 'Download the list (SKOS)',
    turtle: 'Turtle (.ttl)',
    jsonLd: 'JSON-LD (.jsonld)',
    upload: 'Load a SKOS file',
    uploadIntro:
      'Use this when your list comes from a different system. The file is Turtle or JSON-LD with skos:Concept items. It adds and renames items, and never removes one.',
    preview: (r: { concepts: number; added: number; changed: number; unchanged: number }) =>
      `The file has ${r.concepts} items: ${r.added} new, ${r.changed} changed, ${r.unchanged} with no change.`,
    skipped: (n: number) => (n === 1 ? '1 item is left out:' : `${n} items are left out:`),
    skipReasons: {
      'not-a-web-address': 'it has no web address',
      'no-label': 'it has no label',
      'other-project': 'a different project has it',
      'other-list': 'a different list of this project has it',
    },
    ignoredParents: (n: number) =>
      n === 1
        ? '1 link to a broader item is ignored.'
        : `${n} links to a broader item are ignored.`,
    apply: 'Import these changes',
    applied: 'The list is updated.',
    errors: {
      'unknown-project': 'This project does not exist now.',
      'too-large': 'The file is too large. The limit is 1 MB and 5000 items.',
      'not-skos': 'This file is not a SKOS file that the app can read.',
      forbidden: 'Sign in again.',
    },
  },
  /** The Vocabulary tab and page (design/vocab.md §8; words: design/concept-map.md §2.2, §3.8). */
  questions: {
    tab: 'Vocabulary',
    title: 'Vocabulary',
    heading: (project: string) => `Questions · ${project}`,
    help: 'Each question asks the member for one fact about the time range, for example the place. Add the questions that you want members to answer, in the order that they see them.',
    none: 'No questions yet. Members write their story only.',
    unsaved: 'Save the project first. Then you can add questions.',
    noProject: 'Make a project first. Each project has its own questions.',
    project: 'Project',
    add: 'Add a question',
    phone: 'See it on a phone',
    noRecording: 'Add a recording first. Then you can see the questions on a phone.',
    edit: 'Edit',
    editLabel: (label: string) => `Edit: ${label}`,
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveUpLabel: (label: string) => `Move ${label} up`,
    moveDownLabel: (label: string) => `Move ${label} down`,
    stories: (n: number) => (n === 1 ? '1 story' : `${n} stories`),
    hiddenBadge: 'Hidden from new stories',
    optional: 'optional',
    required: 'must answer',
    upTo: (n: number) => `up to ${n}`,
    own: 'own answers',
    asTags: 'as tags',
    notShown: 'not in the widget',
    fromList: (list: string) => `From "${list}"`,
    kinds: {
      text: 'Text',
      date: 'Date',
      number: 'Number',
      link: 'Link',
      list: 'From a list',
      entity: 'People, places or things',
    },
    dialog: {
      heading: 'Add a question',
      help: 'A question becomes a field below the story on the Annotate page, and its answer shows on the story in the widget. Choose a common question, or write your own.',
      common: 'Common questions',
      asked: 'asked',
      advanced: 'Advanced: from an ontology',
      search: 'Search',
      allOntologies: 'All ontologies',
      ontology: 'Ontology',
      noTerms: 'No property of the loaded ontologies has these words.',
      choose: 'Choose',
      chooseLabel: (label: string) => `Choose ${label}`,
      loadFile: 'Load a vocabulary file',
      own: 'Your own question',
      writeNew: 'Write a new question',
      cancel: 'Cancel',
      added: 'The question is added.',
    },
    form: {
      heading: (label: string) => `Edit: ${label}`,
      newHeading: 'Your own question',
      help: 'Members see this question and its help below their story. Change the words, the answer type or the list here.',
      label: 'Question members see',
      labelHelp: 'The words that members see above the field.',
      helpField: 'Help',
      helpHelp: 'One line below the question.',
      kind: 'Kind of answer',
      kindHelp:
        'The kind of answer: text, date, number, link, or a choice from a list. You cannot change it after the first answer.',
      list: 'Choices from',
      listHelp: 'The list that gives the choices.',
      noList: 'Choose a list',
      newList: 'New list',
      newListName: 'Name of the list',
      newListHelp: 'Operators see it. Members see the question, not the list.',
      max: 'How many answers',
      maxHelp: 'A number from 1 to 10.',
      own: 'Members can add their own answer',
      ownHelp: 'Members can type an answer that is not in the list.',
      required: 'Must answer',
      requiredHelp:
        'A member cannot send the story without an answer. It applies at the next save of a story.',
      showAs: 'Show in the widget',
      showAsOptions: { line: 'Label: value', tags: 'Tags', none: 'No' },
      showAsNone: 'The answer stays in the public data of the story.',
      inUse: (n: number) =>
        `${n === 1 ? '1 story answers' : `${n} stories answer`} this question. Kind and list are fixed. To ask in a new way, add a new question.`,
      savedAs: (curie: string, ontology: string) =>
        ontology ? `Saved as: ${curie} (${ontology})` : `Saved as: ${curie}`,
      address: (iri: string) => `Address: ${iri} (never changes)`,
      ownAddress: 'The app makes an address for this question when you add it. It never changes.',
      save: 'Save',
      add: 'Add the question',
      hide: 'Hide from new stories',
      show: 'Ask it again',
      remove: 'Remove from the form',
      saved: 'Saved.',
      removed: 'The question is removed.',
    },
    errors: {
      'unknown-project': 'This project does not exist now. Reload the page.',
      'unknown-term': 'Type the question. A question needs words.',
      'property-taken': 'This project asks this already. Each property can be asked one time.',
      'field-in-use':
        'Stories answer this question. You can hide it, but you cannot remove it or change its kind or list.',
      'too-many': 'A project has 20 questions at most, and an answer count is from 1 to 10.',
      'bad-list': 'Choose a list that fits the kind of answer.',
      'not-a-property': 'Choose a property, not a class.',
      'bad-class': 'Choose the kind of things in the list.',
      exists: 'A list with this name exists. Choose it under "List".',
      forbidden: 'Sign in again.',
    },
  },
  /** The Lists tab and the page of one list (O10l, Q4; design/vocab.md §8). */
  lists: {
    tab: 'Lists',
    title: 'Lists',
    help: 'Members pick from these lists when they answer a question.',
    none: 'No lists yet. A question with choices makes its list, or add one here.',
    items: (n: number, kind: 'items' | 'entities') =>
      kind === 'entities'
        ? n === 1
          ? '1 entry'
          : `${n} entries`
        : n === 1
          ? '1 item'
          : `${n} items`,
    askedBy: (labels: string[]) =>
      labels.length > 0 ? `asked by: ${labels.join(', ')}` : 'asked by no question',
    open: 'Open',
    openLabel: (label: string) => `Open ${label}`,
    add: 'Add a list',
    name: 'Name of the list',
    nameHelp: 'Operators see it. Members see the question, not the list.',
    kind: 'Kind of list',
    kinds: { items: 'Words and subjects', entities: 'People, places or things' },
    class: 'What the entries are',
    added: 'The list is added.',
    allLists: 'All lists',
    listHelp:
      'A list holds the items that members can choose as an answer, for example the places of your area. Add, rename or hide items here.',
    empty: (list: string) => `${list} is empty. Members can choose nothing from it yet.`,
    addItem: 'Add an item',
    columns: { label: 'Label', sameAs: 'Same as', stories: 'Stories' },
    noSameAs: 'None',
    otherSystems: 'For other systems: download a list as SKOS, upload a SKOS file',
    download: (list: string) => `Download ${list} (SKOS)`,
    errors: {
      'too-many': 'A project has 20 lists at most.',
      'bad-class': 'Type a name, and choose what the entries are.',
      forbidden: 'Sign in again.',
    },
    /** A second list with the same name: "Places exists." and a link to it. */
    exists: (label: string) => `${label} exists.`,
    openExisting: 'Open it',
    backTo: (label: string) => `Back to ${label}`,
    quickAdd: 'New item',
    quickAddButton: 'Add',
    quickAdded: (label: string) => `Added ${label}.`,
    allFields: 'Add an item with all fields',
  },
  /** For other systems (O10x, design/vocab.md §8). */
  otherSystems: {
    heading: 'For other systems',
    download: 'Download',
    shacl: 'Questions as SHACL',
    shaclJsonLd: 'Questions as SHACL (JSON-LD)',
    omeka: 'Omeka template',
    linked: 'Linked data',
    turtle: 'Turtle (.ttl)',
    trig: 'TriG, one graph per story (.trig)',
    jsonld: 'JSON-LD (.jsonld)',
    linkedHelp:
      'The published stories, their answers as statements, and the questions and lists of this project.',
    upload: 'Upload',
  },
  /** "Load a vocabulary file" (Q5, design/concept-map.md §2.2; design/vocab.md §6). */
  loadFile: {
    otherSystems: 'For other systems',
    heading: 'Load a vocabulary file',
    help: 'Use this when you have an ontology, a schema or a SKOS file. Load the file, choose what to keep, then load it.',
    file: 'Vocabulary file',
    fileHelp: 'Turtle, JSON-LD, RDF/XML, SHACL or an Omeka template. 5 MB at most.',
    reading: 'Reading the file…',
    found: 'We found:',
    ontology: (o: {
      properties: number
      classes: number
      label: string
      prefix: string
      isNew: boolean
    }) =>
      `${o.properties === 1 ? '1 property' : `${o.properties} properties`} and ${o.classes === 1 ? '1 class' : `${o.classes} classes`} (${o.isNew ? 'a new ontology' : 'a new version of'} "${o.label}", ${o.prefix})`,
    changes: (c: { added: number; changed: number; unchanged: number; gone: number }) =>
      `${c.added} new, ${c.changed} changed, ${c.unchanged} with no change, ${c.gone} no longer in the file.`,
    list: (l: { label: string; items: number; exists: boolean }) =>
      `1 list "${l.label}" (${l.items === 1 ? '1 item' : `${l.items} items`})${l.exists ? ', merged into the list you have' : ''}`,
    leftOut: (unlabelled: number, outside: number) =>
      [
        outside > 0
          ? outside === 1
            ? '1 term of a different namespace'
            : `${outside} terms of a different namespace`
          : '',
        unlabelled > 0
          ? unlabelled === 1
            ? '1 property with no label'
            : `${unlabelled} properties with no label`
          : '',
      ]
        .filter(Boolean)
        .join(', '),
    leftOutLabel: 'Left out:',
    form: (label: string, added: number) =>
      `1 form "${label}": ${added === 1 ? '1 new question' : `${added} new questions`}, added after your questions`,
    known: (n: number) =>
      n === 1 ? '1 question you ask already' : `${n} questions you ask already`,
    questionLeftOut: (label: string, reason: string) => `"${label}" (${reason})`,
    reasons: {
      'unknown-term': 'its property is not loaded',
      'not-a-property': 'it is not a property',
      'unknown-list': 'its list is not in this project',
    },
    name: 'Name of the ontology',
    prefix: 'Prefix',
    prefixHelp: 'A short name, for example ra. Files that we make for other systems use it.',
    load: 'Load these',
    loaded: 'The file is loaded.',
    errors: {
      'too-large': 'The file is too large. The limit is 5 MB.',
      unreadable: 'We cannot read this file. Use Turtle, JSON-LD or RDF/XML.',
      'too-many-terms': 'The file has more than 20 000 terms.',
      'too-many-items': 'A list in the file has more than 5000 items.',
      'prefix-clash': 'Change the prefix. Annoudio uses this prefix for a different meaning.',
      'prefix-taken': 'Change the prefix. A different loaded ontology has this prefix.',
      bundled: 'Annoudio comes with this ontology. You do not need to load it.',
      'unknown-project': 'This project does not exist now. Reload the page.',
      nothing: 'We found nothing that we can use in this file.',
      forbidden: 'Sign in again.',
    },
  },
  concept: {
    usage: 'Stories',
    uses: (n: number) =>
      n === 0
        ? 'No story uses this item. You can delete it.'
        : `${n === 1 ? '1 story uses' : `${n} stories use`} this item. You cannot delete it. To stop members from choosing it, select "Hide from new stories".`,
    unsaved: 'Save the item first.',
  },
  invites: {
    heading: 'Invite codes',
    intro:
      'An invite code lets a person sign in and tell stories without a mail. Give one code to each person, for example on paper.',
    noMail:
      'The app does not check the email of these members. So it sends them no mail until they sign in once with a login code.',
    unsaved: 'Save the project first. Then you can make invite codes.',
    notAllowed:
      'This project signs members in with login codes only. Choose an invite code above, and save, before members can use these codes.',
    make: 'Make invite codes',
    count: 'How many codes',
    label: 'Label (optional)',
    labelHint: 'Only operators see it. For example: Workshop 12 Oct.',
    expires: 'Last day (optional)',
    expiresHint: 'After this day the codes stop working. Empty: no last day.',
    uses: 'Members per code',
    usesHint:
      '1: one code for each person. More: one code for a group, for example 30 for a class.',
    making: 'Making…',
    madeHeading: (n: number) => (n === 1 ? 'Your new code' : `Your ${n} new codes`),
    madeHint:
      'Copy or print them now. The app keeps no copy that it can show again. If you lose them, revoke them and make new ones.',
    copy: 'Copy the codes',
    copied: 'Copied.',
    print: 'Print the codes',
    printTitle: 'Invite codes',
    printHow: (address: string) =>
      `Open ${address}, select "Tell a story", then "Have an invite code?". Type your email, this code and a name.`,
    done: 'I saved them',
    none: 'No invite codes yet.',
    columns: { code: 'Code', label: 'Label', used: 'Used', lastDay: 'Last day', state: 'State' },
    starts: (hint: string) => `${hint}…`,
    usedOf: (used: number, uses: number) => `${used} of ${uses}`,
    noLastDay: 'None',
    states: { active: 'Works', expired: 'Expired', 'used-up': 'Used up', revoked: 'Revoked' },
    revoke: 'Revoke',
    revokeLabel: (hint: string) => `Revoke the code that starts with ${hint}`,
    revoked:
      'The code is revoked. Members who used it stay signed in. To stop one of them, block the member in Members.',
    errors: {
      'invalid-count': 'Type a number from 1 to 100.',
      'invalid-uses': 'Type a number of members from 1 to 1000.',
      'invalid-expiry': 'Choose a last day that is today or later.',
      'unknown-project': 'Save the project first.',
      forbidden: 'Sign in again.',
      unknown: 'We could not find this code. Reload the page.',
    },
  },
  /** The operator preview of one widget (/admin/preview/{project}/{recording}). */
  preview: {
    crumb: 'Preview',
    title: (recording: string, project: string) => `${recording} · ${project}`,
    help: 'This is the widget as visitors see it on your site, with its published stories. Select "Tell a story" in it to walk the steps of a member: after the story, the Annotate page sends you back here.',
    open: 'Open the Annotate page',
    review: 'Review the stories of this widget',
    recording: 'The recording',
    project: 'The project',
    widget: 'The widget',
    notFound: 'This project or recording does not exist now.',
    noWebsite:
      'This project has no website address yet. On a real site, members come back only to a website on the list of the project.',
  },
  /** The colour picker of a theme token (design/design-system.md §6.1). */
  colour: {
    swatch: (label: string) => `${label}: choose with the colour picker`,
    passes: (ratio: string, under: string, need: number) =>
      `${ratio} on the ${under} · passes ${need === 3 ? 'for lines and icons' : 'for text'}`,
    fails: (ratio: string, under: string, need: number) =>
      `${ratio} on the ${under} · too low ${need === 3 ? 'for lines and icons' : 'for text'}, needs ${need}:1`,
    unmeasured: 'We cannot measure this colour.',
    notAColour: 'This is not a colour that we can show. Use a hex value, for example #0b6e99.',
    default: (value: string) => `Empty: the widget uses the default, ${value}.`,
  },
  theme: {
    heading: 'Preview',
    intro:
      'The theme sets how the widget of this project looks on your site. Change a value, then save: the widget on your sites shows the change at the next page load.',
    noRecording: 'Add a recording to see the widget here.',
    preset: 'Start from',
    presetHelp: 'Fills the colours with a tested set. You can change each value after.',
    presets: { choose: 'Choose a set…', light: 'The default light set', dark: 'The dark set' },
    presetApplied: 'The colours are filled. Save to keep them.',
    unsaved: 'Save the project first. Then the preview shows here.',
  },
} as const
