import { Check, Mic, Square } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '../../shared/types.ts'
import { useAudioTranscription } from '../hooks/useAudioTranscription.ts'
import { useSegmentHandoff } from '../hooks/useSegmentHandoff.ts'
import './segment-demo.css'

const emptySegments: TranscriptSegment[] = []

function formatTimestamp(timestampMs: number) {
  const seconds = Math.floor(timestampMs / 1000)
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const remainder = String(seconds % 60).padStart(2, '0')
  const tenths = Math.floor((timestampMs % 1000) / 100)
  return `${minutes}:${remainder}.${tenths}`
}

export function SegmentDemo({ initialInterviewId }: { initialInterviewId?: string }) {
  const handoff = useSegmentHandoff(initialInterviewId)
  const recording = useAudioTranscription(handoff.interviewId)
  const [recordedInterview, setRecordedInterview] = useState<string>()
  const viewport = useRef<HTMLOListElement>(null)
  const followLatest = useRef(true)
  const segments = recordedInterview === handoff.interviewId ? recording.segments : emptySegments
  const microphoneActive = recording.status === 'connecting' || recording.status === 'recording'
  const finishing = recording.status === 'stopping'
  const preparing = handoff.status === 'preparing'
  const needsInterview = !handoff.interviewId || handoff.status === 'error'
  const connected = handoff.status === 'connected'
  const connectionLabel = {
    idle: 'Session needed',
    preparing: 'Preparing session',
    connecting: 'Connecting',
    connected: 'Ready',
    reconnecting: 'Reconnecting',
    error: 'Session unavailable',
  }[handoff.status]
  const buttonLabel = {
    idle: 'Start recording',
    connecting: 'Cancel recording',
    recording: 'Stop recording',
    stopping: 'Finishing…',
    error: 'Retry recording',
  }[recording.status]
  const shouldPrepare = !microphoneActive && !finishing && needsInterview

  useEffect(() => {
    const list = viewport.current
    if (list && followLatest.current) list.scrollTop = list.scrollHeight
  }, [segments])

  function handleAction() {
    if (microphoneActive) {
      void recording.stop()
    } else if (shouldPrepare) {
      void handoff.prepare()
    } else if (connected && handoff.interviewId) {
      followLatest.current = true
      setRecordedInterview(handoff.interviewId)
      recording.start()
    }
  }

  return (
    <main className="segment-demo">
      <div className="segment-demo__workspace">
        <header className="segment-demo__heading">
          <div>
            <a className="segment-demo__brand" href="/">Crosscheck</a>
            <h1>Live segments</h1>
            <p>Speak a phrase, pause briefly, then speak again. Each finished phrase appears in its own segment.</p>
          </div>
          <span className="segment-demo__connection" data-connected={connected} role="status">
            <span aria-hidden="true" />
            {connectionLabel}
          </span>
        </header>

        <section className="segment-demo__transcript" aria-labelledby="segment-demo-transcript-title">
          <header className="segment-demo__transcript-header">
            <h2 id="segment-demo-transcript-title">Transcript</h2>
            <span>{segments.filter((segment) => segment.isFinal).length} finalized</span>
          </header>
          {segments.length ? (
            <ol
              className="segment-demo__segments"
              aria-label="Transcript segments"
              tabIndex={0}
              ref={viewport}
              onScroll={({ currentTarget }) => {
                followLatest.current = currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight < 48
              }}
            >
              {segments.map(({ id, text, isFinal, timestampMs }, segmentIndex) => {
                const received = isFinal && handoff.acknowledgedSegmentIds.has(id)
                return (
                  <li key={id} className="segment-demo__segment" data-final={isFinal}>
                    <div className="segment-demo__segment-header">
                      <span>
                        Segment {segmentIndex + 1}
                        <time dateTime={`PT${timestampMs / 1000}S`}>{formatTimestamp(timestampMs)}</time>
                      </span>
                      <span data-received={received}>
                        {received && <Check size={14} aria-hidden="true" />}
                        {received ? 'Received' : isFinal ? 'Awaiting receipt' : 'Partial'}
                      </span>
                    </div>
                    <p>
                      {text.match(/\S+/gu)?.map((word, index) => (
                        <Fragment key={index}>
                          <span className="segment-demo__word">{word}</span>{' '}
                        </Fragment>
                      ))}
                    </p>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="segment-demo__empty">
              {recording.status === 'recording' ? 'Listening for speech…' : 'Your transcript will appear here.'}
            </p>
          )}
        </section>

        <footer className="segment-demo__controls">
          <button
            type="button"
            onClick={handleAction}
            disabled={preparing || finishing || (!microphoneActive && !shouldPrepare && !connected)}
          >
            {microphoneActive || finishing ? <Square size={17} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            {preparing ? 'Preparing…' : shouldPrepare ? 'Prepare demo' : buttonLabel}
          </button>
          {recording.status === 'recording' && <span role="status">Microphone on</span>}
          {finishing && <span role="status">Waiting for the last segment</span>}
          {(handoff.error || recording.error) && <p role="alert">{recording.error || handoff.error}</p>}
        </footer>

        <details className="segment-demo__notes">
          <summary>Testing page · Integration notes</summary>
          <ol>
            <li>Create an interview with <code>POST /api/interviews</code> and keep its ID.</li>
            <li>
              Pass that ID to <code>useAudioTranscription(interviewId)</code>. Its WebSocket streams partial text
              to the frontend and gives each speech turn a stable segment ID.
            </li>
            <li>
              After a pause, OpenAI finalizes the turn. Express forwards the segment with <code>isFinal: true</code>
              {' '}to the interview queue through <code>onFinalSegment</code>. To submit text from another source,
              send <code>{'{ interviewId, segment }'}</code> to <code>POST /api/transcript</code>.
            </li>
            <li>
              Subscribe to <code>GET /api/interviews/:id/events</code>. A segment is <strong>Received</strong>
              {' '}when a snapshot contains its final ID.
            </li>
          </ol>
        </details>
      </div>
    </main>
  )
}
