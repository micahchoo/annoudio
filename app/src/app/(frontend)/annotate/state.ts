// The states that the form actions give back to the forms.

import type { strings } from './strings'

export type SignInState = {
  step: 'email' | 'code' | 'nickname'
  email: string
  /** Kept for the nickname step: a correct code stays usable until the name is set. */
  code?: string
  error?: keyof typeof strings.signInErrors
}

export type SaveState = {
  /** The values that the member sent. The form shows them again after an error. */
  /** `media` holds one `<kind>:<MediaId>` per attached media body. */
  values?: { start: string; end: string; text: string; tags: string[]; media: string[] }
  error?: {
    field: 'start' | 'end' | 'text' | 'tags' | 'media' | 'form'
    code: keyof typeof strings.saveErrors
  }
}
