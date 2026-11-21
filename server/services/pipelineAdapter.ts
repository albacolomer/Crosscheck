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

export async function loadPipeline(): Promise<AiPipeline> {
  const modulePath = process.env.AI_PIPELINE_MODULE
  if (!modulePath) return unavailablePipeline
  const module = await import(pathToFileURL(path.resolve(modulePath)).href)
  const pipeline = module.pipeline ?? module.default ?? module
  if (typeof pipeline?.extractClaims !== 'function' || typeof pipeline?.checkClaim !== 'function') {
    throw new Error('AI_PIPELINE_MODULE must export a pipeline with extractClaims and checkClaim.')
  }
  return pipeline
}
