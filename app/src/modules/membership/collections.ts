import type { Access, CollectionConfig } from 'payload'

import { checkNickname } from './rules'

export const MEMBERS = 'members'
export const SESSIONS = 'member-sessions'
export const CODES = 'login-codes'

const nobody = () => false
const operator: Access = ({ req }) => req.user?.collection === 'users'

/**
 * Members: community people who tell stories. Operators see the list, can change a
 * nickname and can block a member. Only the login flow creates members. This is not
 * a Payload auth collection, so a member is never `req.user`
 * (design/membership-interface.md).
 */
export const membersCollection: CollectionConfig = {
  slug: MEMBERS,
  labels: { singular: 'Member', plural: 'Members' },
  admin: {
    // The sidebar link Members comes from `admin/NavLinks.tsx`.
    group: false,
    hideAPIURL: true,
    useAsTitle: 'nickname',
    defaultColumns: ['nickname', 'email', 'status', 'createdAt'],
    description:
      'People who sign in with a login code to tell stories. Block a member to stop new stories.',
  },
  access: { read: operator, update: operator, create: nobody, delete: nobody },
  fields: [
    // Trimmed and in lower case. Visitors never see it.
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Visitors never see it.' },
    },
    {
      // The only name that visitors see.
      name: 'nickname',
      label: 'Name',
      type: 'text',
      admin: { description: 'The name that visitors see next to the stories of this member.' },
      required: true,
      validate: (value: unknown) =>
        (typeof value === 'string' && checkNickname(value) !== null) ||
        'Use 1 to 40 characters and no @.',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      admin: { description: 'A blocked member cannot sign in or save stories.' },
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Blocked', value: 'blocked' },
      ],
    },
    {
      // The member's choice on Your account. M3 and M4 only; mails that ask for an action
      // (M2, M5) always go.
      name: 'mailNotices',
      label: 'Mail when a story is published or gets a reply',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'The member sets this on Your account.' },
    },
  ],
}

/** One row per signed-in browser. Holds the SHA-256 of the cookie token. */
export const memberSessionsCollection: CollectionConfig = {
  slug: SESSIONS,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'member', type: 'relationship', relationTo: MEMBERS, required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
  ],
}

/**
 * One row per requested login code. Holds the HMAC of the code, never the code, and
 * the HMAC of the IP address, never the address. Rows live for about one hour.
 */
export const loginCodesCollection: CollectionConfig = {
  slug: CODES,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'email', type: 'text', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    // HMAC of the IP address of the request, for the per-IP limit. Null without an address.
    { name: 'ipHash', type: 'text', index: true },
    { name: 'requestedAt', type: 'date', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'usedAt', type: 'date' },
  ],
}
