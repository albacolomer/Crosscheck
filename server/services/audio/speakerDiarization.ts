import OpenAI, { toFile } from 'openai'
import type { TranscriptionDiarized } from 'openai/resources/audio/transcriptions'
import { TRANSCRIPTION_SAMPLE_RATE } from '../../../shared/audio-transcription.ts'

// Realtime transcription sessions do not return speaker labels, so each finished turn is labeled
// afterwards by the diarizing file transcription model. https://developers.openai.com/api/docs/guides/speech-to-text
const diarizationModel = 'gpt-4o-transcribe-diarize'
const bytesPerMs = TRANSCRIPTION_SAMPLE_RATE * 2 / 1000
/** The API accepts up to four known speakers with 2–10 second reference clips. */
const maxSpeakers = 4
const minReferenceMs = 2_100
const maxReferenceMs = 9_500
/** References shorter than this are replaced when a longer single-voice turn arrives. */
const goodReferenceMs = 5_000
/** Unknown voices shorter than this are treated as noise or crosstalk, not as a new speaker. */
const minNewSpeakerMs = 800
const minTurnMs = 300
const requestTimeoutMs = 20_000

interface KnownSpeaker {
  label: string
  reference: string
  referenceMs: number
}

interface VoiceSpan {
  ms: number
  firstStart: number
  audio: Buffer[]
}

export type SpeakerIdentifier = (pcm: Buffer) => Promise<string | undefined>

export function toWav(pcm: Buffer) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(TRANSCRIPTION_SAMPLE_RATE, 24)
  header.writeUInt32LE(TRANSCRIPTION_SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function durationMs(pcm: Buffer) {
  return pcm.length / bytesPerMs
}

function sliceSeconds(pcm: Buffer, start: number, end: number) {
  const byteAt = (seconds: number) => Math.min(pcm.length, Math.max(0, Math.round(seconds * 1000 * bytesPerMs / 2) * 2))
  return pcm.subarray(byteAt(start), byteAt(end))
}

function toReference(pcm: Buffer) {
  const maxBytes = Math.floor(maxReferenceMs * bytesPerMs / 2) * 2
  const minBytes = Math.ceil(minReferenceMs * bytesPerMs / 2) * 2
  let clip = pcm.subarray(0, maxBytes)
  // Short first turns are padded with silence so the voice can be enrolled immediately.
  if (clip.length < minBytes) clip = Buffer.concat([clip, Buffer.alloc(minBytes - clip.length)])
  return { reference: 'data:audio/wav;base64,' + toWav(clip).toString('base64'), referenceMs: durationMs(clip) }
}

function groupVoices(pcm: Buffer, result: TranscriptionDiarized) {
  const voices = new Map<string, VoiceSpan>()
  for (const segment of result.segments ?? []) {
    if (!segment.speaker || !(segment.end > segment.start)) continue
    const voice = voices.get(segment.speaker) ?? { ms: 0, firstStart: segment.start, audio: [] }
    voice.ms += (segment.end - segment.start) * 1000
    voice.audio.push(sliceSeconds(pcm, segment.start, segment.end))
    voices.set(segment.speaker, voice)
  }
  return [...voices.entries()].sort(([, a], [, b]) => a.firstStart - b.firstStart)
}

/**
 * Labels the dominant voice of each finished turn as `Speaker 1`, `Speaker 2`, ... in order of first appearance.
 * The first audio of each new voice becomes a known-speaker reference, so later requests keep the same labels.
 * Calls run one at a time because each new voice changes the references used by the next request.
 */
export function createSpeakerIdentifier(apiKey: string): SpeakerIdentifier {
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: requestTimeoutMs })
  const speakers: KnownSpeaker[] = []
  let queue: Promise<unknown> = Promise.resolve()

  async function identifyNow(pcm: Buffer) {
    if (durationMs(pcm) < minTurnMs) return undefined
    const known = speakers.slice()
    const result: TranscriptionDiarized = await client.audio.transcriptions.create({
      file: await toFile(toWav(pcm), 'turn.wav', { type: 'audio/wav' }),
      model: diarizationModel,
      response_format: 'diarized_json',
      chunking_strategy: durationMs(pcm) > 30_000 ? 'auto' : undefined,
      ...(known.length ? {
        known_speaker_names: known.map(({ label }) => label),
        known_speaker_references: known.map(({ reference }) => reference),
      } : {}),
    }) as unknown as TranscriptionDiarized

    const voices = groupVoices(pcm, result)
    const labels = new Map<string, string>()
    for (const [name, voice] of voices) {
      const speaker = known.find(({ label }) => label === name)
      if (speaker) {
        labels.set(name, speaker.label)
        // A clean single-voice turn can improve a short or padded reference.
        if (voices.length === 1 && speaker.referenceMs < goodReferenceMs && durationMs(pcm) > speaker.referenceMs) {
          Object.assign(speaker, toReference(pcm))
        }
      } else if (speakers.length < maxSpeakers && voice.ms >= minNewSpeakerMs) {
        const label = 'Speaker ' + (speakers.length + 1)
        speakers.push({ label, ...toReference(voices.length === 1 ? pcm : Buffer.concat(voice.audio)) })
        labels.set(name, label)
      }
    }

    let dominant: { label: string; ms: number } | undefined
    for (const [name, voice] of voices) {
      const label = labels.get(name)
      if (label && (!dominant || voice.ms > dominant.ms)) dominant = { label, ms: voice.ms }
    }
    return dominant?.label
  }

  return (pcm) => {
    const result = queue.then(() => identifyNow(pcm))
    queue = result.catch(() => undefined)
    return result
  }
}
