import type { ClaimCheck, InterviewContext, TranscriptSegment } from './types.ts'

export interface Interview extends InterviewContext {
  id: string
  createdAt: number
  endedAt?: number
}

export interface ProcessingJob {
  id: string
  kind: 'extraction' | 'fact-check'
  status: 'queued' | 'running' | 'completed' | 'failed'
  segmentId?: string
  claimId?: string
  error?: string
}

export interface InterviewSnapshot {
  interview: Interview
  transcript: TranscriptSegment[]
  factChecks: ClaimCheck[]
  jobs: ProcessingJob[]
}

export interface InterviewSummary {
  totalClaims: number
  supported: number
  contradicted: number
  misleading: number
  unverified: number
  /** Checks still CHECKING; excluded from totals and verdict counts. */
  pendingClaims: number
  keyFindings: string[]
  /** Empty unless explicit answer state exists; see followUpQuestions. */
  unansweredQuestions: string[]
  /** Normalized claims judged CONTRADICTED or MISLEADING. */
  contradictions: string[]
  /** Normalized claims judged UNVERIFIED. */
  needsResearch: string[]
  /** Distinct suggested questions from final checks. */
  followUpQuestions: string[]
}

export interface SummaryResponse {
  summary: InterviewSummary
  pendingJobs: number
  failedJobs: number
  isComplete: boolean
}

export type CreateInterviewRequest = InterviewContext
export interface TranscriptRequest { interviewId: string; segment: TranscriptSegment }
export interface FactCheckRequest { interviewId: string; claim: string; originalQuote?: string }
export interface TranscriptResponse { segment: TranscriptSegment; duplicate: boolean }
export interface FactCheckResponse { job: ProcessingJob; factCheck: ClaimCheck; duplicate: boolean }
export interface ApiErrorResponse { error: { code: string; message: string } }

// SSE always sends the complete authoritative snapshot, including on reconnect.
export interface InterviewEvent { type: 'snapshot'; data: InterviewSnapshot }
