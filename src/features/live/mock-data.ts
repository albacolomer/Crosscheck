import type { ClaimCheck, TranscriptSegment } from '../../../shared/types'

export const demoInterview = {
  title: 'The Future of Urban Transport',
  intervieweeName: 'Marta Ruiz',
  intervieweeRole: 'City Councillor for Mobility, Madrid City Council',
}

export const demoTranscript: TranscriptSegment[] = [
  {
    id: 't1',
    text: 'This year, we expanded the protected bike lane network to every district in the city.',
    isFinal: true,
    speaker: 'Marta Ruiz',
    timestampMs: 42_000,
  },
  {
    id: 't2',
    text: 'Our investment in public transport has increased by 18% compared with last year.',
    isFinal: true,
    speaker: 'Marta Ruiz',
    timestampMs: 68_000,
  },
  {
    id: 't3',
    text: 'According to our figures, bus ridership has grown steadily since January.',
    isFinal: true,
    speaker: 'Marta Ruiz',
    timestampMs: 91_000,
  },
  {
    id: 't4',
    text: 'Could you share the figures and explain how they compare with the same period last year?',
    isFinal: true,
    speaker: 'Journalist',
    timestampMs: 107_000,
  },
  {
    id: 't5',
    text: 'Pollution has already fallen by 40% thanks to the new measures.',
    isFinal: true,
    speaker: 'Marta Ruiz',
    timestampMs: 126_000,
  },
  {
    id: 't6',
    text: 'The city of Madrid has a population of more than ten million.',
    isFinal: true,
    speaker: 'Marta Ruiz',
    timestampMs: 145_000,
  },
  {
    id: 't7',
    text: 'And next year, we will be able to extend this model across the entire metropolitan area.',
    isFinal: false,
    speaker: 'Marta Ruiz',
    timestampMs: 163_000,
  },
]

export const demoChecks: ClaimCheck[] = [
  {
    id: 'c5',
    originalQuote: 'According to our figures, bus ridership has grown steadily since January.',
    normalizedClaim: 'Bus ridership in Madrid has grown steadily since January.',
    status: 'CHECKING',
    confidence: undefined,
    timestampMs: 91_000,
    evidence: [],
    suggestedQuestions: [],
  },
  {
    id: 'c1',
    originalQuote: 'Our investment in public transport has increased by 18% compared with last year.',
    normalizedClaim: 'The city budget for public transport increased by 18% year over year.',
    status: 'SUPPORTED',
    explanation: 'The approved city budget shows an increase close to 18% across public transport allocations. The figure depends on which budget lines are included.',
    confidence: 0.88,
    timestampMs: 68_000,
    evidence: [
      {
        title: '2025 City Budget: Mobility and Transport',
        url: 'https://www.madrid.es/',
        summary: 'Consolidated public transport allocations show a 17.8% year-over-year increase.',
        stance: 'supporting',
      },
      {
        title: 'City Council Budget Execution',
        url: 'https://transparencia.madrid.es/',
        summary: 'Actual spending may differ from the approved budget.',
        stance: 'supporting',
      },
    ],
    suggestedQuestions: [
      { type: 'challenge', text: 'Does the 18% refer to the approved budget or to spending already completed?' },
      { type: 'follow_up', text: 'Which specific budget lines account for the increase?' },
      { type: 'context', text: 'How has transport investment per resident changed over that period?' },
    ],
  },
  {
    id: 'c2',
    originalQuote: 'Pollution has already fallen by 40% thanks to the new measures.',
    normalizedClaim: 'The city measures reduced pollution by 40%.',
    status: 'MISLEADING',
    explanation: 'The cited figure appears to refer to one pollutant at one monitoring station. Citywide data show a smaller change and do not attribute the entire change to a single measure.',
    confidence: 0.76,
    timestampMs: 126_000,
    evidence: [
      {
        title: 'Air Quality: Data by Station and Pollutant',
        url: 'https://www.madrid.es/',
        summary: 'The maximum 40% reduction is reported for one monitoring station and a specific pollutant.',
        stance: 'supporting',
      },
      {
        title: 'Annual Air Quality Report',
        url: 'https://www.miteco.gob.es/',
        summary: 'The network-wide annual average shows a smaller reduction than the one claimed.',
        stance: 'contradicting',
      },
    ],
    suggestedQuestions: [
      { type: 'challenge', text: 'Which pollutant and monitoring station does the 40% figure refer to?' },
      { type: 'follow_up', text: 'How much of the reduction can be attributed to each measure?' },
      { type: 'context', text: 'What was the trend in the citywide average over the same period?' },
    ],
    suggestedStatement: 'The 40% figure appears to refer to one pollutant at one monitoring station; the citywide average shows a smaller decrease.',
  },
  {
    id: 'c3',
    originalQuote: 'This year, we expanded the protected bike lane network to every district in the city.',
    normalizedClaim: 'The protected bike lane network expanded this year in every district of Madrid.',
    status: 'UNVERIFIED',
    explanation: 'The available sources do not detail completed work in every district during the same period. A list of routes and opening dates is needed to verify the full scope.',
    confidence: 0.41,
    timestampMs: 42_000,
    evidence: [
      {
        title: 'Cycling Mobility Plan',
        url: 'https://www.madrid.es/',
        summary: 'The plan lists proposed work but does not confirm completion in every district.',
        stance: 'contradicting',
      },
    ],
    suggestedQuestions: [
      { type: 'challenge', text: 'Could you list the bike lane section opened this year in each district?' },
      { type: 'follow_up', text: 'How many new kilometers are already open to cyclists?' },
      { type: 'context', text: 'Which projects are still pending, and when are they due?' },
    ],
    suggestedStatement: 'I could not confirm that a new protected bike lane opened in every district this year.',
  },
  {
    id: 'c4',
    originalQuote: 'The city of Madrid has a population of more than ten million.',
    normalizedClaim: 'The municipality of Madrid has more than 10 million residents.',
    status: 'CONTRADICTED',
    explanation: 'The claim is far above the population recorded for the municipality. It is important to distinguish the city of Madrid from its metropolitan area.',
    confidence: 0.97,
    timestampMs: 145_000,
    evidence: [
      {
        title: 'Official Population Figures',
        url: 'https://www.ine.es/',
        summary: 'Official figures place the municipality’s population well below ten million.',
        stance: 'contradicting',
      },
    ],
    suggestedQuestions: [
      { type: 'challenge', text: 'Are you referring to the municipality of Madrid or the wider metropolitan area?' },
      { type: 'follow_up', text: 'Which source and date are you using for that population figure?' },
      { type: 'context', text: 'How many people live in the municipality according to the latest official count?' },
    ],
    suggestedStatement: 'Official figures show the municipality has far fewer than 10 million residents; are you referring to the metropolitan area?',
  },
]

export function formatTimestamp(timestampMs: number) {
  const minutes = Math.floor(timestampMs / 60_000)
  const seconds = Math.floor((timestampMs % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
