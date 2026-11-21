import type { ClaimCheck, InterviewContext, TranscriptSegment } from '../../shared/types.ts'

/**
 * `subject` (optional): the entity the claim is about, resolved by extraction from the conversation
 * (e.g. "Pedro Sánchez, President of Spain" for "my mandate"). Never part of the published ClaimCheck.
 */
export type ExtractedClaim = Pick<ClaimCheck, 'id' | 'originalQuote' | 'normalizedClaim' | 'timestampMs'> & { subject?: string }

/**
 * Conversation a claim was made in, so verification judges the claim as meant in the interview.
 * `segments`: bounded final segments with speaker labels, oldest first, ending with the claim's own segment.
 * `subject`: resolved subject of the claim; defaults to `claim.subject`.
 */
export interface ClaimConversation {
  segments: TranscriptSegment[]
  subject?: string
}

/**
 * Backend boundary for the Person 4 pipeline (contract revision p4-0.2). The second argument supports cancellation.
 * `recentSegments`: preceding final segments of the same interview, oldest first, excluding `segment`.
 * `conversation` (optional, p4-0.2): conversation excerpt used by search and evidence analysis.
 */
export interface AiPipeline {
  extractClaims(input: { context: InterviewContext; segment: TranscriptSegment; recentSegments?: TranscriptSegment[] }, signal?: AbortSignal): Promise<ExtractedClaim[]>
  checkClaim(input: { context: InterviewContext; claim: ExtractedClaim; conversation?: ClaimConversation }, signal?: AbortSignal): Promise<ClaimCheck>
}
