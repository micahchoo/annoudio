'use client'

// The media bodies of a story: a voice note from the microphone, or a photo or a video
// from a file. Each one goes up with tus (Uppy) to /media/upload, then the worker
// processes it. The form sends one hidden `media` field per attached body.
//
// Uppy without the Dashboard: the page needs one file button and one recorder, with the
// text of strings.ts. The Dashboard brings its own UI, text and CSS for features that
// this page does not use.

import Uppy from '@uppy/core'
import Tus from '@uppy/tus'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { mediaState } from './actions'
import { ErrorText } from './SignInForm'
import { strings } from './strings'

const s = strings.media
const MB = 1024 * 1024

export type MediaKind = 'sound' | 'image' | 'video'

/** A media body that the story already has. The page reads its state from `media`. */
export interface Attachment {
  kind: MediaKind
  id: string
  state: 'uploaded' | 'ready' | 'failed'
  url: string
}

interface Item {
  /** The Uppy file id while it uploads, else the media id. */
  key: string
  kind: MediaKind
  name: string
  id?: string
  state: 'uploading' | 'upload-failed' | Attachment['state']
  percent: number
  /** An object URL or the body URL, for a photo or a voice note. */
  preview?: string
}

interface Props {
  initial: Attachment[]
  /** The largest upload of each kind, in bytes. */
  limits: Record<MediaKind, number>
  /** The MIME types that the file button offers. */
  pickerTypes: string[]
  error: string | null
  /** True while an upload runs: the form must not save without its id. */
  onBusyChange(busy: boolean): void
}

/** The recorder formats, best first (research/architecture-concerns.md §3). */
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
}

export function MediaField({ initial, limits, pickerTypes, error, onBusyChange }: Props) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((a) => ({
      key: a.id,
      kind: a.kind,
      name: s.kinds[a.kind],
      id: a.id,
      state: a.state,
      percent: 100,
      preview: a.state === 'ready' && a.kind !== 'video' ? a.url : undefined,
    })),
  )
  const [notice, setNotice] = useState<string | null>(null)
  // The controls need JavaScript: false on the server and before hydration, then true.
  // Without JavaScript, the field keeps the bodies that the story has.
  const interactive = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const uppy = useRef<Uppy | null>(null)

  const update = (key: string, change: Partial<Item>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)))

  useEffect(() => {
    const instance = new Uppy({ autoProceed: true }).use(Tus, {
      endpoint: '/media/upload',
      chunkSize: 8 * MB,
      retryDelays: [0, 1000, 3000, 5000],
      // Uppy sends `type` and `name` also as `filetype` and `filename`, which the server reads.
      allowedMetaFields: ['kind', 'type', 'name'],
      removeFingerprintOnSuccess: true,
    })
    instance.on('upload-progress', (file, progress) => {
      if (!file || !progress.bytesTotal) return
      update(file.id, { percent: Math.floor((progress.bytesUploaded / progress.bytesTotal) * 100) })
    })
    instance.on('upload-success', (file, response) => {
      if (!file) return
      // The upload URL is /media/upload/<MediaId>.
      const id = response.uploadURL?.split('/').pop()
      update(file.id, id ? { id, state: 'uploaded', percent: 100 } : { state: 'upload-failed' })
      // Uppy refuses a file that it has. Remove it, so the member can attach it again.
      // Wait one task: during this event the tus plugin still holds the upload, and a
      // removal now would send a DELETE for the finished upload.
      setTimeout(() => instance.removeFile(file.id), 0)
    })
    instance.on('upload-error', (file) => {
      if (file) update(file.id, { state: 'upload-failed' })
    })
    uppy.current = instance
    return () => instance.destroy()
  }, [])

  const busy = items.some((item) => item.state === 'uploading')
  useEffect(() => onBusyChange(busy), [busy, onBusyChange])

  // Ask for the state of each processing body every 3 s.
  const pending = items.flatMap((item) => (item.state === 'uploaded' && item.id ? [item.id] : []))
  const pendingKey = pending.join(',')
  useEffect(() => {
    if (!pendingKey) return
    const ids = pendingKey.split(',')
    const timer = setInterval(async () => {
      for (const id of ids) {
        const state = await mediaState(id)
        if (state === 'ready' || state === 'failed') {
          setItems((list) =>
            list.map((item) =>
              item.id === id
                ? {
                    ...item,
                    state,
                    preview:
                      item.preview ??
                      (state === 'ready' && item.kind === 'image' ? `/media/${id}` : undefined),
                  }
                : item,
            ),
          )
        }
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [pendingKey])

  function attach(kind: MediaKind, blob: Blob, name: string, preview?: string) {
    setNotice(null)
    if (blob.size > limits[kind]) {
      setNotice(s.tooLarge(Math.floor(limits[kind] / MB)))
      return
    }
    let key: string
    try {
      key = uppy.current!.addFile({ name, type: blob.type, data: blob, meta: { kind } })
    } catch {
      setNotice(s.uploadFailed)
      return
    }
    setItems((list) => [...list, { key, kind, name, state: 'uploading', percent: 0, preview }])
  }

  function pick(file: File | undefined) {
    if (!file) return
    const kind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : null
    if (!kind || !pickerTypes.includes(file.type)) {
      setNotice(s.wrongType)
      return
    }
    attach(kind, file, file.name, kind === 'image' ? URL.createObjectURL(file) : undefined)
  }

  function remove(item: Item) {
    if (item.state === 'uploading') uppy.current?.removeFile(item.key)
    setItems((list) => list.filter((other) => other.key !== item.key))
  }

  return (
    <fieldset className="media" aria-describedby={error ? 'media-hint media-error' : 'media-hint'}>
      <legend>{s.heading}</legend>
      <p id="media-hint" className="hint">
        {s.hint}
      </p>
      {items.map((item) =>
        item.id && item.state !== 'upload-failed' ? (
          <input
            key={`field-${item.key}`}
            type="hidden"
            name="media"
            value={`${item.kind}:${item.id}`}
          />
        ) : null,
      )}
      {items.length > 0 && (
        <ul className="attachments">
          {items.map((item) => (
            <li key={item.key} data-media-state={item.state}>
              {item.preview && item.kind === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL; next/image cannot load it.
                <img src={item.preview} alt="" />
              )}
              {item.preview && item.kind === 'sound' && <audio controls src={item.preview} />}
              <span className="name">
                {s.kinds[item.kind]}: {item.name}
              </span>{' '}
              <span className="state" role="status">
                {stateText(item)}
              </span>
              {interactive && (
                <button type="button" onClick={() => remove(item)}>
                  {s.remove}
                  <span className="visually-hidden">: {item.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {interactive && (
        <>
          <Recorder
            onAttach={(blob, url) =>
              attach(
                'sound',
                blob,
                `voice-note.${EXTENSIONS[blob.type.split(';')[0]] ?? 'webm'}`,
                url,
              )
            }
            onError={setNotice}
          />
          <label className="pick">
            {s.pick}
            <input
              type="file"
              accept={pickerTypes.join(',')}
              onChange={(event) => {
                pick(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }}
            />
          </label>
        </>
      )}
      <ErrorText id="media-notice" text={notice} />
      <ErrorText id="media-error" text={error} />
    </fieldset>
  )
}

const noSubscription = () => () => {}

function stateText(item: Item): string {
  switch (item.state) {
    case 'uploading':
      return s.uploading(item.percent)
    case 'uploaded':
      return s.uploaded
    case 'ready':
      return s.ready
    case 'failed':
      return s.failed
    case 'upload-failed':
      return s.uploadFailed
  }
}

/** Record → stop → listen → attach or record again. */
function Recorder(props: { onAttach(blob: Blob, url: string): void; onError(text: string): void }) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [take, setTake] = useState<{ blob: Blob; url: string } | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    if (phase !== 'recording') return
    const started = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(timer)
  }, [phase])

  async function start() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      props.onError(s.noMicrophone)
      return
    }
    const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    const next = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    next.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunks, { type: next.mimeType || mimeType || 'audio/webm' })
      setTake({ blob, url: URL.createObjectURL(blob) })
      setPhase('recorded')
    }
    recorder.current = next
    next.start()
    setSeconds(0)
    setPhase('recording')
  }

  if (phase === 'recording') {
    return (
      <p className="recorder">
        <span role="status">{s.recording(seconds)}</span>{' '}
        <button type="button" onClick={() => recorder.current?.stop()}>
          {s.stop}
        </button>
      </p>
    )
  }
  if (phase === 'recorded' && take) {
    return (
      <div className="recorder">
        <p>{s.preview}</p>
        <audio controls src={take.url} />
        <p>
          <button
            type="button"
            onClick={() => {
              props.onAttach(take.blob, take.url)
              setTake(null)
              setPhase('idle')
            }}
          >
            {s.attachRecording}
          </button>{' '}
          <button type="button" onClick={start}>
            {s.recordAgain}
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(take.url)
              setTake(null)
              setPhase('idle')
            }}
          >
            {s.discard}
          </button>
        </p>
      </div>
    )
  }
  return (
    <p className="recorder">
      <button type="button" onClick={start}>
        {s.record}
      </button>
    </p>
  )
}
