import type { CreateInterviewRequest, Interview, InterviewEvent, InterviewSnapshot } from '../../../shared/api.ts'
import type { InterviewContext } from '../../../shared/types.ts'

export type PreparedContext = InterviewContext & { organization?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null)
  return isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
    ? payload.error.message
    : fallback
}

/** The backend requires a title and interviewee name; the preparation form allows both to be empty. */
export function toCreateInterviewRequest(context: PreparedContext): CreateInterviewRequest {
  const name = context.intervieweeName.trim()
  const role = [context.intervieweeRole.trim(), context.organization?.trim()].filter(Boolean).join(' · ')
  return {
    title: context.title.trim() || (name ? `Interview with ${name}` : 'Untitled interview'),
    intervieweeName: name || 'Unknown interviewee',
    intervieweeRole: role,
    background: context.background,
    topics: context.topics,
    keyQuestions: context.keyQuestions,
  }
}

export async function createInterview(context: PreparedContext, signal: AbortSignal): Promise<Interview> {
  const response = await fetch('/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(toCreateInterviewRequest(context)),
    signal,
  })
  if (!response.ok) throw new Error(await readError(response, 'The backend could not create the interview.'))
  const payload: unknown = await response.json()
  if (!isRecord(payload) || typeof payload.id !== 'string' || !payload.id) {
    throw new Error('The backend did not return an interview ID.')
  }
  return payload as unknown as Interview
}

export async function endInterview(interviewId: string): Promise<InterviewSnapshot> {
  const response = await fetch(`/api/interviews/${encodeURIComponent(interviewId)}/end`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(await readError(response, 'The backend could not end the interview.'))
  return response.json() as Promise<InterviewSnapshot>
}

export type InterviewStreamUpdate =
  | { status: 'connected'; snapshot: InterviewSnapshot }
  | { status: 'reconnecting' | 'error'; error: string }

function readSnapshot(raw: string, interviewId: string): InterviewSnapshot | null {
  try {
    const event = JSON.parse(raw) as InterviewEvent
    const data = event?.data
    if (event?.type !== 'snapshot' || data?.interview?.id !== interviewId) return null
    if (!Array.isArray(data.transcript) || !Array.isArray(data.factChecks) || !Array.isArray(data.jobs)) return null
    return data
  } catch {
    return null
  }
}

export function streamInterview(interviewId: string, onUpdate: (update: InterviewStreamUpdate) => void) {
  const source = new EventSource(`/api/interviews/${encodeURIComponent(interviewId)}/events`)
  source.onmessage = ({ data }: MessageEvent<string>) => {
    const snapshot = readSnapshot(data, interviewId)
    if (snapshot) {
      onUpdate({ status: 'connected', snapshot })
    } else {
      source.close()
      onUpdate({ status: 'error', error: 'The server returned an invalid interview update.' })
    }
  }
  source.onerror = () => {
    onUpdate(source.readyState === EventSource.CLOSED
      ? { status: 'error', error: 'The live interview updates are unavailable.' }
      : { status: 'reconnecting', error: 'Reconnecting to live interview updates.' })
  }
  return () => {
    source.onmessage = null
    source.onerror = null
    source.close()
  }
}
