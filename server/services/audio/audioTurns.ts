import { TRANSCRIPTION_SAMPLE_RATE } from '../../../shared/audio-transcription.ts'

const bytesPerMs = TRANSCRIPTION_SAMPLE_RATE * 2 / 1000
const preRollBytes = bytesPerMs * 200
const pauseBytes = bytesPerMs * 600
const maxTurnBytes = bytesPerMs * 12_000
const minCommitBytes = bytesPerMs * 100
const speechThreshold = 0.01
const emptyAudio = Buffer.alloc(0)

interface Turn {
  timestampMs: number
  length: number
  silence: number
}

function hasSpeech(frame: Buffer) {
  let energy = 0
  for (let offset = 0; offset < frame.length; offset += 2) {
    const sample = frame.readInt16LE(offset) / 32768
    energy += sample * sample
  }
  return energy / (frame.length / 2) >= speechThreshold ** 2
}

export function createAudioTurns(append: (frame: Buffer) => void, commit: (timestampMs: number) => void) {
  let preRoll = emptyAudio
  let capturedBytes = 0
  let turn: Turn | undefined

  function flush() {
    if (!turn) return

    const { length, timestampMs } = turn
    turn = undefined
    if (length < minCommitBytes) append(Buffer.alloc(minCommitBytes - length))
    commit(timestampMs)
  }

  function push(frame: Buffer) {
    const speech = hasSpeech(frame)
    const frameStart = capturedBytes
    capturedBytes += frame.length

    if (!turn) {
      if (!speech) {
        preRoll = Buffer.concat([preRoll, frame]).subarray(-preRollBytes)
        return
      }

      turn = {
        timestampMs: Math.round((frameStart - preRoll.length) / bytesPerMs),
        length: preRoll.length,
        silence: 0,
      }
      if (preRoll.length) append(preRoll)
      preRoll = emptyAudio
    }

    append(frame)
    turn.length += frame.length
    turn.silence = speech ? 0 : turn.silence + frame.length
    if (turn.silence >= pauseBytes || turn.length >= maxTurnBytes) flush()
  }

  return {
    push,
    flush,
    get timestampMs() {
      return turn?.timestampMs ?? Math.round(capturedBytes / bytesPerMs)
    },
  }
}
