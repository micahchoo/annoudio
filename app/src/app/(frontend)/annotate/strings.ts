// All text of the Annotate page, Your stories and Your account. English only for now. To
// add a language, add an object with the same keys and choose it by the request language.
// Words: CONTEXT.md and design/ia.md §7 (Story, Reply, Widget, Send for review, Returned).
// Help lines: design/concept-map.md §2.3.

import type { Lifecycle } from '@/modules/stories'

export const strings = {
  title: 'Tell a story',
  replyTitle: 'Reply to a story',
  /** The page title while the member changes a story that an operator returned. */
  changeTitle: 'Change your story',
  unknown: {
    heading: 'We cannot find this recording',
    body: 'The link does not point to a recording that this site knows. Go back to the page you came from and try the link again.',
  },
  back: 'Back to the site',
  /** A `return` whose website is not on the list of the project (workflow-audit 12). */
  notListed: 'We cannot send you back to the page that you came from, because its website is not on the list of this project.',
  menu: {
    label: (nickname: string) => `${nickname}: your menu`,
    stories: 'Your stories',
    account: 'Your account',
    signOut: 'Sign out',
  },
  signIn: {
    heading: 'Sign in to tell a story',
    replyHeading: 'Sign in to reply',
    moment: (time: string, recording: string) => `You tell a story about ${time} of "${recording}".`,
    replyMoment: (nickname: string) => `You reply to the story by ${nickname}.`,
    intro: 'Type your email, and we send you a login code. You do not need a password.',
    email: 'Email',
    sendCode: 'Send the code',
    codeHeading: 'Type your login code',
    codeSent: (email: string) => `We sent a code to ${email}. It works for 10 minutes.`,
    code: 'Login code',
    checkCode: 'Sign in',
    newCode: 'Send a new code',
    otherEmail: 'Use a different email',
    nicknameHeading: 'Choose your name',
    nicknameIntro:
      'Visitors see this name next to your stories in the widget. They never see your email.',
    nickname: 'Name',
    finish: 'Continue',
    haveInvite: 'Have an invite code?',
    inviteHeading: 'Sign in with an invite code',
    inviteIntro: 'Type your email and the invite code that you got from the team of this site.',
    invite: 'Invite code',
    inviteHint: 'For example ABCD-EFGH.',
    redeem: 'Sign in',
    useEmail: 'Get a login code by email instead',
  },
  signInErrors: {
    'invalid-email': 'Type a full email, for example name@example.org.',
    'rate-limited': 'You asked for too many codes. Wait one hour, then try again.',
    'send-failed': 'We could not send the email. Try again in a few minutes.',
    'wrong-code': 'This code is not correct. Look at the newest email and try again.',
    'no-code': 'This code expired or was used. Send a new code.',
    'too-many-attempts': 'Too many wrong codes. Send a new code.',
    'nickname-required': 'Type a name.',
    'invalid-nickname': 'Use 1 to 40 characters. Do not use @.',
    'invite-wrong-code': 'This invite code is not correct. Look at the code again.',
    'invite-rate-limited': 'Too many wrong invite codes. Wait one hour, then try again.',
    expired: 'This invite code does not work now. Ask the team of this site for a new code.',
    'used-up':
      'This invite code was used by as many people as it allows. Ask the team for a new code.',
    'not-allowed': 'This site does not take invite codes now. Ask the team of this site.',
    'email-verified':
      'This email signs in with a login code by email. Select "Get a login code by email instead".',
    'email-verified-no-mail':
      'This email signs in with a login code by email, and this site cannot send mail now. Ask the team of this site.',
  },
  recordingLabel: 'Recording',
  listen: 'Listen to the recording',
  form: {
    intro:
      'A story is your note about one part of the recording, from Start to End. Set the times, then write what you remember or hear.',
    newHeading: 'Your story',
    /** The form heading of an own story: the page title already says "Change your story". */
    editHeading: 'Times and text',
    start: 'Start',
    end: 'End',
    timeHint: 'Drag on the waveform to mark the part, or type the times: for example 1:02, or 62 for seconds.',
    moment: (range: string) => `Your story is about ${range}.`,
    useTime: (time: string) => `Use current time (${time})`,
    useTimeLabel: (field: string, time: string) => `${field}: use the current time, ${time}`,
    sendsTo: {
      review: 'An operator reads it before visitors see it.',
      publish: 'Visitors see it in the widget at once.',
      again: 'An operator reads the changed story before visitors see it.',
    },
    text: 'Story',
    textHint: 'Plain text. What do you remember? What do you hear?',
    /** The button with the review rule `review`, and with `publish-at-once`. */
    send: 'Send for review',
    /** The button for a story that an operator returned. */
    sendAgain: 'Send again',
    publish: 'Publish the story',
    saving: 'Sending…',
    waitForUpload: 'Wait for the upload to finish.',
    newStory: 'Write a new story instead',
  },
  /** The questions of the project below the story (design/vocab.md §7.1). */
  questions: {
    heading: 'About this part',
    optional: '(optional)',
    more: (n: number) => `More questions (${n})`,
    year: 'Year',
    month: 'Month',
    day: 'Day',
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    noMonth: 'No month',
    noDay: 'No day',
    address: 'Web address',
    linkLabel: 'Name of the link (optional)',
    search: 'Search',
    noMatch: 'Nothing in the list has these words.',
    ownAnswer: (label: string) => `We send "${label}" as your own answer.`,
    notInList: 'Not in the list.',
    ownLabel: 'Not in the list? Type your own answer',
    remove: (label: string) => `Remove ${label}`,
    notAsked: 'This question is no longer asked. Your answer stays.',
    errors: {
      required: 'give an answer.',
      'too-many': (max: number) =>
        max === 1 ? 'give one answer only.' : `give ${max} answers at most.`,
      'unknown-field': 'this question is not asked now. Reload the page.',
      'hidden-field': 'this question is not asked now. Reload the page.',
      'unknown-item': 'this choice is not in the list now. Reload the page.',
      'hidden-item': 'this choice is not offered now. Choose a different one.',
      'own-not-allowed': 'choose from the list.',
      'bad-date': 'this date does not exist. Check the month and the day.',
      'bad-number': 'type a number, for example 25 or 2.5.',
      'bad-link': 'type a web address that starts with https://.',
      'too-long': 'make the answer shorter: 500 characters at most.',
    },
  },
  reply: {
    intro: 'A reply answers one story, not a part of the recording. Read the story, then write your answer.',
    parentHeading: 'The story',
    by: (nickname: string) => `By ${nickname}`,
    newHeading: 'Your reply',
    editHeading: 'Change your reply',
    text: 'Reply',
    textHint: 'Plain text. Answer the story, or tell what it makes you remember.',
    publish: 'Publish the reply',
    newStory: 'Write a story about the recording instead',
    parentGone: {
      heading: 'We cannot find this story',
      body: 'The story that you want to answer is not visible now. You can write a story about the recording.',
    },
  },
  saveErrors: {
    'unknown-instance': 'We cannot find this recording. Reload the page.',
    start: 'The start must be a time, for example 1:02.',
    end: 'The end must be after the start and inside the recording.',
    'no-body': 'Write your story.',
    'too-many-bodies': 'This story has too many parts.',
    'text-too-long': 'The story is too long. Make it shorter.',
    'unknown-media': 'An attached file is missing. Remove it and attach it again.',
    'media-failed': 'We could not use an attached file. Remove it and attach a different file.',
    'media-needs-text': 'Write a short text about your voice note, photo or video.',
    'values-invalid': 'Some answers below need a change.',
    'instance-changed': 'This story belongs to a different recording.',
    'not-owner': 'This story belongs to a different member.',
    stale: 'This story changed in a different window. Reload the page to see the newest version.',
    'reply-and-range': 'A reply has no time range. Reload the page and try again.',
    'reply-and-values': 'A reply has no answers to questions. Reload the page and try again.',
    'unknown-parent': 'The story that you answer is not visible now. Your reply is not sent.',
    'reply-depth': 'You cannot answer a reply. Answer the story.',
    'signed-out': 'Your session ended. Sign in again. Your text stays on this page.',
  },
  signInAgain: 'Sign in again',
  media: {
    heading: 'Voice note, photo or video',
    hint: 'Optional. Visitors see it with your text after the story is published.',
    record: 'Record a voice note',
    stop: 'Stop the voice note',
    recording: (seconds: number) => `Voice note: ${seconds} s`,
    attachRecording: 'Attach this voice note',
    recordAgain: 'Record again',
    discard: 'Do not use this voice note',
    noMicrophone:
      'We cannot use your microphone. Allow the microphone for this site, then try again.',
    pick: 'Attach a photo or a video',
    tooLarge: (megabytes: number) => `This file is too large. The limit is ${megabytes} MB.`,
    wrongType: 'Use a JPEG, PNG or WebP photo, or an MP4, WebM or QuickTime video.',
    kinds: { sound: 'Voice note', image: 'Photo', video: 'Video' },
    uploading: (percent: number) => `Uploading: ${percent} %`,
    uploaded: 'Processing. You can send the story now.',
    ready: 'Ready',
    failed: 'We could not use this file. Remove it and attach a different file.',
    uploadFailed: 'The upload stopped. Remove it and try again.',
    remove: 'Remove',
    preview: 'Your voice note',
  },
  /** One story of the member, as Your story and Your stories show it. */
  story: {
    heading: 'Your story',
    replyHeading: 'Your reply',
    sent: 'Sent.',
    published: 'Published.',
    states: {
      processing: 'Processing your file. You can leave this page.',
      waiting: 'Waiting for review. We send you a mail when it is published.',
      returned: 'Returned to you.',
      published: 'Published. Visitors see it in the widget on the site.',
      changeWaiting: 'Published. Your change is waiting for review.',
      changeProcessing: 'Published. Your change is processing.',
      changeReturned: 'Published. Your change is returned to you.',
    },
    reason: 'Reason:',
    returnedHint: 'Change the story, then send it for review again.',
    change: 'Change the story',
    changeReply: 'Change the reply',
    listen: 'Listen on the site',
    /** After the member changed a returned story: it waits again. */
    sentAgain: 'Sent again',
    /** The date of the last change, on each card: "Changed 9 Oct 2026, 14:05". */
    saved: 'Saved',
  },
  /** The done screen after a save with no return to the site (P5, workflow-audit 19). */
  done: {
    sent: 'Your story is sent',
    published: 'Your story is published',
    replySent: 'Your reply is sent',
    replyPublished: 'Your reply is published',
    notListed:
      'Your story will show on the site after review. This page could not send you back, because the site is not on the website list of this project.',
    notListedPublished:
      'Visitors see your story on the site within one minute. This page could not send you back, because the site is not on the website list of this project.',
    back: 'Back to the site',
    another: 'Tell another story',
    yours: 'Your stories',
  },
  mine: {
    title: 'Your stories',
    signIn: 'Sign in to see your stories',
    moment:
      'Each story is a note that you made on part of a recording, on any site of this organisation. Open a returned story to change it.',
    empty: 'You have no stories yet. On a site, select "Tell a story" in the widget.',
    groups: {
      returned: 'Returned to you',
      processing: 'Processing',
      waiting: 'Waiting for review',
      published: 'Published',
      replies: 'Replies',
    },
    count: (n: number) => `(${n})`,
    none: 'None.',
    noMail:
      'We do not send you mail, because you signed in with an invite code. Look here to see when a story is published or returned.',
  },
  account: {
    title: 'Your account',
    signIn: 'Sign in to see your account',
    moment: 'Your name shows next to each story that you tell. Change your name or your mail choice here.',
    email: 'Email',
    emailHint: 'Only this organisation sees it. To use a different email, sign in with it.',
    name: 'Name',
    nameHint: 'Visitors see this name next to your stories. New stories get the new name.',
    mail: 'Mail me when my story is published or gets a reply',
    unverified:
      'We do not send you mail yet: you signed in with an invite code, so we do not know that this email is yours.',
    verify: 'To get mail, sign out, then sign in once with a login code by email.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',
    signOut: 'Sign out',
    remove: (address: string) =>
      address
        ? `To delete your account and your stories, write to ${address}.`
        : 'To delete your account and your stories, write to the team of this site.',
    errors: {
      'invalid-nickname': 'Use 1 to 40 characters. Do not use @.',
      gone: 'Your session ended. Sign in again.',
    },
  },
  own: {
    heading: 'Your stories on this recording',
    none: 'You have no stories on this recording yet.',
    reply: (nickname: string | null) =>
      nickname ? `Reply to the story by ${nickname}` : 'Reply to a story that is not visible now',
  },
} as const

/** The short label of a lifecycle state, for a badge: a member never sees "draft". */
export function stateLabel(state: Lifecycle): string {
  switch (state.change) {
    case 'waiting':
      return 'Published · change waiting'
    case 'processing':
      return 'Published · change processing'
    case 'returned':
      return 'Published · change returned to you'
  }
  return {
    processing: 'Processing',
    waiting: 'Waiting for review',
    returned: 'Returned to you',
    published: 'Published',
  }[state.state]
}

/** The sentence of a lifecycle state, for the banner of Your story. */
export function stateSentence(state: Lifecycle): string {
  const s = strings.story.states
  switch (state.change) {
    case 'waiting':
      return s.changeWaiting
    case 'processing':
      return s.changeProcessing
    case 'returned':
      return s.changeReturned
  }
  return s[state.state]
}

/** The colour key of a lifecycle state (design/design-system.md §3.4): whose move it is. */
export function stateKey(state: Lifecycle): 'processing' | 'waiting' | 'returned' | 'published' {
  return state.change ?? state.state
}
