// The port to the mail service, and its two adapters: SMTP for a stack, memory for tests
// and for development without SMTP. A third adapter makes Payload's own mail (the
// operator password reset, M7) go through the memory mailer when there is no SMTP.

import nodemailer from 'nodemailer'
import type { EmailAdapter } from 'payload'

/** The mails of design/ia.md §2.3. Tests and logs find a mail by its kind. */
export type MailKind =
  | 'login-code' // M1
  | 'returned' // M2
  | 'published' // M3
  | 'replied' // M4
  | 'removed' // M5
  | 'review' // M6
  | 'password-reset' // M7

/** One mail: plain text, and the same text as simple HTML. */
export interface MailMessage {
  kind: MailKind
  to: string
  subject: string
  text: string
  html: string
  /** The sender name: the project name in a member mail, "Annoudio" in an operator mail. */
  fromName: string
}

/** The port to the mail service. */
export interface Mailer {
  /** Throws if the mail service does not accept the message. */
  send(message: MailMessage): Promise<void>
}

export interface MemoryMailer extends Mailer {
  readonly messages: readonly MailMessage[]
  /** The newest message to this email, or undefined. */
  lastTo(email: string): MailMessage | undefined
}

/** The address in an EMAIL_FROM value: `stories@example.org` or `Name <stories@example.org>`. */
export function addressOf(from: string): string {
  return /<([^>]+)>/.exec(from)?.[1]?.trim() ?? from.trim()
}

/**
 * Sends mail through an SMTP server. `url` is a nodemailer connection URL, for example
 * `smtps://user:password@smtp.example.org:465`. `from` is EMAIL_FROM; each message gives
 * the sender name.
 */
export function smtpMailer(options: { url: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(options.url)
  const address = addressOf(options.from)
  return {
    async send({ to, subject, text, html, fromName }) {
      await transport.sendMail({ from: { name: fromName, address }, to, subject, text, html })
    },
  }
}

/**
 * Keeps each message in memory. Tests read the mails from it. With `echo`, it also writes
 * each message to the console, for development without SMTP.
 */
export function memoryMailer(options: { echo?: boolean } = {}): MemoryMailer {
  const messages: MailMessage[] = []
  return {
    messages,
    async send(message) {
      messages.push(message)
      if (options.echo) console.info(`[mail to ${message.to}] ${message.subject}\n${message.text}`)
    },
    lastTo(email) {
      const to = email.trim().toLowerCase()
      return [...messages].reverse().find((message) => message.to === to)
    },
  }
}

/**
 * Payload's mail (the password reset of an operator, M7) through a `Mailer`, for a stack
 * without SMTP. With SMTP, `payload.config.ts` uses `@payloadcms/email-nodemailer`.
 */
export function mailerEmailAdapter(mailer: Mailer, from: string): EmailAdapter {
  return () => ({
    name: 'annoudio-mailer',
    defaultFromAddress: addressOf(from) || 'annoudio@localhost',
    defaultFromName: 'Annoudio',
    async sendEmail(message) {
      const html = typeof message.html === 'string' ? message.html : ''
      await mailer.send({
        kind: 'password-reset',
        to: String(message.to),
        subject: String(message.subject ?? ''),
        html,
        text: html.replace(/<[^>]+>/g, ''),
        fromName: 'Annoudio',
      })
    },
  })
}
