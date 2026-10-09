// All text of the Annotate page, Your stories and Your account. English only for now. To
// add a language, add an object with the same keys and choose it by the request language.
// Words: CONTEXT.md and design/ia.md §7 (Story, Reply, Topic, Send for review, Returned).

import type { Lifecycle } from '@/modules/stories'

export const strings = {
  title: 'Tell a story',
  replyTitle: 'Reply to a story',
  unknown: {
    heading: 'We cannot find this recording',
    body: 'The link does not point to a recording that this site knows. Go back to the page you came from and try the link again.',
  },
  back: 'Back to the site',
  menu: {
    label: (nickname: string) => `${nickname}: your menu`,
    stories: 'Your stories',
    account: 'Your account',
    signOut: 'Sign out',
  },
  rights: 'Stories here:',
  signIn: {
    heading: 'Sign in to tell a story',
    replyHeading: 'Sign in to reply',
    moment: (time: string) => `You tell a story about ${time} of the recording.`,
    replyMoment: (nickname: string) => `You reply to the story by ${nickname}.`,
    intro: 'We send a login code to your email. You do not need a password.',
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
      'People who listen see this name next to your stories. They never see your email.',
    nickname: 'Name',
    finish: 'Continue',
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
  },
  player: 'Recording',
  listen: 'Listen to the recording',
  form: {
    newHeading: 'Your story',
    editHeading: 'Change your story',
    start: 'Start',
    end: 'End',
    timeHint: 'For example 1:02, or 62 for seconds.',
    setFromPlayer: 'Use the player time',
    text: 'Story',
    textHint: 'Plain text. What do you remember? What do you hear?',
    tags: 'Topics',
    noTags: 'This project has no topics yet.',
    /** The button with the review rule `review`, and with `publish-at-once`. */
    send: 'Send for review',
    publish: 'Publish the story',
    saving: 'Sending…',
    waitForUpload: 'Wait for the upload to finish.',
    newStory: 'Write a new story instead',
  },
  reply: {
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
    'too-many-tags': 'Choose fewer topics.',
    'text-too-long': 'The story is too long. Make it shorter.',
    'unknown-media': 'An attached file is missing. Remove it and attach it again.',
    'media-failed': 'We could not use an attached file. Remove it and attach a different file.',
    'media-needs-text': 'Write a short text about your voice note, photo or video.',
    'unknown-concept': 'A topic does not exist now. Reload the page.',
    'instance-changed': 'This story belongs to a different recording.',
    'not-owner': 'This story belongs to a different member.',
    stale: 'This story changed in a different window. Reload the page to see the newest version.',
    'reply-and-range': 'A reply has no time range. Reload the page and try again.',
    'reply-and-tags': 'A reply has no topics. Reload the page and try again.',
    'unknown-parent': 'The story that you answer is not visible now. Your reply is not sent.',
    'reply-depth': 'You cannot answer a reply. Answer the story.',
    'signed-out': 'Your session ended. Sign in again. Your text stays on this page.',
  },
  signInAgain: 'Sign in again',
  media: {
    heading: 'Voice note, photo or video',
    hint: 'Optional. It shows in the player after review and processing. Write a short text too.',
    record: 'Record a voice note',
    stop: 'Stop the recording',
    recording: (seconds: number) => `Recording: ${seconds} s`,
    attachRecording: 'Attach this voice note',
    recordAgain: 'Record again',
    discard: 'Do not use this recording',
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
    preview: 'Your recording',
  },
  /** One story of the member, as Your story and Your stories show it. */
  story: {
    heading: 'Your story',
    replyHeading: 'Your reply',
    sent: 'Sent.',
    published: 'Published.',
    states: {
      processing: 'Processing your file. You can leave this page.',
      waiting: 'Waits for review. We send you a mail when it is published.',
      returned: 'Returned to you.',
      published: 'Published. Visitors see it in the player.',
      changeWaiting: 'Published. Your change waits for review.',
      changeProcessing: 'Published. Your change is processing.',
      changeReturned: 'Published. Your change is returned to you.',
    },
    reason: 'Reason:',
    returnedHint: 'Change the story, then send it for review again.',
    change: 'Change the story',
    changeReply: 'Change the reply',
    listen: 'Listen on the site',
  },
  mine: {
    title: 'Your stories',
    signIn: 'Sign in to see your stories',
    moment: 'Your stories and replies on all sites of this organisation.',
    empty: 'You have no stories yet. On a site, select "Tell a story".',
    groups: {
      returned: 'Returned to you',
      processing: 'Processing',
      waiting: 'Waiting for review',
      published: 'Published',
      replies: 'Replies',
    },
    count: (n: number) => `(${n})`,
    none: 'None.',
  },
  account: {
    title: 'Your account',
    signIn: 'Sign in to see your account',
    moment: 'Your name and your mail choice.',
    email: 'Email',
    emailHint: 'Only this organisation sees it. To use a different email, sign in with it.',
    name: 'Name',
    nameHint: 'People who listen see this name next to your stories. New stories get the new name.',
    mail: 'Mail me when my story is published or gets a reply',
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
      return 'Published · change waits for review'
    case 'processing':
      return 'Published · change processing'
    case 'returned':
      return 'Published · change returned to you'
  }
  return {
    processing: 'Processing',
    waiting: 'Waits for review',
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
