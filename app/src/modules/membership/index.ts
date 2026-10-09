// The interface of the `membership` module. Callers import only from this file.
// Design: design/membership-interface.md.
//
// Ordering constraints:
// - Add the three collections to `payload.config.ts`.
// - Call `createMembership` once per process, in `payload.config.ts`.

export { createMembership } from './create'
export { loginCodesCollection, memberSessionsCollection, membersCollection } from './collections'
export type {
  Contact,
  HasHeaders,
  MemberSession,
  Membership,
  MembershipConfig,
  RequestCodeOptions,
  RequestCodeResult,
  SessionCookie,
  VerifyCodeError,
  VerifyCodeResult,
} from './types'
