import type { Access, CollectionConfig } from 'payload'

import { checkNickname } from './rules'

export const MEMBERS = 'members'
export const SESSIONS = 'member-sessions'
export const CODES = 'login-codes'
export const INVITES = 'invite-codes'
export const INVITE_USES = 'invite-uses'
export const INVITE_TRIES = 'invite-tries'

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
      components: { beforeListTable: ['/admin/ListEmpty#MembersEmpty'] },
    defaultColumns: ['nickname', 'email', 'status', 'test', 'createdAt'],
    description:
      'A member is a person who tells stories about your recordings, and visitors see the member\'s name on each story. Open a member to see their stories or to block them.',
  },
  access: { read: operator, update: operator, create: nobody, delete: nobody },
  fields: [
    {
      // The member's stories by state and invite codes (admin/members/MemberPanel.tsx).
      name: 'memberPanel',
      type: 'ui',
      admin: { components: { Field: '/admin/members/MemberPanel#MemberPanel' } },
    },
    // Trimmed and in lower case. Visitors never see it.
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'The member signs in with it. Visitors never see it.',
      },
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
      admin: {
        description: 'A blocked member cannot sign in or tell stories. Their published stories stay.',
        components: { Field: '/admin/ui/SelectField#SelectField' },
      },
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Blocked', value: 'blocked' },
      ],
    },
    {
      // True after a login code: the member owns the email. An invite code proves no
      // email, so such a member gets no mail (design/invite-codes.md).
      name: 'emailVerified',
      label: 'Email checked',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          'Checked after a login code. A member who signed in only with an invite code gets no mail.',
      },
    },
    {
      // True for a member that an operator made to try the member steps: the sign-in came
      // from a browser with an operator session (the preview page, "Try it"). Counts of
      // members leave it out; the admin shows a "Test" badge.
      name: 'test',
      label: 'Test member (made by an operator)',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        readOnly: true,
        description:
          'An operator made this member to try the member steps. Member counts leave it out.',
        components: { Cell: '/admin/members/TestCell#TestCell' },
      },
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

/**
 * One row per invite code (design/invite-codes.md). Holds the HMAC of the code and its
 * first 2 characters, never the code. `project` is the project slug, as in `stories`.
 */
export const inviteCodesCollection: CollectionConfig = {
  slug: INVITES,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'project', type: 'text', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true, unique: true, index: true },
    { name: 'hint', type: 'text', required: true },
    { name: 'label', type: 'text' },
    { name: 'uses', type: 'number', required: true, defaultValue: 1 },
    { name: 'expiresAt', type: 'date' },
    { name: 'revokedAt', type: 'date' },
  ],
}

/** One row per member who used an invite code. A member uses one code only once. */
export const inviteUsesCollection: CollectionConfig = {
  slug: INVITE_USES,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'invite', type: 'relationship', relationTo: INVITES, required: true, index: true },
    { name: 'member', type: 'relationship', relationTo: MEMBERS, required: true, index: true },
  ],
}

/**
 * One row per failed try of an invite code, for the rate limit. Holds the HMAC of the IP
 * address, never the address. Rows live for about one hour.
 */
export const inviteTriesCollection: CollectionConfig = {
  slug: INVITE_TRIES,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'email', type: 'text', required: true, index: true },
    { name: 'ipHash', type: 'text', index: true },
    { name: 'triedAt', type: 'date', required: true, index: true },
  ],
}
