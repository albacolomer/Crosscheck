import {
  MAX_PREPARATION_TRANSCRIPT_CHARS,
  PREPARATION_PARSE_PATH,
  type ParsedInterviewee,
  type ParsedPreparation,
  type ParsePreparationRequest,
} from '../../../shared/preparation.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function readPreparation(payload: unknown): ParsedPreparation {
  if (!isRecord(payload) || !Array.isArray(payload.interviewees)) throw new Error('The server returned an invalid context.')
  const interviewees = payload.interviewees.flatMap((person): ParsedInterviewee[] => {
    if (!isRecord(person) || typeof person.name !== 'string' || !person.name.trim()) return []
    return [{
      name: person.name,
      role: typeof person.role === 'string' ? person.role : '',
      organization: typeof person.organization === 'string' ? person.organization : '',
    }]
  })
  return { interviewees, topics: strings(payload.topics), notes: strings(payload.notes) }
}

/** Sends a dictated brief to the backend and returns the extracted preparation fields. */
export async function parsePreparation(request: ParsePreparationRequest, signal?: AbortSignal): Promise<ParsedPreparation> {
  const response = await fetch(PREPARATION_PARSE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...request, transcript: request.transcript.slice(0, MAX_PREPARATION_TRANSCRIPT_CHARS) }),
    signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
      ? payload.error.message
      : 'Could not turn the dictation into interview context.'
    throw new Error(message)
  }
  return readPreparation(payload)
}
