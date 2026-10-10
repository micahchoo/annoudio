// The top of the sign-in screen (O1, design/concept-map.md §2.1): what Annoudio keeps, and
// what to type. Payload's own words say "Sign in" and "Forgot your password?"
// (payload.config.ts, i18n).

import { strings } from './strings'

const s = strings.login

export function LoginIntro() {
  return (
    <div className="ao annoudio-login">
      <h1 className="ao-header__title">{s.heading}</h1>
      <p className="ao-header__help">{s.help}</p>
    </div>
  )
}
