import cors from 'cors'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { apiRoutes } from './routes/api.ts'
import { ApiError } from './routes/validation.ts'
import { DEFAULT_JOB_TIMEOUT_MS, InterviewStore } from './services/interviewStore.ts'
import { unavailablePipeline } from './services/pipelineAdapter.ts'
import type { AiPipeline } from './types/pipeline.ts'

export function createApp(pipeline: AiPipeline = unavailablePipeline, timeoutMs = DEFAULT_JOB_TIMEOUT_MS) {
  const app = express()
  const store = new InterviewStore(pipeline, timeoutMs)
  app.disable('x-powered-by')
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
  app.use(express.json({ limit: '1mb' }))
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'crosscheck-api', pipeline: pipeline === unavailablePipeline ? 'unavailable' : 'connected' })
  })
  app.use('/api', apiRoutes(store))
  app.use((_req, _res, next) => { next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found.')) })
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } }); return }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 1 MB.' } }); return }
    if (error instanceof URIError) { res.status(400).json({ error: { code: 'INVALID_PATH', message: 'Request path is not valid.' } }); return }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } })
  }
  app.use(errors)
  return { app, store }
}
