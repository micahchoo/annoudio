// The `return` check of the Annotate page (open-redirect rule). Pure; no database.

import { describe, expect, it } from 'vitest'

import { returnTarget } from '@/modules/projects'

const project = { siteOrigins: ['https://www.example.org', 'http://localhost:8080'] }

describe('returnTarget', () => {
  it('keeps a URL on a listed origin and removes its fragment', () => {
    expect(returnTarget(project, 'https://www.example.org/ferry?a=1#old')).toBe(
      'https://www.example.org/ferry?a=1',
    )
    expect(returnTarget(project, 'http://localhost:8080/')).toBe('http://localhost:8080/')
  })

  it.each([
    ['an unlisted origin', 'https://evil.example/'],
    ['a listed host on another scheme', 'http://www.example.org/'],
    ['a listed host on another port', 'https://www.example.org:444/'],
    ['a look-alike host', 'https://www.example.org.evil.example/'],
    ['credentials in the URL', 'https://user@www.example.org/'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative URL', '//www.example.org/'],
    ['no value', null],
    ['an empty value', ''],
  ])('drops %s', (_name, value) => {
    expect(returnTarget(project, value)).toBeNull()
  })

  it('keeps the preview page of the stack itself, and nothing else of the stack', () => {
    const self = { self: 'https://org.example' }
    expect(returnTarget(project, 'https://org.example/admin/preview/river-voices/1#x', self)).toBe(
      'https://org.example/admin/preview/river-voices/1',
    )
    expect(returnTarget(project, 'https://org.example/admin/collections/users', self)).toBeNull()
    expect(returnTarget(project, 'https://org.example/admin/preview/river-voices/1')).toBeNull()
    expect(returnTarget(project, 'https://www.example.org/x', self)).toBe('https://www.example.org/x')
  })

  it('drops every URL when the project lists no origin', () => {
    expect(returnTarget({ siteOrigins: [] }, 'https://www.example.org/')).toBeNull()
  })
})
