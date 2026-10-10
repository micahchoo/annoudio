import type { CollectionConfig, Payload } from 'payload'

import { mails } from '@/modules/mail'

const RESET_HOURS = 1

// Operators: team members who sign in to the admin. The slug stays `users` (Payload's
// default, and the value of `req.user.collection` that every access check reads).
// Members are a different collection and never sign in here.
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Operator', plural: 'Operators' },
  admin: {
    group: 'Settings',
    useAsTitle: 'email',
    defaultColumns: ['email', 'createdAt'],
    description:
      'An operator decides which stories about your recordings visitors see. Select "Create new" to give a colleague access.',
    hideAPIURL: true,
      components: { beforeListTable: ['/admin/ListEmpty#OperatorsEmpty'] },
  },
  auth: {
    // M7 (design/ia.md §2.3). The link goes to the admin of this stack.
    forgotPassword: {
      expiration: RESET_HOURS * 60 * 60 * 1000,
      generateEmailSubject: () => mails.passwordReset({ link: '', hours: RESET_HOURS }).subject,
      generateEmailHTML: (args) =>
        mails.passwordReset({
          link: `${process.env.ANNOUDIO_ORIGIN || ''}/admin/reset/${args?.token ?? ''}`,
          hours: RESET_HOURS,
        }).html,
    },
  },
  fields: [
    {
      // History names the operator: "Published by Ravi". Members never see it.
      name: 'name',
      label: 'Name',
      type: 'text',
      admin: {
        description: 'Other operators see it in the history of a story. Members never see it.',
      },
    },
    {
      name: 'reviewMail',
      label: 'Review mail',
      type: 'radio',
      defaultValue: 'daily',
      options: [
        { label: 'Once a day, at 08:00, when stories wait', value: 'daily' },
        { label: 'For each story that a member sends', value: 'each' },
        { label: 'Never', value: 'never' },
      ],
      admin: {
        description: 'How often a mail tells you that stories wait for review.',
        components: { Field: '/admin/ui/SelectField#SelectField' },
      },
    },
    // The setup checklist of Today: "I pasted it" (step 3) and "Hide the list".
    { name: 'snippetPasted', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
    { name: 'checklistHidden', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
  ],
}

/** The emails of the operators with this review mail choice. An empty choice is `daily`. */
export async function operatorsByReviewMail(
  payload: Payload,
  choice: 'daily' | 'each',
): Promise<string[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where:
      choice === 'daily'
        ? { or: [{ reviewMail: { equals: 'daily' } }, { reviewMail: { exists: false } }] }
        : { reviewMail: { equals: 'each' } },
    pagination: false,
    depth: 0,
    select: { email: true },
  })
  return docs.map((doc) => doc.email)
}
