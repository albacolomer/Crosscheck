import { Router } from 'express'
import type { InterviewStore } from '../services/interviewStore.ts'
import { interviewContext, object, text, transcriptSegment } from './validation.ts'

export function apiRoutes(store: InterviewStore) {
  const router = Router()
  router.post('/interviews', (req, res) => {
    const interview = store.create(interviewContext(req.body))
    res.status(201).location(`/api/interviews/${interview.id}`).json(interview)
  })
  router.get('/interviews/:id', (req, res) => { res.json(store.snapshot(req.params.id)) })
  router.post('/transcript', (req, res) => {
    const body = object(req.body)
    const result = store.ingest(text(body.interviewId, 'interviewId', true, 200), transcriptSegment(body.segment))
    res.status(result.duplicate ? 200 : 202).json(result)
  })
  router.post('/fact-check', (req, res) => {
    const body = object(req.body)
    const result = store.check(
      text(body.interviewId, 'interviewId', true, 200),
      text(body.claim, 'claim'),
      body.originalQuote === undefined ? undefined : text(body.originalQuote, 'originalQuote'),
    )
    res.status(result.duplicate ? 200 : 202).json(result)
  })
  router.get('/interviews/:id/summary', (req, res) => { res.json(store.summary(req.params.id)) })
  router.post('/interviews/:id/end', (req, res) => { res.json(store.end(req.params.id)) })
  router.post('/interviews/:id/jobs/:jobId/retry', (req, res) => { res.status(202).json(store.retry(req.params.id, req.params.jobId)) })
  router.get('/interviews/:id/events', (req, res) => {
    const initial = store.snapshot(req.params.id)
    res.status(200).set({
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    const send = (snapshot: typeof initial) => {
      if (!res.writableEnded && !res.destroyed) {
        // Allow one buffered snapshot. Reconnecting clients receive the latest state.
        if (res.writableNeedDrain) res.end()
        else res.write(`data: ${JSON.stringify({ type: 'snapshot', data: snapshot })}\n\n`)
      }
    }
    const unsubscribe = store.subscribe(req.params.id, send)
    const heartbeat = setInterval(() => {
      if (!res.writableNeedDrain && !res.writableEnded && !res.destroyed) res.write(': heartbeat\n\n')
    }, 15000)
    res.on('close', () => { clearInterval(heartbeat); unsubscribe() })
    send(initial)
  })
  return router
}
