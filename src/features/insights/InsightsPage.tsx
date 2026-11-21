import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import type { InterviewSummary, ProcessingJob, SummaryResponse } from '../../../shared/api'
import type { ClaimCheck, TranscriptSegment } from '../../../shared/types'
import { formatTimestamp } from '../live/mock-data'

interface InsightsPageProps {
  interviewId?: string
  createdAt?: number
  title: string
  intervieweeName: string
  transcript: TranscriptSegment[]
  checks: ClaimCheck[]
  jobs: ProcessingJob[]
  onBack: () => void
  onRestart: () => void
}

type ClaimState = ClaimCheck['status']

const stateColors: Record<ClaimState, string> = {
  SUPPORTED: '#198754',
  CONTRADICTED: '#dc2626',
  MISLEADING: '#ea580c',
  UNVERIFIED: '#858b95',
  CHECKING: '#6366f1',
}

const laneDefinitions: { label: string; states: ClaimState[] }[] = [
  { label: 'Supported', states: ['SUPPORTED'] },
  { label: 'Needs review', states: ['CONTRADICTED', 'MISLEADING'] },
  { label: 'Uncertain', states: ['UNVERIFIED', 'CHECKING'] },
]

export function InsightsPage({ interviewId, createdAt, title, intervieweeName, transcript, checks: allChecks, jobs, onBack, onRestart }: InsightsPageProps) {
  const [completedActions, setCompletedActions] = useState<string[]>([])
  const summary = useInterviewSummary(interviewId, allChecks)
  // A failed job leaves a placeholder UNVERIFIED check; it is an operational failure, not a verdict.
  const failedClaimIds = new Set(jobs.filter((job) => job.kind === 'fact-check' && job.status === 'failed').map((job) => job.claimId))
  const checks = allChecks.filter((check) => !failedClaimIds.has(check.id))
  const failedCount = allChecks.length - checks.length
  const speakers = getSpeakerStats(checks, transcript, intervieweeName)
  const countFor = (status: ClaimState) => checks.filter((check) => check.status === status).length
  const counts = summary ?? {
    totalClaims: checks.length - countFor('CHECKING'), pendingClaims: countFor('CHECKING'), supported: countFor('SUPPORTED'),
    contradicted: countFor('CONTRADICTED'), misleading: countFor('MISLEADING'), unverified: countFor('UNVERIFIED'),
  }
  const claimCount = counts.totalClaims + counts.pendingClaims
  const supportedCount = counts.supported
  const reviewCount = counts.contradicted + counts.misleading
  const uncertainCount = counts.unverified + counts.pendingClaims
  const durationMs = transcript.reduce((max, segment) => Math.max(max, segment.timestampMs), 0)
  const findings = checks
    .filter((check) => check.status === 'CONTRADICTED' || check.status === 'MISLEADING' || check.status === 'UNVERIFIED')
    .sort((a, b) => priorityFor(b.status) - priorityFor(a.status))
    .slice(0, 3)
  const nextSteps = summary
    ? summary.followUpQuestions.map((text) => ({ id: text, text }))
    : checks
      .filter((check) => check.status === 'CONTRADICTED' || check.status === 'MISLEADING' || check.status === 'UNVERIFIED')
      .map((check) => ({ id: check.id, text: check.suggestedQuestions[0]?.text }))
      .filter((item): item is { id: string; text: string } => Boolean(item.text))

  function exportSummary() {
    const rows = [
      `Interview: ${title}`,
      `Interviewee: ${intervieweeName}`,
      `Duration: ${formatTimestamp(durationMs)}`,
      `Claims detected: ${claimCount}`,
      `Supported: ${supportedCount}`,
      `Contradicted: ${counts.contradicted}`,
      `Misleading: ${counts.misleading}`,
      `Unverified: ${counts.unverified}`,
      `Checking: ${counts.pendingClaims}`,
      `Failed checks: ${failedCount}`,
      '',
      ...(summary?.keyFindings.length ? ['Key findings:', ...summary.keyFindings, ''] : []),
      ...checks.map((check) => `${formatTimestamp(check.timestampMs)} | ${check.status} | ${check.normalizedClaim}`),
    ]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'crosscheck-interview-summary.txt'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  function toggleAction(id: string) {
    setCompletedActions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex min-h-[84px] flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 2xl:min-h-[96px] 2xl:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Interview: {title}</h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Insights{createdAt !== undefined && ` · ${new Date(createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`} · {formatDuration(durationMs)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm"><FileText size={18} /> Open transcript</button>
            <button onClick={onRestart} title="Start a new interview with the same context" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm"><RotateCcw size={18} /> New interview, same context</button>
            <button onClick={exportSummary} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 sm:text-sm"><ArrowDownToLine size={18} /> Export</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-6 sm:px-7 lg:px-9 2xl:max-w-[1760px] 2xl:px-10 2xl:pt-8">
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard label="Claims detected" value={claimCount} detail={`in ${formatDuration(durationMs)}`} icon={<FileText size={19} />} tone="slate" />
          <MetricCard label="Supported" value={supportedCount} detail={`${percent(supportedCount, claimCount)}% of claims`} icon={<CheckCircle2 size={19} />} tone="green" />
          <MetricCard label="Needs review" value={reviewCount} detail={`${counts.contradicted} contradicted · ${counts.misleading} misleading`} icon={<ShieldAlert size={19} />} tone="red" />
          <MetricCard label="Uncertain / checking" value={uncertainCount} detail={`${counts.unverified} unverified · ${counts.pendingClaims} pending`} icon={<CircleHelp size={19} />} tone="gray" />
        </section>

        <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
          <TimelinePanel checks={checks} durationMs={durationMs} />
          <SpeakerPanel speakers={speakers} />
        </section>

        <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,0.9fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5"><TriangleAlert size={20} className="text-slate-500" /><h2 className="text-base font-bold sm:text-lg">Key findings</h2></div>
            <div className="space-y-3">
              {findings.length > 0 ? findings.map((check) => <Finding key={check.id} check={check} />) : <p className="text-sm text-slate-500">No claims need follow-up.</p>}
              {supportedCount > 0 && <div className="flex items-start gap-3 text-sm leading-[1.55] text-slate-700"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Check size={17} /></span><span>{supportedCount} claim{supportedCount === 1 ? '' : 's'} supported by the available sources.</span></div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-100 p-5 text-slate-900 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Overall takeaway</p>
            <h2 className="mt-3 text-xl font-bold leading-[1.35] sm:text-2xl">{takeaway(claimCount, supportedCount, reviewCount, uncertainCount)}</h2>
            <div className="mt-5 space-y-3">
              {nextSteps.map((step) => {
                const done = completedActions.includes(step.id)
                return <label key={step.id} className="flex cursor-pointer items-start gap-3 text-sm leading-[1.5] text-slate-700 sm:text-base">
                  <input type="checkbox" checked={done} onChange={() => toggleAction(step.id)} className="mt-1 h-5 w-5 shrink-0 accent-slate-700" />
                  <span className={done ? 'text-slate-400 line-through' : ''}>{step.text}</span>
                </label>
              })}
            </div>
          </div>
        </section>

        {failedCount > 0 && <p className="mt-4 text-xs leading-5 text-rose-700">{failedCount} check{failedCount === 1 ? '' : 's'} could not be completed and {failedCount === 1 ? 'is' : 'are'} excluded from these results.</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Verdicts apply to individual statements and do not measure a speaker’s overall accuracy.</p>
      </div>
    </main>
  )
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: 'slate' | 'green' | 'red' | 'gray' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-slate-100 text-slate-600',
  }
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 2xl:p-6">
      <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 sm:text-sm 2xl:text-base"><span className={`grid h-7 w-7 place-items-center rounded-md ${tones[tone]}`}>{icon}</span>{label}</div>
      <p className="mt-3 text-4xl font-bold leading-none tracking-tight sm:text-5xl">{value}</p>
      <p className="mt-2 truncate text-xs text-slate-500 sm:text-sm">{detail}</p>
    </article>
  )
}

function TimelinePanel({ checks, durationMs }: { checks: ClaimCheck[]; durationMs: number }) {
  const lanes = laneDefinitions.map((lane) => ({
    ...lane,
    checks: checks.filter((check) => lane.states.includes(check.status)).sort((a, b) => a.timestampMs - b.timestampMs),
  }))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(durationMs * fraction))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold sm:text-lg">Claims during the interview</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 sm:text-sm">
          <LegendDot color={stateColors.SUPPORTED} label="Supported" />
          <LegendDot color={stateColors.MISLEADING} label="Needs review" />
          <LegendDot color={stateColors.UNVERIFIED} label="Uncertain" />
        </div>
      </div>

      <div className="mt-4">
        {lanes.map((lane) => <div key={lane.label} className="grid min-h-[60px] grid-cols-[104px_minmax(0,1fr)] items-center border-b border-slate-100 py-3 2xl:min-h-[72px] 2xl:grid-cols-[130px_minmax(0,1fr)]">
          <span className="text-xs font-medium text-slate-600 sm:text-sm">{lane.label}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            {lane.checks.map((check) => (
              <div key={check.id} className="inline-flex min-w-0 items-center gap-2 text-xs text-slate-600 sm:text-sm" title={check.normalizedClaim}>
                <span className={`h-3 w-3 shrink-0 rounded-full ${check.status === 'CONTRADICTED' ? 'rounded-[2px]' : ''}`} style={{ backgroundColor: stateColors[check.status] }} />
                <span className="shrink-0 font-mono text-slate-500">{formatTimestamp(check.timestampMs)}</span>
                <span className="max-w-[220px] truncate 2xl:max-w-[300px]">{check.normalizedClaim}</span>
              </div>
            ))}
          </div>
        </div>)}
        <div className="ml-[104px] mt-2 flex justify-between text-[10px] text-slate-400 2xl:ml-[130px] 2xl:text-xs">{ticks.map((tick, index) => <span key={`${tick}-${index}`}>{formatTimestamp(tick)}</span>)}</div>
      </div>
      <p className="mt-3 text-xs text-slate-500 sm:text-sm">All {checks.length} claims were detected within {formatDuration(durationMs)}.</p>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
}

interface SpeakerStats {
  name: string
  role: string
  total: number
  counts: Record<ClaimState, number>
}

const UNLABELLED_SPEAKER = 'Unlabelled speaker'

function getSpeakerStats(checks: ClaimCheck[], transcript: TranscriptSegment[], intervieweeName: string): SpeakerStats[] {
  const bySpeaker = new Map<string, SpeakerStats>()
  const emptyCounts = (): SpeakerStats['counts'] => ({ SUPPORTED: 0, CONTRADICTED: 0, MISLEADING: 0, UNVERIFIED: 0, CHECKING: 0 })
  const speakerOf = (segment: TranscriptSegment) => segment.speaker?.trim() || UNLABELLED_SPEAKER
  for (const segment of transcript) {
    const name = speakerOf(segment)
    if (segment.isFinal && !bySpeaker.has(name)) bySpeaker.set(name, { name, total: 0, counts: emptyCounts(), role: roleFor(name, intervieweeName) })
  }
  for (const check of checks) {
    const quote = check.originalQuote.trim().toLocaleLowerCase()
    const segment = quote ? transcript.find((item) => item.isFinal && item.text.toLocaleLowerCase().includes(quote)) : undefined
    if (!segment) continue
    const speaker = bySpeaker.get(speakerOf(segment))
    if (!speaker) continue
    speaker.total += 1
    speaker.counts[check.status] += 1
  }
  return [...bySpeaker.values()].sort((a, b) => b.total - a.total)
}

function roleFor(name: string, intervieweeName: string) {
  if (name === intervieweeName) return 'Interviewee'
  if (name === 'Journalist') return 'Interviewer'
  return name === UNLABELLED_SPEAKER ? 'Speaker not identified by transcription' : 'Speaker'
}

/** Latest backend summary (P4-D); refetched as checks change. Null until loaded or when unavailable. */
function useInterviewSummary(interviewId: string | undefined, checks: ClaimCheck[]) {
  const [loaded, setLoaded] = useState<{ interviewId: string; summary: InterviewSummary }>()
  const version = checks.map((check) => `${check.id}:${check.status}`).join('|')
  useEffect(() => {
    if (!interviewId) return
    const controller = new AbortController()
    fetch(`/api/interviews/${encodeURIComponent(interviewId)}/summary`, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<SummaryResponse> : null)
      .then((payload) => { if (payload?.summary) setLoaded({ interviewId, summary: payload.summary }) })
      .catch(() => { /* The page falls back to counting the snapshot's checks. */ })
    return () => controller.abort()
  }, [interviewId, version])
  return loaded && loaded.interviewId === interviewId ? loaded.summary : null
}

function takeaway(total: number, supported: number, review: number, uncertain: number) {
  if (!total) return 'No factual claims were detected in this interview.'
  if (review) return `${review} of ${total} claim${total === 1 ? '' : 's'} ${review === 1 ? 'needs' : 'need'} review before publication.`
  if (uncertain) return `${supported} claim${supported === 1 ? ' is' : 's are'} supported; ${uncertain} still ${uncertain === 1 ? 'needs' : 'need'} research.`
  return `All ${total} claim${total === 1 ? ' is' : 's are'} supported by the available sources.`
}

const donutOrder: ClaimState[] = ['SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'UNVERIFIED', 'CHECKING']

function SpeakerPanel({ speakers }: { speakers: SpeakerStats[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold sm:text-lg">Speakers</h2>
      <div className="mt-2 divide-y divide-slate-100">
        {speakers.length ? speakers.map((speaker) => <SpeakerCard key={speaker.name} speaker={speaker} />) : <p className="py-4 text-sm text-slate-500">No transcript was recorded.</p>}
      </div>
    </section>
  )
}

function SpeakerCard({ speaker }: { speaker: SpeakerStats }) {
  const gradient = makeDonut(speaker)
  const checked = speaker.total - speaker.counts.CHECKING
  const correctRate = checked ? Math.round((speaker.counts.SUPPORTED / checked) * 100) : 0
  const summary = donutOrder.filter((status) => speaker.counts[status] > 0).map((status) => `${speaker.counts[status]} ${shortState(status)}`).join(' · ')

  return (
    <article className="flex items-center gap-4 py-4 first:pt-3 last:pb-2">
      <div className="relative grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full 2xl:h-[92px] 2xl:w-[92px]" style={{ background: gradient }}>
        <div className="absolute inset-[10px] grid place-items-center rounded-full bg-white text-center 2xl:inset-3"><span className="text-base font-bold text-slate-900 2xl:text-lg">{speaker.total || '—'}<span className="block text-[9px] font-medium text-slate-400 2xl:text-[10px]">claims</span></span></div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-slate-800 sm:text-base">{speaker.name}</h3>
        <p className="mt-1 text-xs text-slate-500">{speaker.role}</p>
        <p className="mt-1 text-xs leading-[1.5] text-slate-600 sm:text-sm">{speaker.total ? summary : 'No factual claims detected'}</p>
        {speaker.total > 0 && <p className="mt-1 text-xs font-semibold text-emerald-700 sm:text-sm">{correctRate}% of checked claims supported</p>}
      </div>
    </article>
  )
}

function makeDonut(speaker: SpeakerStats) {
  if (!speaker.total) return '#edf0f3'
  let current = 0
  const stops = donutOrder.filter((status) => speaker.counts[status] > 0).map((status) => {
    const start = current
    current += (speaker.counts[status] / speaker.total) * 100
    return `${stateColors[status]} ${start}% ${current}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function shortState(status: ClaimState) {
  const labels: Record<ClaimState, string> = {
    SUPPORTED: 'supported',
    CONTRADICTED: 'contradicted',
    MISLEADING: 'misleading',
    UNVERIFIED: 'uncertain',
    CHECKING: 'checking',
  }
  return labels[status]
}

function priorityFor(status: ClaimState) {
  return status === 'CONTRADICTED' ? 3 : status === 'MISLEADING' ? 2 : 1
}

function Finding({ check }: { check: ClaimCheck }) {
  const colors = check.status === 'CONTRADICTED' ? 'bg-red-50 text-red-700' : check.status === 'MISLEADING' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-600'
  const Icon = check.status === 'CONTRADICTED' ? ShieldAlert : check.status === 'MISLEADING' ? TriangleAlert : CircleHelp
  const verdict = check.status === 'CONTRADICTED' ? 'Contradicted' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'

  return (
    <article className="flex items-start gap-3 text-sm leading-[1.6] text-slate-700 sm:text-base">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${colors}`}><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <p><span className="font-bold">{verdict}:</span> {check.normalizedClaim}</p>
        <p className="mt-0.5 text-slate-500">{check.explanation}</p>
        {check.evidence[0] && <a href={check.evidence[0].url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-cyan-800 sm:text-sm">{check.evidence[0].title}<ExternalLink size={14} /></a>}
      </div>
    </article>
  )
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.floor((durationMs % 60_000) / 1_000)
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`
}
