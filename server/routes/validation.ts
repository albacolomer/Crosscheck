import type { InterviewContext, TranscriptSegment } from '../../shared/types.ts'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_BODY', 'Expected a JSON object.')
  }
  return value as Record<string, unknown>
}

export function text(value: unknown, field: string, required = true, limit = 10000): string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) {
    throw new ApiError(400, 'INVALID_FIELD', `${field} must be ${required ? 'a non-empty' : 'a'} string of at most ${limit} characters.`)
  }
  return value.trim()
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 50) {
    throw new ApiError(400, 'INVALID_FIELD', `${field} must be an array of at most 50 strings.`)
  }
  return value.map(entry => text(entry, field, true, 2000))
}

export function interviewContext(value: unknown): InterviewContext {
  const body = object(value)
  return {
    title: text(body.title, 'title', true, 300),
    intervieweeName: text(body.intervieweeName, 'intervieweeName', true, 300),
    intervieweeRole: text(body.intervieweeRole ?? '', 'intervieweeRole', false, 300),
    background: text(body.background ?? '', 'background', false),
    topics: strings(body.topics ?? [], 'topics'),
    keyQuestions: strings(body.keyQuestions ?? [], 'keyQuestions'),
  }
}

export function transcriptSegment(value: unknown): TranscriptSegment {
  const body = object(value)
  if (typeof body.isFinal !== 'boolean' || typeof body.timestampMs !== 'number' || !Number.isFinite(body.timestampMs) || body.timestampMs < 0) {
    throw new ApiError(400, 'INVALID_SEGMENT', 'isFinal must be boolean and timestampMs must be a finite non-negative number.')
  }
  return {
    id: text(body.id, 'segment.id', true, 200), text: text(body.text, 'segment.text'),
    isFinal: body.isFinal, timestampMs: body.timestampMs,
    ...(body.speaker === undefined ? {} : { speaker: text(body.speaker, 'segment.speaker', false, 200) }),
  }
}
