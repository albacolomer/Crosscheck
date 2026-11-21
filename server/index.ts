import { createServer } from 'node:http'
import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import { attachLiveTranscription } from './services/audio/liveTranscription.ts'

const app = express()
const server = createServer(app)
const port = Number(process.env.PORT ?? 3001)
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

app.use(cors({ origin: clientOrigin }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'crosscheck-api' })
})

attachLiveTranscription(server, { allowedOrigin: clientOrigin, apiKey: process.env.OPENAI_API_KEY?.trim() })

server.listen(port, 'localhost', () => {
  console.log(`Crosscheck API listening on http://localhost:${port}`)
})
