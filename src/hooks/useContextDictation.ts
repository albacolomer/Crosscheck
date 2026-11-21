import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParsedPreparation } from '../../shared/preparation.ts'
import { parsePreparation } from '../services/preparation/parsePreparation.ts'
import { useAudioTranscription } from './useAudioTranscription.ts'

export type DictationPhase = 'idle' | 'connecting' | 'recording' | 'stopping' | 'processing'

type ContextDictationOptions = {
  knownTopics: string[]
  onResult: (result: ParsedPreparation) => void
}

/**
 * Records a spoken interview brief with live transcription, then sends the final transcript to
 * the backend parser and hands the extracted context to `onResult`.
 */
export function useContextDictation({ knownTopics, onResult }: ContextDictationOptions) {
  const { status, segments, error: transcriptionError, start: startTranscription, stop: stopTranscription } = useAudioTranscription()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // After a stop, this hook reports the outcome itself instead of the transcription error.
  const [stopped, setStopped] = useState(false)
  const onResultRef = useRef(onResult)
  const knownTopicsRef = useRef(knownTopics)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    onResultRef.current = onResult
    knownTopicsRef.current = knownTopics
  })

  useEffect(() => () => requestRef.current?.abort(), [])

  const start = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    setProcessing(false)
    setError(null)
    setStopped(false)
    startTranscription()
  }, [startTranscription])

  const stop = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setStopped(true)
    setProcessing(true)
    try {
      const finals = await stopTranscription()
      const transcript = finals.map(({ text }) => text.trim()).filter(Boolean).join(' ')
      if (controller.signal.aborted) return
      if (!transcript) {
        setError('No speech was captured. Try again.')
        return
      }
      const result = await parsePreparation({ transcript, knownTopics: knownTopicsRef.current }, controller.signal)
      if (controller.signal.aborted) return
      if (!result.interviewees.length && !result.topics.length && !result.notes.length) {
        setError('Nothing to fill in was found in the dictation. Try naming the person and topics.')
      } else {
        onResultRef.current(result)
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not process the dictation.')
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setProcessing(false)
      }
    }
  }, [stopTranscription])

  const phase: DictationPhase = status === 'connecting' || status === 'recording' || status === 'stopping'
    ? status
    : processing ? 'processing' : 'idle'

  return {
    phase,
    transcript: segments.map(({ text }) => text.trim()).filter(Boolean).join(' '),
    error: error ?? (stopped ? null : transcriptionError),
    start,
    stop: () => { void stop() },
  }
}
