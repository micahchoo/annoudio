// The sign-in mode of the member pages (Your stories, Your account). They have no project:
// invite codes always, login codes only when the stack can send mail
// (design/invite-codes.md). The Annotate page uses the mode of its project.

import { canMail } from '@payload-config'

import type { SignInMode } from '@/modules/projects'

export function memberPagesMode(): SignInMode {
  return canMail ? 'both' : 'invite-code'
}
