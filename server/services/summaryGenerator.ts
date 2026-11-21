/**
 * P4-D — deterministic interview summary.
 *
 * Pure function over the checks it receives: no I/O, no model calls, no input mutation.
 * Every string in the output is copied from existing check data (claims, explanations,
 * suggested questions); nothing is inferred or invented.
 */
import type { QuestionType, Verdict } from '../../shared/types.ts'
import type { ClaimCheck, PipelineSummary, SummarizeInterview, SummaryInput } from './pipeline/contracts.ts'

const MAX_KEY_FINDINGS = 8
const MAX_FOLLOW_UP_QUESTIONS = 10
const MAX_EXPLANATION_LENGTH = 220

/** Lower rank = more important. */
const verdictRank: Record<Verdict, number> = { CONTRADICTED: 0, MISLEADING: 1, UNVERIFIED: 2, SUPPORTED: 3 }
const questionRank: Record<QuestionType, number> = { challenge: 0, follow_up: 1, context: 2 }
const findingLabel: Record<Exclude<Verdict, 'UNVERIFIED'>, string> = {
  CONTRADICTED: 'Contradicted',
  MISLEADING: 'Misleading',
  SUPPORTED: 'Supported',
}

type FinalCheck = ClaimCheck & { status: Verdict }

const clean = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()
const normalize = (text: string) => clean(text.normalize('NFKC')).toLocaleLowerCase()
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Importance (verdict), then recording time, then id: a total order for identical output. */
function compareChecks(a: FinalCheck, b: FinalCheck) {
  return verdictRank[a.status] - verdictRank[b.status] || a.timestampMs - b.timestampMs || compareText(a.id, b.id)
}

function isFinal(check: ClaimCheck): check is FinalCheck {
  return check.status !== 'CHECKING'
}

function distinct(texts: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const text of texts) {
    const key = normalize(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function keyFinding(check: FinalCheck & { status: Exclude<Verdict, 'UNVERIFIED'> }) {
  const claim = clean(check.normalizedClaim)
  const explanation = truncate(clean(check.explanation), MAX_EXPLANATION_LENGTH)
  return explanation ? `${findingLabel[check.status]}: ${claim} — ${explanation}` : `${findingLabel[check.status]}: ${claim}`
}

function followUpQuestions(checks: FinalCheck[]) {
  const candidates = checks.flatMap((check, checkOrder) =>
    (check.suggestedQuestions ?? []).map((question, questionOrder) => ({
      text: clean(question.text),
      rank: questionRank[question.type] ?? Object.keys(questionRank).length,
      checkOrder,
      questionOrder,
    })),
  )
  candidates.sort((a, b) => a.rank - b.rank || a.checkOrder - b.checkOrder || a.questionOrder - b.questionOrder)
  return distinct(candidates.map(candidate => candidate.text)).slice(0, MAX_FOLLOW_UP_QUESTIONS)
}

export const summarizeInterview: SummarizeInterview = (input: SummaryInput): PipelineSummary => {
  const checks = input.checks ?? []
  const final = checks.filter(isFinal).slice().sort(compareChecks)
  const count = (status: Verdict) => final.filter(check => check.status === status).length

  const contradictions = distinct(
    final
      .filter(check => check.status === 'CONTRADICTED' || check.status === 'MISLEADING')
      .map(check => clean(check.normalizedClaim)),
  )
  const needsResearch = distinct(final.filter(check => check.status === 'UNVERIFIED').map(check => clean(check.normalizedClaim)))
  const keyFindings = final
    .filter((check): check is FinalCheck & { status: Exclude<Verdict, 'UNVERIFIED'> } => check.status !== 'UNVERIFIED')
    .map(keyFinding)
    .slice(0, MAX_KEY_FINDINGS)
  const questions = followUpQuestions(final)

  let unansweredQuestions: string[] = []
  if (input.answeredQuestions) {
    const answered = new Set(input.answeredQuestions.map(normalize))
    unansweredQuestions = questions.filter(question => !answered.has(normalize(question)))
  }

  return {
    totalClaims: final.length,
    supported: count('SUPPORTED'),
    contradicted: count('CONTRADICTED'),
    misleading: count('MISLEADING'),
    unverified: count('UNVERIFIED'),
    pendingClaims: checks.length - final.length,
    keyFindings,
    unansweredQuestions,
    contradictions,
    needsResearch,
    followUpQuestions: questions,
  }
}
