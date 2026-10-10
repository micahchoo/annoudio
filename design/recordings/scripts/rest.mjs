// The demo stack's REST API, as the operator: setup and clean-up that the videos do not show.

import { APP, OPERATOR } from './lib.mjs'

let token
async function auth() {
  if (token) return token
  const res = await fetch(`${APP}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(OPERATOR),
  })
  token = (await res.json()).token
  return token
}

export async function api(path, init = {}) {
  const res = await fetch(`${APP}/api/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `JWT ${await auth()}`, ...init.headers },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

export const projectTokens = async () => (await api('projects/1?depth=0')).themeTokens

export async function setProjectTokens(themeTokens) {
  await api('projects/1', { method: 'PATCH', body: JSON.stringify({ themeTokens }) })
}

export const project = () => api('projects/1?depth=0')

export async function setSiteOrigins(siteOrigins) {
  await api('projects/1', { method: 'PATCH', body: JSON.stringify({ siteOrigins }) })
}

/** The stories (newest version, drafts too) of the demo recording. */
export async function stories(where = '') {
  return (await api(`stories?limit=100&depth=0&draft=true&sort=-createdAt${where}`)).docs
}
