import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Interview, InterviewSnapshot } from '../../shared/api.ts'
import type { TranscriptSegment } from '../../shared/types.ts'
import {
  createInterview,
  endInterview,
  streamInterview,
  type PreparedContext,
} from '../services/interviews/liveInterview.ts'
import { useAudioTranscription } from './useAudioTranscription.ts'

export type InterviewConnectionStatus = 'idle' | 'creating' | 'connecting' | 'connected' | 'reconnecting' | 'error'

type Created = { source: PreparedContext; attempt: number; interview: Interview }
type Failed = { source: PreparedContext; attempt: number; error: string }
type Stream = { interviewId: string; status: 'connected' | 'reconnecting' | 'error'; error: string | null; snapshot?: InterviewSnapshot }

/**
 * Connects a prepared interview to the backend and live audio.
 * Final segments reach the backend through the transcription socket; the SSE snapshot is the source of truth.
 * Local segments fill the gap until the snapshot acknowledges them.
 */
export function useLiveInterview(prepared: PreparedContext | null) {
  const [attempt, setAttempt] = useState(0)
  const [created, setCreated] = useState<Created>()
  const [failed, setFailed] = useState<Failed>()
  const [stream, setStream] = useState<Stream>()
  const [actionError, setActionError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  // The attempt a restart requested; the restart lasts until that attempt's interview exists or fails.
  const [restartAttempt, setRestartAttempt] = useState<number>()

  useEffect(() => {
    if (!prepared) return
    const controller = new AbortController()
    createInterview(prepared, controller.signal)
      .then((interview) => {
        if (!controller.signal.aborted) setCreated({ source: prepared, attempt, interview })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof TypeError || !(error instanceof Error)
          ? 'Could not reach the backend to create the interview.'
          : error.message
        setFailed({ source: prepared, attempt, error: message })
      })
    return () => controller.abort()
  }, [prepared, attempt])

  const interview = created?.source === prepared && created.attempt === attempt ? created.interview : undefined
  const creationError = failed?.source === prepared && failed.attempt === attempt ? failed.error : null
  const interviewId = interview?.id

  useEffect(() => {
    if (!interviewId) return
    return streamInterview(interviewId, (update) => {
      setStream((current) => {
        const previous = current?.interviewId === interviewId ? current.snapshot : undefined
        return update.status === 'connected'
          ? { interviewId, status: 'connected', error: null, snapshot: update.snapshot }
          : { interviewId, status: update.status, error: update.error, snapshot: previous }
      })
    })
  }, [interviewId])

  const recording = useAudioTranscription(interviewId)
  const currentStream = stream?.interviewId === interviewId ? stream : undefined
  const snapshot = currentStream?.snapshot

  // Segment IDs are `<recordingSessionId>:<itemId>` and timestampMs restarts with each recording session,
  // so order by session arrival first and by timestamp within a session.
  const [sessionOrder, setSessionOrder] = useState<string[]>([])
  const merged = useMemo(() => {
    const segments = new Map<string, TranscriptSegment>()
    for (const segment of snapshot?.transcript ?? []) segments.set(segment.id, segment)
    for (const segment of recording.segments) {
      const acknowledged = segments.get(segment.id)
      if (!acknowledged?.isFinal) segments.set(segment.id, segment)
      // The socket can deliver a speaker label before the snapshot does.
      else if (!acknowledged.speaker && segment.speaker) segments.set(segment.id, { ...acknowledged, speaker: segment.speaker })
    }
    return [...segments.values()]
  }, [snapshot, recording.segments])

  // Adjust state during render (React's documented pattern) when a new recording session appears.
  const addedSessions = [...new Set(merged.map(({ id }) => sessionOf(id)))].filter((session) => !sessionOrder.includes(session))
  if (addedSessions.length) setSessionOrder([...sessionOrder, ...addedSessions])

  const transcript = useMemo(() => {
    const rank = (id: string) => {
      const index = sessionOrder.indexOf(sessionOf(id))
      return index === -1 ? Number.MAX_SAFE_INTEGER : index
    }
    return [...merged].sort((a, b) => rank(a.id) - rank(b.id) || a.timestampMs - b.timestampMs)
  }, [merged, sessionOrder])

  const connectionStatus: InterviewConnectionStatus = !prepared
    ? 'idle'
    : creationError ? 'error'
    : !interviewId ? 'creating'
    : currentStream?.status ?? 'connecting'

  const endedAt = snapshot?.interview.endedAt
  const { start: startRecording, stop: stopRecording, reset: resetRecording } = recording

  const start = useCallback(() => {
    if (!interviewId || endedAt !== undefined) return
    setActionError(null)
    startRecording()
  }, [interviewId, endedAt, startRecording])

  const end = useCallback(async () => {
    if (!interviewId || ending) return
    setEnding(true)
    setActionError(null)
    try {
      await stopRecording()
      const ended = await endInterview(interviewId)
      setStream((current) => current?.interviewId === interviewId ? { ...current, snapshot: ended } : current)
      return ended
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not end the interview.')
    } finally {
      setEnding(false)
    }
  }, [interviewId, ending, stopRecording])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  /**
   * Discards the current session and creates a new backend interview from the same prepared context.
   * The old interview is ended best-effort so its queued jobs stop mattering; failures are ignored.
   */
  const restart = useCallback(() => {
    if (!prepared || ending || (restartAttempt === attempt && !interviewId)) return false
    resetRecording()
    if (interviewId && endedAt === undefined) void endInterview(interviewId).catch(() => undefined)
    setActionError(null)
    setSessionOrder([])
    setAttempt(attempt + 1)
    setRestartAttempt(attempt + 1)
    return true
  }, [prepared, ending, resetRecording, interviewId, endedAt, attempt, restartAttempt])

  return {
    interview: snapshot?.interview ?? interview,
    interviewId,
    connectionStatus,
    error: creationError ?? actionError ?? (currentStream?.status === 'connected' ? null : currentStream?.error ?? null),
    transcript,
    factChecks: snapshot?.factChecks ?? [],
    jobs: snapshot?.jobs ?? [],
    endedAt,
    ending,
    restarting: restartAttempt === attempt && !interviewId && !creationError,
    recordingStatus: recording.status,
    recordingError: recording.error,
    start,
    stop: stopRecording,
    end,
    retry,
    restart,
    /** Changes whenever a new backend interview is requested; use it to reset per-session UI state. */
    session: attempt,
  }
}

export type LiveInterview = ReturnType<typeof useLiveInterview>

function sessionOf(segmentId: string) {
  const separator = segmentId.indexOf(':')
  return separator === -1 ? '' : segmentId.slice(0, separator)
}
