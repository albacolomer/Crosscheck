import type { ClaimCheck, InterviewContext, TranscriptSegment } from '../../shared/types.ts'

export type ExtractedClaim = Pick<ClaimCheck, 'id' | 'originalQuote' | 'normalizedClaim' | 'timestampMs'>

/**
 * Backend boundary for the Person 4 pipeline (contract revision p4-0.1). The second argument supports cancellation.
 * `recentSegments`: preceding final segments of the same interview, oldest first, excluding `segment`.
 */
export interface AiPipeline {
  extractClaims(input: { context: InterviewContext; segment: TranscriptSegment; recentSegments?: TranscriptSegment[] }, signal?: AbortSignal): Promise<ExtractedClaim[]>
  checkClaim(input: { context: InterviewContext; claim: ExtractedClaim }, signal?: AbortSignal): Promise<ClaimCheck>
}
