import { createServer } from 'node:http'
import 'dotenv/config'
import { createApp } from './app.ts'
import { attachLiveTranscription } from './services/audio/liveTranscription.ts'
import { loadPipeline } from './services/pipelineAdapter.ts'

const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.')
const { app, store } = createApp(await loadPipeline())
const server = createServer(app)
attachLiveTranscription(server, {
  allowedOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  apiKey: process.env.OPENAI_API_KEY?.trim(),
  onFinalSegment(segment, interviewId) {
    if (interviewId) store.ingest(interviewId, segment)
  },
})

server.listen(port, 'localhost', () => {
  console.log(`Crosscheck API listening on http://localhost:${port}`)
})
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
