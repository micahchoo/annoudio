// Your account (P8, design/ia.md §4.2): the email (read only), the name, the mail choice,
// Sign out. Deleting an account is a mail to the team (§11, open question 1).

import { membership } from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { addressOf } from '@/modules/mail'

import { signOut } from '../actions'
import { Frame } from '../Frame'
import { SignInForm } from '../SignInForm'
import { strings } from '../strings'
import { AccountForm } from './AccountForm'
import '../annotate.css'

export const metadata: Metadata = { title: strings.account.title, robots: { index: false } }

const s = strings.account

export default async function YourAccount() {
  const session = await membership.sessionFromRequest({ headers: await headers() })
  const account = session ? await membership.account(session) : null
  const back = { href: '/annotate/mine', label: strings.menu.stories }
  return (
    <Frame title={s.title} project={null} back={back} session={session} after="/annotate/account">
      {!session || !account ? (
        <SignInForm link={null} next="/annotate/account" heading={s.signIn} moment={s.moment} />
      ) : (
        <>
          <AccountForm
            email={account.email}
            nickname={account.nickname}
            mailNotices={account.mailNotices}
          />
          <form action={signOut} className="sign-out">
            <input type="hidden" name="after" value="/annotate/account" />
            <button type="submit">{s.signOut}</button>
          </form>
          <p className="hint">{s.remove(addressOf(process.env.EMAIL_FROM || ''))}</p>
        </>
      )}
    </Frame>
  )
}
