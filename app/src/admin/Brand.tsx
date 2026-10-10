// The name of the stack in place of Payload's graphics (Payload 3.90
// `admin.components.graphics`): `Logo` on the sign-in screen, `Icon` at the top of every
// admin page. The name is ANNOUDIO_NAME (for example "River Voices archive"), else
// "Annoudio" (recordings audit, 01: the first screen named another product).

import { Icon as Glyph } from './ui/Icon'

const name = () => process.env.ANNOUDIO_NAME?.trim() || 'Annoudio'

export function Logo() {
  return (
    <span className="ao annoudio-brand">
      <Glyph name="recording" />
      <span className="annoudio-brand__name">{name()}</span>
    </span>
  )
}

export function Icon() {
  return (
    <span className="ao annoudio-brand annoudio-brand--icon" title={name()}>
      <Glyph name="recording" label={name()} />
    </span>
  )
}
