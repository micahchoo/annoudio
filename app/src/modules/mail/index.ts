// The interface of the `mail` module. Callers import only from this file.
//
// The module holds the port to the mail service (`Mailer`, two adapters: SMTP and
// memory), all mail text (M1 to M7 of design/ia.md §2.3, in `mails.ts`), and the
// notices that follow a change to a story. Mails go after the commit; a failed send goes
// to the log and does not undo the change.
//
// Ordering constraint: `payload.config.ts` makes one mailer per process and gives it to
// `membership` (M1), to `createNotices` (M2 to M5) and to Payload (M7).

export {
  addressOf,
  mailerEmailAdapter,
  memoryMailer,
  smtpMailer,
  type MailKind,
  type MailMessage,
  type Mailer,
  type MemoryMailer,
} from './mailer'
export { mails, type Mail, type StoryLine } from './mails'
export { createNotices, type Contact, type Notices, type NoticesConfig } from './notices'
