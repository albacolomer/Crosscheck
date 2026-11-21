import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AiPipeline } from '../types/pipeline.ts'

export class PipelineUnavailableError extends Error {
  constructor() { super('The AI pipeline is not configured.') }
}

export const unavailablePipeline: AiPipeline = {
  async extractClaims() { throw new PipelineUnavailableError() },
  async checkClaim() { throw new PipelineUnavailableError() },
}

/** Real Person 4 pipeline, used when AI_PIPELINE_MODULE is unset. Paths resolve from the process cwd (repo root). */
export const DEFAULT_PIPELINE_MODULE = './server/services/factCheckPipeline.ts'

/** AI_PIPELINE_MODULE overrides the default; set it to `none` to run without a pipeline. */
export async function loadPipeline(): Promise<AiPipeline> {
  const modulePath = process.env.AI_PIPELINE_MODULE?.trim() || DEFAULT_PIPELINE_MODULE
  if (modulePath === 'none') return unavailablePipeline
  const module = await import(pathToFileURL(path.resolve(modulePath)).href)
  const pipeline = module.pipeline ?? module.default ?? module
  if (typeof pipeline?.extractClaims !== 'function' || typeof pipeline?.checkClaim !== 'function') {
    throw new Error('AI_PIPELINE_MODULE must export a pipeline with extractClaims and checkClaim.')
  }
  return pipeline
}
