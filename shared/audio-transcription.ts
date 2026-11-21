import type { TranscriptSegment } from './types.ts'

export const LIVE_TRANSCRIPTION_PATH = '/api/transcription/live'
export const TRANSCRIPTION_SAMPLE_RATE = 24_000

export type TranscriptionClientCommand = { type: 'stop' }

export type TranscriptionServerMessage =
  | { type: 'ready' }
  | { type: 'segment'; segment: TranscriptSegment }
  | { type: 'error'; message: string }
  | { type: 'finished' }
