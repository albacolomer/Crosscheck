/**
 * P4-E — fact-check pipeline composition.
 *
 * Composes injected extraction, search and analysis functions into the backend `AiPipeline`
 * (server/types/pipeline.ts). It owns no interview store, queue, retry loop or transport:
 * Person 5's interview store schedules every call, applies its own timeout through the
 * AbortSignal, and publishes each result as soon as its promise settles.
 *
 * Promise / failure behavior for the integrator:
 * - `extractClaims` resolves `[]` for non-final segments without calling extraction. When a
 *   checkability gate is injected, it runs first (one Decisions API call) and a "not checkable"
 *   answer resolves `[]` without calling extraction. A gate failure is logged and fails open to
 *   extraction, so an outage of the gate never hides claims. Otherwise it resolves the injected
 *   extractor's claims. A successful "no claims" is `[]`; extraction failures reject.
 * - `checkClaim` runs one claim: search, then analysis, with the same signal. It resolves one
 *   terminal ClaimCheck or rejects with a sanitized PipelineError. Each claim is an independent
 *   promise, so one failed claim never discards another claim's completed result.
 * - An empty search is not a failure: analysis receives `[]` and decides (normally UNVERIFIED).
 *   A search failure rejects and is never disguised as an empty investigation.
 * - Stopping transcription does not mean analysis is complete; pending claim promises keep
 *   running until they settle or the caller aborts them.
 */
import {
  PipelineError,
  type AiPipeline,
  type AnalyzeEvidence,
  type ClaimCheck,
  type ClassifyCheckability,
  type ExtractClaims,
  type ExtractedClaim,
  type ExtractionInput,
  type InterviewContext,
  type PipelineDependencies,
  type SearchEvidence,
  type StructuredGenerate,
  type WebSearchOptions,
} from './pipeline/contracts.ts'
import { createOpenAIStructuredGenerator } from './pipeline/openaiProvider.ts'
import { createCheckabilityGate, DEFAULT_DECISIONS_MODEL } from './checkabilityGate.ts'
import { createClaimExtractor } from './claimExtractor.ts'
import { createEvidenceAnalyzer } from './evidenceAnalyzer.ts'
import { createWebSearch } from './webSearch.ts'

/** Default analysis model when OPENAI_ANALYSIS_MODEL is unset. Listed in openai@7.62 `ChatModel`. */
export const DEFAULT_ANALYSIS_MODEL = 'gpt-5.4-mini'

const TERMINAL_VERDICTS = new Set<ClaimCheck['status']>(['SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'UNVERIFIED'])

export function createFactCheckPipeline(deps: PipelineDependencies): AiPipeline {
  return {
    async extractClaims(input: ExtractionInput, signal?: AbortSignal): Promise<ExtractedClaim[]> {
      if (!input.segment.isFinal) return []
      throwIfAborted(signal)
      if (deps.classifyCheckability) {
        try {
          const decision = await deps.classifyCheckability(input, signal)
          if (!decision.checkable) return []
        } catch (error) {
          throwIfAborted(signal)
          const reason = error instanceof PipelineError ? `${error.code}: ${error.message}` : 'unexpected error'
          console.warn(`Checkability gate failed (${reason}); falling back to claim extraction.`)
        }
        throwIfAborted(signal)
      }
      return deps.extractClaims(input, signal)
    },

    async checkClaim(input: { context: InterviewContext; claim: ExtractedClaim }, signal?: AbortSignal): Promise<ClaimCheck> {
      const { context, claim } = input
      throwIfAborted(signal)
      const sources = await deps.searchEvidence({ context, claim }, signal)
      throwIfAborted(signal)
      const result = await deps.analyzeEvidence({ context, claim, sources }, signal)

      if (!result || result.id !== claim.id) {
        throw new PipelineError('INVALID_OUTPUT', 'Evidence analysis returned a result for a different claim.')
      }
      if (!TERMINAL_VERDICTS.has(result.status)) {
        throw new PipelineError('INVALID_OUTPUT', 'Evidence analysis returned a non-terminal status.')
      }
      return {
        ...result,
        id: claim.id,
        originalQuote: claim.originalQuote,
        normalizedClaim: claim.normalizedClaim,
        timestampMs: claim.timestampMs,
      }
    },
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new PipelineError('ABORTED', 'Fact-check processing was aborted.')
}

// ---------------------------------------------------------------------------
// Composition point (P4-F). `createFactCheckPipeline` and `createPipelineFromEnv` stay
// injectable; only the default export below binds the real P4-A/B/C factories.

export interface PipelineFactories {
  createCheckabilityGate?(options: { apiKey: string; model: string }): ClassifyCheckability
  createClaimExtractor(options: { generate: StructuredGenerate }): ExtractClaims
  createWebSearch(options: WebSearchOptions): SearchEvidence
  createEvidenceAnalyzer(options: { generate: StructuredGenerate }): AnalyzeEvidence
}

export type PipelineEnv = Record<string, string | undefined>

/**
 * Builds the pipeline from environment configuration and injected factories. No network call
 * happens here. Missing keys do not throw at construction: the OpenAI adapter (and the search
 * adapter, per P4-B) reject each call with PipelineError('CONFIGURATION').
 * The checkability gate uses OPENAI_DECISIONS_MODEL (default gpt-6-luna); "none" disables it.
 */
export function createPipelineFromEnv(env: PipelineEnv, factories: PipelineFactories): AiPipeline {
  const generate = createOpenAIStructuredGenerator({
    apiKey: env.OPENAI_API_KEY?.trim() ?? '',
    model: env.OPENAI_ANALYSIS_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL,
  })
  const decisionsModel = env.OPENAI_DECISIONS_MODEL?.trim() || DEFAULT_DECISIONS_MODEL
  const classifyCheckability = decisionsModel.toLowerCase() === 'none' || !factories.createCheckabilityGate
    ? undefined
    : factories.createCheckabilityGate({ apiKey: env.OPENAI_API_KEY?.trim() ?? '', model: decisionsModel })
  return createFactCheckPipeline({
    classifyCheckability,
    extractClaims: factories.createClaimExtractor({ generate }),
    searchEvidence: factories.createWebSearch({ apiKey: env.TAVILY_API_KEY?.trim() ?? '' }),
    analyzeEvidence: factories.createEvidenceAnalyzer({ generate }),
  })
}

/**
 * P4-F — the real pipeline loaded by the backend through `AI_PIPELINE_MODULE`.
 * Evaluated on dynamic import, after `server/index.ts` has loaded `dotenv/config`.
 * Empty keys never prevent startup: each affected call rejects with PipelineError('CONFIGURATION').
 */
const pipeline: AiPipeline = createPipelineFromEnv(process.env, {
  createCheckabilityGate,
  createClaimExtractor,
  createWebSearch,
  createEvidenceAnalyzer,
})

export default pipeline
