import { Router } from 'express'
import { MAX_PREPARATION_TRANSCRIPT_CHARS, type ParsedPreparation } from '../../shared/preparation.ts'
import { PipelineError } from '../services/pipeline/contracts.ts'
import type { ParsePreparation } from '../services/preparationParser.ts'
import { ApiError, object, text } from './validation.ts'

const MAX_KNOWN_TOPICS = 50

function knownTopics(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_KNOWN_TOPICS) {
    throw new ApiError(400, 'INVALID_FIELD', `knownTopics must be an array of at most ${MAX_KNOWN_TOPICS} strings.`)
  }
  return value.map(topic => text(topic, 'knownTopics', true, 80))
}

export function preparationRoutes(parse: ParsePreparation) {
  const router = Router()
  router.post('/preparation/parse', async (req, res) => {
    const body = object(req.body)
    const input = {
      transcript: text(body.transcript, 'transcript', true, MAX_PREPARATION_TRANSCRIPT_CHARS),
      knownTopics: knownTopics(body.knownTopics),
    }
    const controller = new AbortController()
    res.on('close', () => { if (!res.writableEnded) controller.abort() })

    let result: ParsedPreparation
    try {
      result = await parse(input, controller.signal)
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error.code === 'CONFIGURATION'
          ? new ApiError(503, 'PARSER_UNAVAILABLE', 'Context parsing is not configured on the server.')
          : new ApiError(502, `PARSER_${error.code}`, 'Could not turn the dictation into interview context. Try again.')
      }
      throw error
    }
    res.json(result)
  })
  return router
}
