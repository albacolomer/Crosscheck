import type { InterviewContext } from '../../../shared/types.ts'

const demoContext: InterviewContext = {
  title: 'Live segment demo',
  intervieweeName: 'Speaker',
  intervieweeRole: '',
  background: '',
  topics: [],
  keyQuestions: [],
}

export type SegmentStreamUpdate =
  | { status: 'connected'; segmentIds: ReadonlySet<string> }
  | { status: 'reconnecting' | 'error'; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function createSegmentInterview(signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(demoContext),
    signal,
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message = isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
      ? payload.error.message
      : 'The backend could not start a demo interview.'
    throw new Error(message)
  }

  if (!isRecord(payload) || typeof payload.id !== 'string' || !payload.id.trim()) {
    throw new Error('The backend did not return an interview ID.')
  }
  return payload.id
}

function readSegmentIds(raw: string, interviewId: string): ReadonlySet<string> | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw) as unknown
  } catch {
    return null
  }

  if (!isRecord(payload) || payload.type !== 'snapshot' || !isRecord(payload.data)) return null
  const { interview, transcript } = payload.data
  if (!isRecord(interview) || interview.id !== interviewId || !Array.isArray(transcript)) return null

  const ids = new Set<string>()
  for (const segment of transcript) {
    if (!isRecord(segment) || typeof segment.id !== 'string' || typeof segment.isFinal !== 'boolean') return null
    if (segment.isFinal && segment.id.trim()) ids.add(segment.id)
  }
  return ids
}

export function streamSegmentAcknowledgements(interviewId: string, onUpdate: (update: SegmentStreamUpdate) => void) {
  const source = new EventSource(`/api/interviews/${encodeURIComponent(interviewId)}/events`)
  source.onmessage = ({ data }: MessageEvent<string>) => {
    const segmentIds = readSegmentIds(data, interviewId)
    if (segmentIds) {
      onUpdate({ status: 'connected', segmentIds })
    } else {
      source.close()
      onUpdate({ status: 'error', error: 'The server returned an invalid interview update.' })
    }
  }
  source.onerror = () => {
    onUpdate(source.readyState === EventSource.CLOSED
      ? { status: 'error', error: 'The interview stream is unavailable. Prepare a new demo interview to reconnect.' }
      : { status: 'reconnecting', error: 'Reconnecting to the interview stream.' })
  }

  return () => {
    source.onmessage = null
    source.onerror = null
    source.close()
  }
}
