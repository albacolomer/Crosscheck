/**
 * P4-A — pure helpers that turn interview context and bounded recent conversation into prompt
 * text. No global state: every function derives its output from its arguments only.
 *
 * Transcript and context strings are embedded as JSON string literals so that quotes, newlines
 * or delimiter-like text inside them cannot break out of their data block.
 */
import type { InterviewContext, TranscriptSegment } from './contracts.ts'

export const DEFAULT_CONTEXT_MAX_CHARS = 2000
export const DEFAULT_RECENT_MAX_SEGMENTS = 6
export const DEFAULT_RECENT_MAX_CHARS = 2400
export const DEFAULT_FIELD_MAX_CHARS = 600

const ELLIPSIS = '…'

/** Collapses whitespace runs to single spaces and trims. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Truncates to at most `maxChars` characters, marking the cut with an ellipsis. */
export function truncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  if (maxChars === 1) return ELLIPSIS
  return `${text.slice(0, maxChars - 1).trimEnd()}${ELLIPSIS}`
}

function quoted(text: string, maxChars: number): string {
  return JSON.stringify(truncate(normalizeWhitespace(text), maxChars))
}

/**
 * Formats the interview preparation context as labelled lines, capped at `maxChars` overall.
 * Empty fields are omitted.
 */
export function formatInterviewContext(
  context: InterviewContext,
  maxChars: number = DEFAULT_CONTEXT_MAX_CHARS,
): string {
  const fieldMax = Math.min(DEFAULT_FIELD_MAX_CHARS, maxChars)
  const lines: string[] = []
  const add = (label: string, value: string | undefined) => {
    if (value && normalizeWhitespace(value)) lines.push(`${label}: ${quoted(value, fieldMax)}`)
  }
  const addList = (label: string, values: string[] | undefined) => {
    const items = (values ?? []).map(normalizeWhitespace).filter(Boolean)
    if (items.length > 0) lines.push(`${label}: ${JSON.stringify(items.map((item) => truncate(item, fieldMax)))}`)
  }

  add('Interview title', context.title)
  add('Interviewee name', context.intervieweeName)
  add('Interviewee role', context.intervieweeRole)
  add('Background', context.background)
  addList('Topics', context.topics)
  addList('Key questions', context.keyQuestions)

  if (lines.length === 0) return '(no interview context provided)'

  // Drop whole trailing lines rather than cutting a JSON literal in half.
  let result = ''
  for (const line of lines) {
    const next = result ? `${result}\n${line}` : line
    if (next.length > maxChars) break
    result = next
  }
  return result || truncate(lines[0], maxChars)
}

export interface RecentSegmentLimits {
  maxSegments?: number
  maxChars?: number
}

/**
 * Selects the bounded slice of preceding conversation used for extraction: final, non-empty
 * segments other than `currentId`, keeping the most recent ones that fit both limits, returned
 * oldest first. Segments are never truncated, so their text stays verbatim for quote checks.
 */
export function selectRecentSegments(
  segments: TranscriptSegment[] | undefined,
  currentId: string,
  { maxSegments = DEFAULT_RECENT_MAX_SEGMENTS, maxChars = DEFAULT_RECENT_MAX_CHARS }: RecentSegmentLimits = {},
): TranscriptSegment[] {
  if (!segments || segments.length === 0 || maxSegments <= 0 || maxChars <= 0) return []
  const selected: TranscriptSegment[] = []
  let used = 0
  for (let i = segments.length - 1; i >= 0 && selected.length < maxSegments; i -= 1) {
    const segment = segments[i]
    if (!segment.isFinal || segment.id === currentId) continue
    const text = normalizeWhitespace(segment.text)
    if (!text) continue
    if (used + text.length > maxChars) break
    used += text.length
    selected.unshift(segment)
  }
  return selected
}

function speakerLabel(segment: TranscriptSegment): string {
  const speaker = segment.speaker ? normalizeWhitespace(segment.speaker) : ''
  return speaker ? truncate(speaker, 60) : 'unknown speaker'
}

/** Formats one segment as `[speaker] "text"`; the text is never truncated. */
export function formatSegment(segment: TranscriptSegment): string {
  return `[${speakerLabel(segment)}] ${JSON.stringify(normalizeWhitespace(segment.text))}`
}

/** Formats already-selected recent segments, oldest first, one per line. */
export function formatRecentSegments(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return '(no preceding conversation)'
  return segments.map(formatSegment).join('\n')
}

/** Builds the complete user-content block for claim extraction. */
export function buildExtractionPromptInput(
  context: InterviewContext,
  recentSegments: TranscriptSegment[],
  segment: TranscriptSegment,
): string {
  return [
    '<interview_context>',
    formatInterviewContext(context),
    '</interview_context>',
    '',
    '<recent_segments oldest_first="true">',
    formatRecentSegments(recentSegments),
    '</recent_segments>',
    '',
    '<current_segment>',
    formatSegment(segment),
    '</current_segment>',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Questions and speaker roles

/** Speaker label the pipeline treats as the interviewer by default: the first voice heard. */
export const DEFAULT_INTERVIEWER_SPEAKERS = ['Speaker 1', 'Journalist']

const SENTENCE_BREAK = /(?<=[.!?…])\s+/u
const ENDS_AS_QUESTION = /[?？][\s"'»”’)\]]*$/u

/**
 * True when every sentence of the text is interrogative, including declarative sentences with a
 * confirmation tag ("Por Navarra, ¿no?", "That was 2019, right?"). Used as a fast, language-neutral
 * check before any provider call; a mixed segment ("Sí. ¿Y en 2020?") is not question-only.
 */
export function isQuestionOnly(text: string): boolean {
  const sentences = normalizeWhitespace(text).split(SENTENCE_BREAK).filter(Boolean)
  return sentences.length > 0 && sentences.every((sentence) => ENDS_AS_QUESTION.test(sentence))
}

/** True when the segment carries a speaker label that belongs to the interviewer. */
export function isInterviewerSegment(segment: TranscriptSegment, interviewerSpeakers: readonly string[]): boolean {
  const speaker = segment.speaker ? normalizeWhitespace(segment.speaker) : ''
  return Boolean(speaker) && interviewerSpeakers.includes(speaker)
}

/**
 * Returns copies whose speaker label names its role, e.g. `Speaker 1 (interviewer)` and
 * `Speaker 2 (interviewee)`, so prompts can tell questions from answers. Unlabelled segments are
 * unchanged. Nothing changes when no interviewer label is configured.
 */
export function withSpeakerRoles(segments: TranscriptSegment[], interviewerSpeakers: readonly string[]): TranscriptSegment[] {
  if (interviewerSpeakers.length === 0) return segments
  return segments.map((segment) => {
    const speaker = segment.speaker ? normalizeWhitespace(segment.speaker) : ''
    if (!speaker) return segment
    const role = interviewerSpeakers.includes(speaker) ? 'interviewer' : 'interviewee'
    return { ...segment, speaker: `${speaker} (${role})` }
  })
}
