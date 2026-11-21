import type { TranscriptSegment } from '../../shared/types'

export type SpeakerRole = 'interviewer' | 'interviewee' | 'other'

export type Participant = { name: string; role: string }

export type SpeakerCandidate = { name: string; role: SpeakerRole }

export type SpeakerIdentity = SpeakerCandidate & {
  /** Label from the transcription server, such as `Speaker 1`. */
  label: string
  /** Position in order of first appearance, used for styling. */
  index: number
}

const interviewerRole = /\b(interviewer|journalist|reporter|host|moderator|entrevistador|entrevistadora|periodista|reportero|reportera|moderador|moderadora)\b/i
const serverLabel = /^Speaker (\d+)$/

/** Names a detected voice can take: the interviewer first, then each interviewee from preparation. */
export function speakerCandidates(participants: Participant[]): SpeakerCandidate[] {
  const people = participants
    .map((person) => ({ name: person.name.trim() || person.role.trim(), role: person.role.trim() }))
    .filter((person) => person.name)
  const interviewer = people.find((person) => interviewerRole.test(person.role))
  const interviewees = people.filter((person) => person !== interviewer)
  return [
    { name: interviewer?.name || 'Interviewer', role: 'interviewer' },
    ...(interviewees.length ? interviewees.map(({ name }) => ({ name, role: 'interviewee' as const })) : [{ name: 'Interviewee', role: 'interviewee' as const }]),
  ]
}

/**
 * The server labels voices `Speaker 1`, `Speaker 2`, ... in order of first appearance.
 * The first voice defaults to the interviewer, who usually opens the interview; the user can reassign names.
 */
export function identifySpeakers(transcript: TranscriptSegment[], candidates: SpeakerCandidate[], overrides: Record<string, string>) {
  const labels = [...new Set(transcript.map(({ speaker }) => speaker?.trim()).filter((label): label is string => Boolean(label)))]
  labels.sort((a, b) => (labelNumber(a) - labelNumber(b)) || 0)
  return labels.map((label, index): SpeakerIdentity => {
    const number = labelNumber(label)
    const fallback: SpeakerCandidate = label === 'Journalist'
      ? { name: 'Interviewer', role: 'interviewer' }
      : Number.isFinite(number) ? candidates[number - 1] ?? { name: label, role: 'other' } : { name: label, role: 'other' }
    const override = overrides[label]
    const chosen = override === undefined ? fallback : candidates.find(({ name }) => name === override) ?? { name: override, role: 'other' }
    return { ...chosen, label, index }
  })
}

function labelNumber(label: string) {
  const match = serverLabel.exec(label)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}
