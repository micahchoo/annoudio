'use client'

// **Add this website** (workflow-audit 7): the website of the page where the member told
// the story goes on the website list of the project.

import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { strings } from '../strings'
import { Icon } from '../ui/Icon'

import { addWebsite } from './actions'

const s = strings.review

export function AddWebsite({ project, page }: { project: string; page: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <button
      type="button"
      className="ao-btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await addWebsite(project, page)
          if (!result.ok) return void toast.error(s.failed)
          toast.success(s.addedWebsite(result.host))
          router.refresh()
        })
      }
    >
      <Icon name="add" />
      {s.addWebsite}
    </button>
  )
}
