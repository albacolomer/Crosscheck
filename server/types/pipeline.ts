import type { ClaimCheck, InterviewContext, TranscriptSegment } from '../../shared/types.ts'

export type ExtractedClaim = Pick<ClaimCheck, 'id' | 'originalQuote' | 'normalizedClaim' | 'timestampMs'>

/** Accepts the proposed Person 4 exports. The second argument supports cancellation. */
export interface AiPipeline {
  extractClaims(input: { context: InterviewContext; segment: TranscriptSegment }, signal?: AbortSignal): Promise<ExtractedClaim[]>
  checkClaim(input: { context: InterviewContext; claim: ExtractedClaim }, signal?: AbortSignal): Promise<ClaimCheck>
}
