import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '../../shared/types.ts'
import { createLiveTranscription, type LiveTranscription } from '../services/audio/liveTranscription.ts'

type TranscriptionStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

function upsertSegment(segments: TranscriptSegment[], segment: TranscriptSegment) {
  if (segments.some(({ id, isFinal }) => id === segment.id && isFinal)) return segments
  const updated = segments.filter(({ id }) => id !== segment.id)
  if (segment.text.trim()) updated.push(segment)
  return updated.sort((a, b) => a.timestampMs - b.timestampMs)
}

export function useAudioTranscription(interviewId?: string) {
  const sessionRef = useRef<LiveTranscription | null>(null)
  const [status, setStatus] = useState<TranscriptionStatus>('idle')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    sessionRef.current?.dispose()
    sessionRef.current = null
  }, [])

  const start = useCallback(() => {
    if (sessionRef.current) return

    const session = createLiveTranscription({
      interviewId,
      onReady: () => setStatus('recording'),
      onSegment: (segment) => setSegments((current) => upsertSegment(current, segment)),
      onEnd: (failure) => {
        sessionRef.current = null
        setSegments((current) => current.filter(({ isFinal }) => isFinal))
        setError(failure ?? null)
        setStatus(failure ? 'error' : 'idle')
      },
    })
    sessionRef.current = session
    setSegments([])
    setError(null)
    setStatus('connecting')
    void session.start()
  }, [interviewId])

  const stop = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    setStatus('stopping')
    await session.stop()
  }, [])

  return { status, segments, error, start, stop }
}
