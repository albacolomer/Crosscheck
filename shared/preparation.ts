export const PREPARATION_PARSE_PATH = '/api/preparation/parse'
export const MAX_PREPARATION_TRANSCRIPT_CHARS = 8000

export interface ParsedInterviewee {
  name: string
  role: string
  organization: string
}

export interface ParsePreparationRequest {
  transcript: string
  /** Optional topic labels the page offers; the parser reuses them when they fit. */
  knownTopics?: string[]
}

export interface ParsedPreparation {
  interviewees: ParsedInterviewee[]
  topics: string[]
  notes: string[]
}
