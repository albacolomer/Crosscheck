import { Fragment, useEffect, useRef } from 'react'
import { Mic, Square } from 'lucide-react'
import { useAudioTranscription } from '../hooks/useAudioTranscription.ts'
import './transcription-preview.css'

export function TranscriptionPreview() {
  const { start, stop, status, error, segments } = useAudioTranscription()
  const viewport = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const statusLabel = {
    idle: segments.length ? 'Complete' : 'Ready',
    connecting: 'Connecting',
    recording: 'Live',
    stopping: 'Finishing',
    error: 'Unavailable',
  }[status]
  const buttonLabel = {
    idle: 'Start recording',
    connecting: 'Cancel',
    recording: 'Stop recording',
    stopping: 'Finishing…',
    error: 'Try again',
  }[status]
  const canStop = status === 'connecting' || status === 'recording'
  const ControlIcon = canStop || status === 'stopping' ? Square : Mic

  useEffect(() => {
    const transcript = viewport.current
    if (transcript && followLatest.current) transcript.scrollTop = transcript.scrollHeight
  }, [segments])

  function handleControl() {
    if (canStop) {
      void stop()
    } else {
      followLatest.current = true
      start()
    }
  }

  return (
    <div className="transcription-preview">
      <header className="preview-header">
        <a href="/">Crosscheck</a>
      </header>

      <main className="preview-main">
        <div className="preview-heading">
          <h1>Live transcription</h1>
          <span className="preview-status" data-status={status} role="status">
            <span className="preview-status-dot" aria-hidden="true" />
            {statusLabel}
          </span>
        </div>

        <div
          className="preview-feed"
          aria-label="Transcript"
          role="region"
          tabIndex={0}
          ref={viewport}
          onScroll={({ currentTarget }) => {
            followLatest.current = currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight < 48
          }}
        >
          {segments.length > 0 ? (
            <p className="preview-text">
              {segments.map(({ id, text, isFinal }) => (
                <span className="preview-segment" key={id} data-final={isFinal}>
                  {text.match(/\S+/gu)?.map((word, index) => (
                    <Fragment key={index}>
                      <span className="preview-word">{word}</span>{' '}
                    </Fragment>
                  ))}
                </span>
              ))}
            </p>
          ) : (
            <p className="preview-placeholder">
              {status === 'recording' ? 'Listening for speech…' : 'Your words will appear here as you speak.'}
            </p>
          )}
        </div>

        <div className="preview-controls">
          <button type="button" onClick={handleControl} disabled={status === 'stopping'}>
            <ControlIcon size={17} aria-hidden="true" />
            {buttonLabel}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </main>
    </div>
  )
}
