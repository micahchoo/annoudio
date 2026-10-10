// The interface of the `membership` module. Callers import only from this file.
// Design: design/membership-interface.md.
//
// Ordering constraints:
// - Add the six collections to `payload.config.ts`.
// - Call `createMembership` once per process, in `payload.config.ts`.

export { createMembership } from './create'
export {
  inviteCodesCollection,
  inviteTriesCollection,
  inviteUsesCollection,
  loginCodesCollection,
  memberSessionsCollection,
  membersCollection,
} from './collections'
export type {
  Account,
  Contact,
  Invite,
  Invites,
  MakeInvites,
  HasHeaders,
  MemberSession,
  Membership,
  MembershipConfig,
  RedeemInviteError,
  RedeemInviteOptions,
  RedeemInviteResult,
  RequestCodeOptions,
  SignInOptions,
  RequestCodeResult,
  SessionCookie,
  SignInMode,
  VerifyCodeError,
  VerifyCodeResult,
} from './types'
