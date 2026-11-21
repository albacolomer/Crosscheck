import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import type { ClaimCheck } from '../../../shared/types'
import { demoInterview, demoTranscript, formatTimestamp } from '../live/mock-data'

interface InsightsPageProps {
  checks: ClaimCheck[]
  onBack: () => void
}

type ClaimState = ClaimCheck['status']

const stateColors: Record<ClaimState, string> = {
  SUPPORTED: '#198754',
  CONTRADICTED: '#dc2626',
  MISLEADING: '#ea580c',
  UNVERIFIED: '#858b95',
  CHECKING: '#6366f1',
}

const claimTitles: Record<string, string> = {
  c1: '18% transport investment',
  c2: '40% lower pollution',
  c3: 'Bike lanes in every district',
  c4: 'Madrid population',
  c5: 'Bus ridership growth',
}

const laneDefinitions: { label: string; states: ClaimState[] }[] = [
  { label: 'Supported', states: ['SUPPORTED'] },
  { label: 'Needs review', states: ['CONTRADICTED', 'MISLEADING'] },
  { label: 'Uncertain', states: ['UNVERIFIED', 'CHECKING'] },
]

export function InsightsPage({ checks, onBack }: InsightsPageProps) {
  const [completedActions, setCompletedActions] = useState<string[]>([])
  const speakers = useMemo(() => getSpeakerStats(checks), [checks])
  const countFor = (status: ClaimState) => checks.filter((check) => check.status === status).length
  const supportedCount = countFor('SUPPORTED')
  const reviewCount = countFor('CONTRADICTED') + countFor('MISLEADING')
  const uncertainCount = countFor('UNVERIFIED') + countFor('CHECKING')
  const durationMs = Math.max(...demoTranscript.map((segment) => segment.timestampMs))
  const findings = checks
    .filter((check) => check.status === 'CONTRADICTED' || check.status === 'MISLEADING' || check.status === 'UNVERIFIED')
    .sort((a, b) => priorityFor(b.status) - priorityFor(a.status))
    .slice(0, 3)
  const nextSteps = checks
    .filter((check) => check.status === 'CONTRADICTED' || check.status === 'MISLEADING' || check.status === 'UNVERIFIED')
    .map((check) => ({ id: check.id, text: check.suggestedQuestions[0]?.text }))
    .filter((item): item is { id: string; text: string } => Boolean(item.text))

  function exportSummary() {
    const rows = [
      `Interview: ${demoInterview.title}`,
      `Interviewee: ${demoInterview.intervieweeName}`,
      `Duration: ${formatTimestamp(durationMs)}`,
      `Claims detected: ${checks.length}`,
      `Supported: ${supportedCount}`,
      `Contradicted: ${countFor('CONTRADICTED')}`,
      `Misleading: ${countFor('MISLEADING')}`,
      `Unverified: ${countFor('UNVERIFIED')}`,
      `Checking: ${countFor('CHECKING')}`,
      '',
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
        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-7">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">Interview: {demoInterview.title}</h1>
            <p className="mt-0.5 text-[10px] text-slate-500">Insights · 21 Nov 2026 · {formatDuration(durationMs)} · English</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 sm:text-xs"><FileText size={14} /> Open transcript</button>
            <button onClick={exportSummary} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-bold text-white hover:bg-slate-700 sm:text-xs"><ArrowDownToLine size={14} /> Export</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1040px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <MetricCard label="Claims detected" value={checks.length} detail={`in ${formatDuration(durationMs)}`} icon={<FileText size={15} />} tone="slate" />
          <MetricCard label="Supported" value={supportedCount} detail={`${percent(supportedCount, checks.length)}% of claims`} icon={<CheckCircle2 size={15} />} tone="green" />
          <MetricCard label="Needs review" value={reviewCount} detail={`${countFor('CONTRADICTED')} contradicted · ${countFor('MISLEADING')} misleading`} icon={<ShieldAlert size={15} />} tone="red" />
          <MetricCard label="Uncertain / checking" value={uncertainCount} detail={`${countFor('UNVERIFIED')} unverified · ${countFor('CHECKING')} pending`} icon={<CircleHelp size={15} />} tone="gray" />
        </section>

        <section className="mt-3 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
          <TimelinePanel checks={checks} durationMs={durationMs} />
          <SpeakerPanel speakers={speakers} />
        </section>

        <section className="mt-3 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.9fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2"><TriangleAlert size={15} className="text-slate-500" /><h2 className="text-xs font-bold">Key findings</h2></div>
            <div className="space-y-3">
              {findings.length > 0 ? findings.map((check) => <Finding key={check.id} check={check} />) : <p className="text-xs text-slate-500">No claims need follow-up.</p>}
              {supportedCount > 0 && <div className="flex items-start gap-2.5 text-[11px] leading-[1.55] text-slate-700"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Check size={12} /></span><span>{supportedCount} claim{supportedCount === 1 ? '' : 's'} supported by the available sources.</span></div>}
            </div>
          </div>

          <div className="rounded-xl bg-[#17181c] p-4 text-white sm:p-5">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-300">Overall takeaway</p>
            <h2 className="mt-2 text-base font-bold leading-[1.35] sm:text-lg">The budget figure is supported. Other claims need context or follow-up.</h2>
            <div className="mt-4 space-y-2.5">
              {nextSteps.map((step) => {
                const done = completedActions.includes(step.id)
                return <label key={step.id} className="flex cursor-pointer items-start gap-2.5 text-[10px] leading-[1.5] text-slate-200 sm:text-[11px]">
                  <input type="checkbox" checked={done} onChange={() => toggleAction(step.id)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-cyan-400" />
                  <span className={done ? 'text-slate-500 line-through' : ''}>{step.text}</span>
                </label>
              })}
            </div>
          </div>
        </section>

        <p className="mt-3 text-[9px] leading-4 text-slate-500">Demo data only. Verdicts apply to individual statements and do not measure a speaker’s overall accuracy.</p>
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
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600"><span className={`grid h-5 w-5 place-items-center rounded-md ${tones[tone]}`}>{icon}</span>{label}</div>
      <p className="mt-2 text-3xl font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 truncate text-[9px] text-slate-500">{detail}</p>
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold">Claims during the interview</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500">
          <LegendDot color={stateColors.SUPPORTED} label="Supported" />
          <LegendDot color={stateColors.MISLEADING} label="Needs review" />
          <LegendDot color={stateColors.UNVERIFIED} label="Uncertain" />
        </div>
      </div>

      <div className="mt-3">
        {lanes.map((lane) => <div key={lane.label} className="grid min-h-[48px] grid-cols-[76px_minmax(0,1fr)] items-center border-b border-slate-100 py-2">
          <span className="text-[9px] font-medium text-slate-600">{lane.label}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
            {lane.checks.map((check) => (
              <div key={check.id} className="inline-flex min-w-0 items-center gap-1.5 text-[9px] text-slate-600" title={check.normalizedClaim}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${check.status === 'CONTRADICTED' ? 'rounded-[2px]' : ''}`} style={{ backgroundColor: stateColors[check.status] }} />
                <span className="shrink-0 font-mono text-slate-500">{formatTimestamp(check.timestampMs)}</span>
                <span className="max-w-[170px] truncate">{claimTitles[check.id] ?? check.normalizedClaim}</span>
              </div>
            ))}
          </div>
        </div>)}
        <div className="ml-[76px] mt-1 flex justify-between text-[8px] text-slate-400">{ticks.map((tick, index) => <span key={`${tick}-${index}`}>{formatTimestamp(tick)}</span>)}</div>
      </div>
      <p className="mt-2 text-[9px] text-slate-500">All {checks.length} claims were detected within {formatDuration(durationMs)}.</p>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>
}

interface SpeakerStats {
  name: string
  total: number
  counts: Record<ClaimState, number>
}

function getSpeakerStats(checks: ClaimCheck[]): SpeakerStats[] {
  const bySpeaker = new Map<string, SpeakerStats>()
  const emptyCounts = (): SpeakerStats['counts'] => ({ SUPPORTED: 0, CONTRADICTED: 0, MISLEADING: 0, UNVERIFIED: 0, CHECKING: 0 })
  for (const segment of demoTranscript) {
    if (segment.speaker && !bySpeaker.has(segment.speaker)) bySpeaker.set(segment.speaker, { name: segment.speaker, total: 0, counts: emptyCounts() })
  }
  for (const check of checks) {
    const segment = demoTranscript.find((item) => item.text === check.originalQuote)
    if (!segment?.speaker) continue
    const speaker = bySpeaker.get(segment.speaker)
    if (!speaker) continue
    speaker.total += 1
    speaker.counts[check.status] += 1
  }
  return [...bySpeaker.values()].sort((a, b) => b.total - a.total)
}

const donutOrder: ClaimState[] = ['SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'UNVERIFIED', 'CHECKING']

function SpeakerPanel({ speakers }: { speakers: SpeakerStats[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-xs font-bold">Speakers</h2>
      <div className="mt-2 divide-y divide-slate-100">
        {speakers.map((speaker) => <SpeakerCard key={speaker.name} speaker={speaker} />)}
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
    <article className="flex items-center gap-3 py-3 first:pt-2 last:pb-1">
      <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[8px] grid place-items-center rounded-full bg-white text-center"><span className="text-[12px] font-bold text-slate-900">{speaker.total || '—'}<span className="block text-[7px] font-medium text-slate-400">claims</span></span></div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[11px] font-bold text-slate-800">{speaker.name}</h3>
        <p className="mt-0.5 text-[9px] text-slate-500">{speaker.name === demoInterview.intervieweeName ? 'Interviewee' : 'Interviewer'}</p>
        <p className="mt-1 text-[9px] leading-[1.4] text-slate-600">{speaker.total ? summary : 'No factual claims detected'}</p>
        {speaker.total > 0 && <p className="mt-0.5 text-[9px] font-semibold text-emerald-700">{correctRate}% of checked claims supported</p>}
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
    <article className="flex items-start gap-2.5 text-[10px] leading-[1.55] text-slate-700">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${colors}`}><Icon size={12} /></span>
      <div className="min-w-0 flex-1">
        <p><span className="font-bold">{verdict}:</span> {check.normalizedClaim}</p>
        <p className="mt-0.5 text-slate-500">{check.explanation}</p>
        {check.evidence[0] && <a href={check.evidence[0].url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-cyan-800">{check.evidence[0].title}<ExternalLink size={9} /></a>}
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
