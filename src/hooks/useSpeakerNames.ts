import { useCallback, useMemo, useState } from 'react'
import type { TranscriptSegment } from '../../shared/types'
import { identifySpeakers, speakerCandidates, type Participant } from '../lib/speakers'

/** Maps server speaker labels to participant names, with user reassignment for the current interview. */
export function useSpeakerNames(participants: Participant[], transcript: TranscriptSegment[]) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const candidates = useMemo(() => speakerCandidates(participants), [participants])
  const speakers = useMemo(() => identifySpeakers(transcript, candidates, overrides), [transcript, candidates, overrides])

  const namedTranscript = useMemo(() => {
    const names = new Map(speakers.map(({ label, name }) => [label, name]))
    return transcript.map((segment) => {
      const name = segment.speaker ? names.get(segment.speaker.trim()) : undefined
      return name ? { ...segment, speaker: name } : segment
    })
  }, [transcript, speakers])

  const rename = useCallback((label: string, name: string) => {
    setOverrides((current) => ({ ...current, [label]: name }))
  }, [])

  const swap = useCallback(() => {
    if (speakers.length !== 2) return
    const [first, second] = speakers
    setOverrides((current) => ({ ...current, [first.label]: second.name, [second.label]: first.name }))
  }, [speakers])

  return { speakers, candidates, namedTranscript, rename, swap }
}

export type SpeakerNames = ReturnType<typeof useSpeakerNames>
