/**
 * P4-0 — single module-local contract for the Person 4 analysis packages.
 *
 * Every analysis package (P4-A..P4-E) imports its types from this file. Do not copy these
 * declarations elsewhere. The top-level pipeline matches the backend's `AiPipeline`
 * (server/types/pipeline.ts) so Person 5 can load it through `AI_PIPELINE_MODULE`.
 *
 * Rules shared by all packages:
 * - Claim IDs: `${segment.id}:c${index}` (index from 0, within one extraction result).
 * - `timestampMs` is recording-relative and always copied from the source segment.
 * - `originalQuote` is the exact transcript wording (joined with a single space when a
 *   claim spans consecutive segments). `normalizedClaim` is the self-contained rewrite.
 * - Confidence is a number from 0 to 1.
 * - Every evidence URL in a ClaimCheck must be the URL of a supplied SearchSource.
 * - `UNVERIFIED` means insufficient reliable evidence. Operational failures throw a
 *   PipelineError instead; they never become a verdict or an empty successful search.
 * - Transcript and provider text are data, never instructions.
 */
import type { InterviewSummary } from '../../../shared/api.ts'
import type { ClaimCheck, InterviewContext, TranscriptSegment } from '../../../shared/types.ts'
import type { AiPipeline, ExtractedClaim } from '../../types/pipeline.ts'

export const CONTRACT_REVISION = 'p4-0.1'

export type { AiPipeline, ClaimCheck, ExtractedClaim, InterviewContext, TranscriptSegment }

// ---------------------------------------------------------------------------
// Failures

export type PipelineErrorCode =
  | 'CONFIGURATION' // missing or invalid credentials/model
  | 'PROVIDER' // upstream outage or non-success response
  | 'TIMEOUT'
  | 'ABORTED'
  | 'INVALID_OUTPUT' // provider/model output failed runtime validation

/** Sanitized failure. `message` must never contain secrets or raw upstream bodies. */
export class PipelineError extends Error {
  readonly code: PipelineErrorCode
  constructor(code: PipelineErrorCode, message: string) {
    super(message)
    this.name = 'PipelineError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// Structured generation (implemented by P4-E, injected into P4-A and P4-C)

export interface StructuredRequest<T> {
  /** Schema name, `^[a-zA-Z0-9_-]{1,64}$`. */
  name: string
  /** System-level instructions. */
  instructions: string
  /** User content (transcript, sources...). Treated as data by the prompt. */
  input: string
  /** Strict JSON Schema for OpenAI Structured Outputs (all properties required, no extras). */
  schema: Record<string, unknown>
  /** Runtime validation; throw PipelineError('INVALID_OUTPUT', ...) when the value is unusable. */
  validate: (value: unknown) => T
}

export type StructuredGenerate = <T>(request: StructuredRequest<T>, signal?: AbortSignal) => Promise<T>

// ---------------------------------------------------------------------------
// P4-A — claim extraction

export interface ExtractionInput {
  context: InterviewContext
  /** The segment to analyse. Non-final segments must yield `[]` without a provider call. */
  segment: TranscriptSegment
  /**
   * Optional bounded preceding conversation (final segments only, oldest first), supplied by
   * Person 5. Used only to resolve references and statements split across segments.
   */
  recentSegments?: TranscriptSegment[]
}

export type ExtractClaims = (input: ExtractionInput, signal?: AbortSignal) => Promise<ExtractedClaim[]>

// ---------------------------------------------------------------------------
// Checkability gate (runs before P4-A, one OpenAI Decisions API call per final segment)

export interface CheckabilityDecision {
  /** True when the segment asserts something public sources could confirm or refute. */
  checkable: boolean
  /** Decisions API choice: factual_claim, personal, opinion, question, filler or other. */
  kind: string
  /** Probability of `factual_claim`, from 0 to 1. */
  probability: number
}

export type ClassifyCheckability = (input: ExtractionInput, signal?: AbortSignal) => Promise<CheckabilityDecision>

// ---------------------------------------------------------------------------
// P4-B — evidence retrieval (neutral: no stance, no verdict)

export interface SearchSource {
  /** Stable within one search result: `s1`, `s2`, ... */
  id: string
  title: string
  /** http(s) only, as returned by the provider. */
  url: string
  /** Relevant source content as returned by the provider. Never model-generated. */
  content: string
  score?: number
  publishedDate?: string
}

export interface SearchInput {
  context: InterviewContext
  claim: ExtractedClaim
}

/** Resolves `[]` for a successful empty search; throws PipelineError for failures. */
export type SearchEvidence = (input: SearchInput, signal?: AbortSignal) => Promise<SearchSource[]>

// ---------------------------------------------------------------------------
// P4-C — evidence evaluation and questions

export interface AnalysisInput {
  context: InterviewContext
  claim: ExtractedClaim
  sources: SearchSource[]
}

/**
 * Returns a terminal ClaimCheck (never `CHECKING`) with the claim's id, originalQuote,
 * normalizedClaim and timestampMs unchanged, 0–3 suggested questions, and evidence whose
 * URLs all come from `sources`. Non-UNVERIFIED verdicts require at least one evidence item.
 */
export type AnalyzeEvidence = (input: AnalysisInput, signal?: AbortSignal) => Promise<ClaimCheck>

// ---------------------------------------------------------------------------
// P4-D — deterministic summary

export interface SummaryInput {
  checks: ClaimCheck[]
  /**
   * Explicit answer state, by suggested-question text. When omitted, no question is labelled
   * unanswered; questions are reported as `followUpQuestions` instead.
   */
  answeredQuestions?: string[]
}

export interface PipelineSummary extends InterviewSummary {
  /** Checks still `CHECKING`; excluded from totals and verdict counts. */
  pendingClaims: number
  /** Normalized claims judged CONTRADICTED or MISLEADING. */
  contradictions: string[]
  /** Normalized claims judged UNVERIFIED. */
  needsResearch: string[]
  /** Distinct suggested questions from final checks (not an answered/unanswered judgement). */
  followUpQuestions: string[]
}

export type SummarizeInterview = (input: SummaryInput) => PipelineSummary

// ---------------------------------------------------------------------------
// P4-E — composition

export interface PipelineDependencies {
  /** Optional gate; when it says a segment is not checkable, extraction is skipped. Gate failures fail open. */
  classifyCheckability?: ClassifyCheckability
  extractClaims: ExtractClaims
  searchEvidence: SearchEvidence
  analyzeEvidence: AnalyzeEvidence
}

export interface OpenAIProviderOptions {
  apiKey: string
  model: string
  timeoutMs?: number
}

export interface WebSearchOptions {
  apiKey: string
  maxResults?: number
  timeoutMs?: number
}
