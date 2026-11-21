import {
  LIVE_TRANSCRIPTION_PATH,
  TRANSCRIPTION_SAMPLE_RATE,
  type TranscriptionClientCommand,
  type TranscriptionServerMessage,
} from '../../../shared/audio-transcription.ts'
import type { TranscriptSegment } from '../../../shared/types.ts'
import captureWorkletUrl from './pcm-capture.worklet.js?url'

const CONNECTION_TIMEOUT_MS = 15_000
const FINISH_TIMEOUT_MS = 20_000
const MAX_BUFFERED_BYTES = TRANSCRIPTION_SAMPLE_RATE * 2 * 4

type LiveTranscriptionOptions = {
  interviewId?: string
  onReady: () => void
  onSegment: (segment: TranscriptSegment) => void
  onEnd: (error?: string) => void
}

export type LiveTranscription = {
  start: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => void
}

function getTranscriptionUrl(interviewId?: string) {
  const url = new URL(LIVE_TRANSCRIPTION_PATH, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (interviewId) url.searchParams.set('interviewId', interviewId)
  return url
}

function getCaptureError(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Microphone access was denied. Allow it in your browser and try again.'
      case 'NotFoundError':
        return 'No microphone was found.'
      case 'NotReadableError':
        return 'Your microphone could not be started. Check that it is available and try again.'
    }
  }
  return 'Could not start microphone audio. Check your browser and microphone settings.'
}

export function createLiveTranscription(options: LiveTranscriptionOptions): LiveTranscription {
  let audioContext: AudioContext | undefined
  let stream: MediaStream | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let recorder: AudioWorkletNode | undefined
  let socket: WebSocket | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let ready = false
  let stopping = false
  let resolveCompleted: (() => void) | undefined
  const completed = new Promise<void>((resolve) => {
    resolveCompleted = resolve
  })

  function finish(error?: string, notify = true) {
    if (closed) return
    closed = true
    clearTimeout(timeout)
    stopTracks(stream)
    recorder?.port.close()
    source?.disconnect()
    recorder?.disconnect()
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined)
    }
    socket?.close()
    if (notify) options.onEnd(error)
    resolveCompleted?.()
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      finish('Microphone access requires a supported browser on HTTPS or localhost.')
      return
    }

    try {
      const context = new AudioContext({ sampleRate: TRANSCRIPTION_SAMPLE_RATE })
      audioContext = context
      await Promise.all([
        context.resume(),
        context.audioWorklet.addModule(captureWorkletUrl),
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }).then((input) => {
          if (closed) stopTracks(input)
          else stream = input
        }),
      ])
      if (closed || !stream) return

      const microphone = context.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(context, 'crosscheck-pcm-capture', {
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      source = microphone
      recorder = worklet
      const connection = new WebSocket(getTranscriptionUrl(options.interviewId))
      socket = connection
      timeout = setTimeout(() => finish('The transcription service did not connect in time.'), CONNECTION_TIMEOUT_MS)

      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (!stopping) finish('The microphone disconnected.')
        }, { once: true })
      }

      worklet.onprocessorerror = () => finish('Microphone audio was interrupted.')
      worklet.port.onmessage = ({ data }: MessageEvent<ArrayBuffer | 'flushed'>) => {
        if (closed || connection.readyState !== WebSocket.OPEN) return
        if (connection.bufferedAmount > MAX_BUFFERED_BYTES) {
          finish('The connection is too slow to stream microphone audio.')
          return
        }
        if (data === 'flushed') {
          const command: TranscriptionClientCommand = { type: 'stop' }
          connection.send(JSON.stringify(command))
        } else {
          connection.send(data)
        }
      }

      connection.onmessage = ({ data }: MessageEvent<string>) => {
        if (closed) return
        try {
          const message = JSON.parse(data) as TranscriptionServerMessage
          switch (message.type) {
            case 'ready':
              if (ready) break
              clearTimeout(timeout)
              microphone.connect(worklet)
              worklet.connect(context.destination)
              ready = true
              options.onReady()
              break
            case 'segment':
              options.onSegment(message.segment)
              break
            case 'finished':
              finish()
              break
            case 'error':
              finish(message.message)
              break
          }
        } catch {
          finish('The transcription stream could not continue.')
        }
      }

      connection.onerror = () => finish('Could not connect to the transcription service.')
      connection.onclose = () => finish('The transcription connection closed unexpectedly.')
    } catch (error) {
      finish(getCaptureError(error))
    }
  }

  function stop() {
    if (!closed && !stopping) {
      stopping = true
      if (ready && recorder) {
        stopTracks(stream)
        recorder.port.postMessage('flush')
        timeout = setTimeout(() => finish('The last transcript segment did not finish in time.'), FINISH_TIMEOUT_MS)
      } else {
        finish()
      }
    }
    return completed
  }

  return { start, stop, dispose: () => finish(undefined, false) }
}

function stopTracks(stream?: MediaStream) {
  for (const track of stream?.getTracks() ?? []) track.stop()
}
