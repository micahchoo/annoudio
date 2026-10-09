import { strings } from './strings'
import './annotate.css'

/** The page for an Annotate link without a known project and recording (P0). */
export default function AnnotateNotFound() {
  return (
    <div className="annotate">
      <main>
        <h1>{strings.unknown.heading}</h1>
        <p>{strings.unknown.body}</p>
        <p>
          <a href="/annotate/mine">{strings.menu.stories}</a>
        </p>
      </main>
    </div>
  )
}
