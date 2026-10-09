import { redirect } from 'next/navigation'

// The root of the stack has no page of its own: the member home is Your stories.
export default function Home(): never {
  redirect('/annotate/mine')
}
