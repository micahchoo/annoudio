// The states that the form actions give back to the forms.

import type { strings } from './strings'

export type SignInState = {
  step: 'email' | 'code' | 'nickname' | 'invite'
  email: string
  /** The nickname step after an invite code: the code is an invite code. */
  via?: 'invite'
  /** Kept for the nickname step: a correct code (login or invite) stays usable until the name is set. */
  code?: string
  error?: keyof typeof strings.signInErrors
}

export type SaveState = {
  /**
   * The values that the member sent. The form shows them again after an error. `media`
   * holds one `<kind>:<MediaId>` per attached media body. `answers` holds the form entries
   * of the questions, as sent (`FieldControls` names them).
   */
  values?: {
    start: string
    end: string
    text: string
    media: string[]
    answers: [string, string][]
  }
  error?: {
    field: 'start' | 'end' | 'text' | 'media' | 'values' | 'form'
    code: keyof typeof strings.saveErrors
  }
  /** One code per question that `vocabulary.resolve` refused. */
  valueErrors?: { property: string; code: keyof typeof strings.questions.errors }[]
}
