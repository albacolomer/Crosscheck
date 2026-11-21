import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ExternalLink,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { ClaimCheck, Verdict } from '../../../shared/types'
import { demoInterview, formatTimestamp } from '../live/mock-data'

interface InsightsPageProps {
  checks: ClaimCheck[]
  onBack: () => void
}

const stats: { status: Verdict; label: string; color: string; icon: typeof ShieldCheck }[] = [
  { status: 'SUPPORTED', label: 'Supported', color: 'text-emerald-700 bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  { status: 'CONTRADICTED', label: 'Contradicted', color: 'text-rose-700 bg-rose-50 border-rose-100', icon: ShieldAlert },
  { status: 'MISLEADING', label: 'Misleading', color: 'text-amber-800 bg-amber-50 border-amber-100', icon: TriangleAlert },
  { status: 'UNVERIFIED', label: 'Unverified', color: 'text-slate-600 bg-slate-100 border-slate-200', icon: CircleHelp },
]

export function InsightsPage({ checks, onBack }: InsightsPageProps) {
  const countFor = (status: Verdict) => checks.filter((check) => check.status === status).length
  const keyChecks = checks
    .filter((check) => check.status === 'MISLEADING' || check.status === 'CONTRADICTED' || check.status === 'UNVERIFIED')
    .sort((a, b) => b.timestampMs - a.timestampMs)

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white"><ShieldCheck size={19} /></span>
            <span className="text-[17px] font-bold tracking-tight">crosscheck<span className="text-cyan-600">.</span></span>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Demo summary</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-14 pt-8 sm:px-8 sm:pt-12">
        <button onClick={onBack} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft size={16} /> Back to interview</button>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">INTERVIEW ENDED</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Interview insights</h1>
            <p className="mt-3 text-sm text-slate-500">{demoInterview.title} <span className="px-1.5 text-slate-300">·</span> {demoInterview.intervieweeName}, {demoInterview.intervieweeRole}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 size={14} /> 02:43 interview</div>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold text-slate-500">Claims detected</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{checks.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">in this interview</p>
          </div>
          {stats.map(({ status, label, color, icon: Icon }) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${color}`}><Icon size={16} /></span>
              <p className="mt-3 text-3xl font-bold tracking-tight">{countFor(status)}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,0.65fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Sparkles size={17} className="text-cyan-700" /><h2 className="text-sm font-bold">Key findings</h2></div>
            <div className="divide-y divide-slate-100">
              {keyChecks.length > 0 ? keyChecks.map((check) => <Finding key={check.id} check={check} />) : <p className="p-5 text-sm text-slate-500">No key findings to highlight.</p>}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><CircleHelp size={17} className="text-violet-700" /><h2 className="text-sm font-bold">Further research</h2></div>
              <ul className="space-y-3 p-5 text-[13px] leading-[1.6] text-slate-600">
                <li className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />Request a list of bike lane sections opened by district and date.</li>
                <li className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />Clarify whether the budget increase refers to approved spending or actual expenditure.</li>
                <li className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />Request air quality data broken down by monitoring station and pollutant.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
              <div className="flex items-center gap-2 text-cyan-900"><Flag size={16} /><h2 className="text-sm font-bold">Overall takeaways</h2></div>
              <p className="mt-2 text-[13px] leading-[1.65] text-slate-600">The conversation included quantitative claims about investment and air quality. One needs context about how it was measured; another needs more specific sources to verify.</p>
            </div>
          </aside>
        </section>

        <div className="mt-7 flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 sm:flex-row sm:items-center">
          <span className="flex items-start gap-2"><TriangleAlert size={15} className="mt-0.5 shrink-0" />Demo content only; this is not a real fact-check. Review every source before publication.</span>
          <button onClick={onBack} className="inline-flex shrink-0 items-center gap-1 font-bold hover:underline">Back to live interview <ArrowRight size={14} /></button>
        </div>
      </div>
    </main>
  )
}

function Finding({ check }: { check: ClaimCheck }) {
  const verdict = check.status === 'MISLEADING' ? 'Misleading' : check.status === 'CONTRADICTED' ? 'Contradicted' : 'Unverified'
  const badge = check.status === 'MISLEADING' ? 'bg-amber-50 text-amber-800' : check.status === 'CONTRADICTED' ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-700'
  return (
    <article className="p-5">
      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badge}`}>{verdict}</span><span className="text-[10px] text-slate-400">{formatTimestamp(check.timestampMs)}</span></div>
      <h3 className="mt-2.5 text-sm font-bold leading-5 text-slate-800">{check.normalizedClaim}</h3>
      <p className="mt-1.5 text-xs leading-[1.65] text-slate-500">{check.explanation}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {check.evidence.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-800">{source.title}<ExternalLink size={10} /></a>)}
      </div>
    </article>
  )
}
