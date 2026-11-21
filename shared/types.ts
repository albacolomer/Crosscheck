export type Verdict = 'SUPPORTED' | 'CONTRADICTED' | 'MISLEADING' | 'UNVERIFIED'
export type QuestionType = 'challenge' | 'follow_up' | 'context'

export interface InterviewContext {
  title: string
  intervieweeName: string
  intervieweeRole: string
  background: string
  topics: string[]
  keyQuestions: string[]
}

export interface TranscriptSegment {
  id: string
  text: string
  isFinal: boolean
  speaker?: string
  timestampMs: number
}

export interface Evidence {
  title: string
  url: string
  summary: string
  stance: 'supporting' | 'contradicting'
}

export interface SuggestedQuestion {
  type: QuestionType
  text: string
}

export interface ClaimCheck {
  id: string
  originalQuote: string
  normalizedClaim: string
  status: Verdict | 'CHECKING'
  explanation?: string
  confidence?: number
  evidence: Evidence[]
  suggestedQuestions: SuggestedQuestion[]
  suggestedStatement?: string
  timestampMs: number
}
