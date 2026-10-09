// The input rules of the module. Pure functions.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The stored form of an email: trimmed and in lower case. Null if it is not an email. */
export function normaliseEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

/** The stored form of a nickname: trimmed, 1 to 40 characters, no `@`. Null if not valid. */
export function checkNickname(value: string): string | null {
  const nickname = value.trim()
  const length = [...nickname].length
  return length >= 1 && length <= 40 && !nickname.includes('@') ? nickname : null
}
