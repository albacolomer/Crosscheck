import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { RealtimeClientEvent, RealtimeServerEvent } from 'openai/resources/realtime/realtime'
import WebSocket, { WebSocketServer } from 'ws'
import type { RawData } from 'ws'
import {
  LIVE_TRANSCRIPTION_PATH,
  TRANSCRIPTION_SAMPLE_RATE,
} from '../../../shared/audio-transcription.ts'
import type {
  TranscriptionClientCommand,
  TranscriptionServerMessage,
} from '../../../shared/audio-transcription.ts'
import type { TranscriptSegment } from '../../../shared/types.ts'
import { createAudioTurns } from './audioTurns.ts'
import { createSpeakerIdentifier, type SpeakerIdentifier } from './speakerDiarization.ts'

const openAIRealtimeUrl = 'wss://api.openai.com/v1/realtime?intent=transcription'
const maxFrameBytes = TRANSCRIPTION_SAMPLE_RATE
const maxBufferedBytes = 256 * 1024
const timeoutMs = 12_000

type SegmentListener = (segment: TranscriptSegment, interviewId?: string) => void | Promise<void>
type SpeakerListener = (segmentId: string, speaker: string, interviewId?: string) => void
type ClosingMessage = Extract<TranscriptionServerMessage, { type: 'finished' | 'error' }>

interface LiveTranscriptionOptions {
  allowedOrigin: string
  apiKey?: string
  /** Label final segments with `Speaker N` after they are published. Defaults to true. */
  diarization?: boolean
  onFinalSegment?: SegmentListener
  /** Receives the speaker label of a final segment that was already passed to `onFinalSegment`. */
  onSpeaker?: SpeakerListener
}

interface SessionOptions {
  interviewId?: string
  identifySpeaker?: SpeakerIdentifier
  onFinalSegment?: SegmentListener
  onSpeaker?: SpeakerListener
}

interface TranscriptItem {
  text: string
  isFinal: boolean
  wasDisplayed: boolean
  timestampMs?: number
  audio?: Buffer
}

interface PendingCommit {
  timestampMs: number
  audio: Buffer
}

function sendMessage(client: WebSocket, message: TranscriptionServerMessage) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message))
}

function rejectClient(client: WebSocket, message: string) {
  client.on('error', () => client.terminate())
  sendMessage(client, { type: 'error', message })
  client.close(1011)
}

function asBuffer(data: RawData) {
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Array.isArray(data) ? Buffer.concat(data) : data
}

function isStopCommand(data: Buffer) {
  try {
    const command = JSON.parse(data.toString()) as TranscriptionClientCommand | null
    return command?.type === 'stop'
  } catch {
    return false
  }
}

function startSession(
  client: WebSocket,
  apiKey: string,
  { interviewId, identifySpeaker, onFinalSegment, onSpeaker }: SessionOptions,
) {
  const upstream = new WebSocket(openAIRealtimeUrl, {
    headers: { Authorization: 'Bearer ' + apiKey },
    handshakeTimeout: timeoutMs,
  })
  const sessionId = randomUUID()
  const awaitingCommit: PendingCommit[] = []
  const items = new Map<string, TranscriptItem>()
  const finalizedIds = new Set<string>()
  let ready = false
  let stopping = false
  let closed = false
  let drainTimer: ReturnType<typeof setTimeout> | undefined
  const setupTimer = setTimeout(() => fail('The transcription service took too long to connect.'), timeoutMs)

  function closeSession(message?: ClosingMessage) {
    if (closed) return
    closed = true
    clearTimeout(setupTimer)
    clearTimeout(drainTimer)
    if (message) sendMessage(client, message)
    if (client.readyState === WebSocket.OPEN) client.close(message?.type === 'error' ? 1011 : 1000)
    upstream.terminate()
  }

  function fail(message: string) {
    closeSession({ type: 'error', message })
  }

  function sendUpstream(event: RealtimeClientEvent) {
    if (closed || upstream.readyState !== WebSocket.OPEN) return
    if (upstream.bufferedAmount > maxBufferedBytes) {
      fail('The transcription connection fell behind. Start recording again.')
      return
    }
    upstream.send(JSON.stringify(event))
  }

  const audio = createAudioTurns(
    (frame) => sendUpstream({ type: 'input_audio_buffer.append', audio: frame.toString('base64') }),
    (timestampMs, turnAudio) => {
      awaitingCommit.push({ timestampMs, audio: turnAudio })
      sendUpstream({ type: 'input_audio_buffer.commit' })
    },
  )

  function finishIfDrained() {
    if (stopping && awaitingCommit.length === 0 && items.size === 0) {
      closeSession({ type: 'finished' })
    }
  }

  function publishItem(itemId: string, update: Partial<TranscriptItem>) {
    if (finalizedIds.has(itemId)) return
    const item = items.get(itemId) ?? { text: '', isFinal: false, wasDisplayed: false }
    Object.assign(item, update)
    items.set(itemId, item)

    if (item.isFinal && item.timestampMs === undefined) return

    const segment: TranscriptSegment = {
      id: sessionId + ':' + itemId,
      text: item.isFinal ? item.text.trim() : item.text,
      isFinal: item.isFinal,
      timestampMs: item.timestampMs ?? awaitingCommit[0]?.timestampMs ?? audio.timestampMs,
    }
    if (segment.text.trim() || (item.isFinal && item.wasDisplayed)) {
      sendMessage(client, { type: 'segment', segment })
      item.wasDisplayed = true
    }

    if (!item.isFinal) return
    items.delete(itemId)
    finalizedIds.add(itemId)
    if (segment.text && onFinalSegment) {
      void Promise.resolve().then(() => onFinalSegment(segment, interviewId)).catch(() => {
        console.warn('A final transcript segment could not be passed to its consumer.')
      })
    }
    if (segment.text && item.audio && identifySpeaker) labelSpeaker(segment, item.audio, identifySpeaker)
    finishIfDrained()
  }

  // Speaker labels arrive after the final text, as an update of the same segment ID.
  function labelSpeaker(segment: TranscriptSegment, turnAudio: Buffer, identify: SpeakerIdentifier) {
    identify(turnAudio).then((speaker) => {
      if (!speaker) return
      sendMessage(client, { type: 'segment', segment: { ...segment, speaker } })
      onSpeaker?.(segment.id, speaker, interviewId)
    }).catch((error: unknown) => {
      const status = (error as { status?: unknown } | null)?.status
      console.warn('Speaker labeling failed' + (typeof status === 'number' ? ' (HTTP ' + status + ').' : '.'))
    })
  }

  function handleUpstreamMessage(data: RawData) {
    if (closed) return
    let event: RealtimeServerEvent
    try {
      event = JSON.parse(asBuffer(data).toString()) as RealtimeServerEvent
    } catch {
      return fail('The transcription service returned an invalid response.')
    }

    switch (event.type) {
      case 'session.updated':
        if (ready) break
        clearTimeout(setupTimer)
        ready = true
        sendMessage(client, { type: 'ready' })
        break
      case 'input_audio_buffer.committed': {
        if (finalizedIds.has(event.item_id) || items.get(event.item_id)?.timestampMs !== undefined) break
        const commit = awaitingCommit.shift()
        publishItem(event.item_id, { timestampMs: commit?.timestampMs ?? audio.timestampMs, audio: commit?.audio })
        break
      }
      case 'conversation.item.input_audio_transcription.delta': {
        const item = items.get(event.item_id)
        if (item?.isFinal) break
        publishItem(event.item_id, { text: (item?.text ?? '') + event.delta })
        break
      }
      case 'conversation.item.input_audio_transcription.completed':
        publishItem(event.item_id, { text: event.transcript, isFinal: true })
        break
      case 'conversation.item.input_audio_transcription.failed':
        publishItem(event.item_id, { text: '', isFinal: true })
        break
      case 'error':
        fail(ready
          ? 'OpenAI interrupted transcription. Start recording again.'
          : 'OpenAI could not start transcription. Check the API key and project access.')
        break
    }
  }

  function handleClientMessage(data: RawData, isBinary: boolean) {
    if (closed || stopping) return
    const frame = asBuffer(data)
    if (!isBinary && isStopCommand(frame)) {
      stopping = true
      drainTimer = setTimeout(() => fail('The final transcript took too long to arrive.'), timeoutMs)
      audio.flush()
      finishIfDrained()
      return
    }
    if (!ready || !isBinary || !frame.length || frame.length % 2 !== 0) {
      fail('The transcription connection received invalid audio.')
      return
    }
    audio.push(frame)
  }

  upstream.on('open', () => {
    sendUpstream({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: TRANSCRIPTION_SAMPLE_RATE },
            transcription: { model: 'gpt-live-transcribe' },
            turn_detection: null,
          },
        },
      },
    })
  })
  upstream.on('message', handleUpstreamMessage)
  upstream.on('error', () => fail('Could not connect to OpenAI transcription. Check the API key and network.'))
  upstream.on('close', () => fail('The OpenAI transcription connection closed. Start recording again.'))
  client.on('message', handleClientMessage)
  client.on('close', () => closeSession())
  client.on('error', () => closeSession())
}

export function attachLiveTranscription(server: Server, options: LiveTranscriptionOptions) {
  const bridge = new WebSocketServer({ noServer: true, maxPayload: maxFrameBytes })
  // Keep one identifier per interview so speaker labels stay stable when recording pauses and resumes.
  const speakerIdentifiers = new Map<string, SpeakerIdentifier>()

  function speakerIdentifier(apiKey: string, interviewId?: string) {
    if (options.diarization === false) return undefined
    if (!interviewId) return createSpeakerIdentifier(apiKey)
    let identify = speakerIdentifiers.get(interviewId)
    if (!identify) {
      identify = createSpeakerIdentifier(apiKey)
      speakerIdentifiers.set(interviewId, identify)
    }
    return identify
  }

  server.on('upgrade', (request, socket, head) => {
    const [path, query] = (request.url ?? '').split('?', 2)
    if (path !== LIVE_TRANSCRIPTION_PATH) {
      if (server.listenerCount('upgrade') === 1) socket.destroy()
      return
    }
    if (request.headers.origin !== options.allowedOrigin) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    const interviewId = new URLSearchParams(query).get('interviewId') || undefined
    bridge.handleUpgrade(request, socket, head, (client) => {
      if (!options.apiKey) {
        rejectClient(client, 'Set OPENAI_API_KEY in .env and restart the backend.')
        return
      }
      try {
        startSession(client, options.apiKey, {
          interviewId,
          identifySpeaker: speakerIdentifier(options.apiKey, interviewId),
          onFinalSegment: options.onFinalSegment,
          onSpeaker: options.onSpeaker,
        })
      } catch {
        rejectClient(client, 'Could not configure OpenAI transcription. Check the API key and restart the backend.')
      }
    })
  })

  server.once('close', () => {
    for (const client of bridge.clients) client.terminate()
    bridge.close()
  })
}
