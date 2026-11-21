import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  AudioLines,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  LoaderCircle,
  Pause,
  Square,
  X,
} from 'lucide-react'
import type { ClaimCheck } from '../../../shared/types'
import { demoChecks, demoInterview, demoTranscript, formatTimestamp } from './mock-data'

interface LiveDashboardProps {
  onEndInterview: () => void
}

export function LiveDashboard({ onEndInterview }: LiveDashboardProps) {
  const [checks] = useState(demoChecks)
  const [alertId, setAlertId] = useState<string | null>('c2')
  const [infoId, setInfoId] = useState<string | null>(null)
  const [showAllTranscript, setShowAllTranscript] = useState(true)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const activeAlert = checks.find((check) => check.id === alertId)
  const transcript = showAllTranscript ? demoTranscript : demoTranscript.slice(-5)

  useEffect(() => {
    if (!activeAlert) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAlertId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeAlert])

  function selectClaim(check: ClaimCheck) {
    if (check.status === 'SUPPORTED') {
      setInfoId((current) => current === check.id ? null : check.id)
      return
    }
    if (check.status !== 'CHECKING') {
      // A new doubtful claim replaces the previous fact popup.
      setInfoId(null)
      setAlertId(check.id)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      window.setTimeout(() => setCopiedText(null), 1_800)
    } catch {
      setCopiedText('clipboard-unavailable')
      window.setTimeout(() => setCopiedText(null), 1_800)
    }
  }

  return (
    <main className="min-h-screen bg-white pb-14 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[84px] items-center justify-between gap-5 px-6 sm:px-8 2xl:min-h-[100px] 2xl:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl 2xl:text-3xl">Interview: {demoInterview.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-red-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" /> Recording</span>
              <span className="text-slate-500">{isPaused ? 'Transcription paused' : 'Transcribing in English'}</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 sm:text-xs">Demo · sample statements</span>
            </div>
          </div>
          <button onClick={onEndInterview} className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,0.22)] transition hover:bg-red-700 sm:px-5 sm:text-base 2xl:px-6 2xl:py-3.5">
            <Square size={16} fill="currentColor" /> <span className="hidden sm:inline">Stop recording</span><span className="sm:hidden">Stop</span><span className="border-l border-white/30 pl-2 font-mono tabular-nums">02:43</span>
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[960px] px-6 pb-16 pt-14 sm:px-8 sm:pt-16 2xl:max-w-[1120px] 2xl:px-10 2xl:pt-20">
        <div className="space-y-2">
          {transcript.map((segment) => {
            const claim = checks.find((check) => check.originalQuote === segment.text)
            const isInterviewer = segment.speaker === 'Journalist'
            const isInfoOpen = claim?.id === infoId
            return (
            <article key={segment.id} className="relative py-4 sm:py-5 2xl:py-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-sm">
                  {isInterviewer ? 'INTERVIEWER' : 'INTERVIEWEE'} <span className="px-1 text-slate-300">·</span> {formatTimestamp(segment.timestampMs)}
                  {!segment.isFinal && <span className="ml-2 normal-case tracking-normal text-slate-400">Transcribing…</span>}
                </div>

                {claim ? (
                  <div className="relative">
                    <span className={`text-lg leading-[1.75] sm:text-xl 2xl:text-[26px] ${claim.status === 'CHECKING' ? 'text-slate-500' : 'text-slate-900'}`}>
                      <span className={claimUnderline(claim.status)}>{segment.text}</span>
                      {' '}
                      <ClaimStatusButton
                        check={claim}
                        infoOpen={isInfoOpen}
                        onClick={() => selectClaim(claim)}
                      />
                    </span>
                    {isInfoOpen && claim.status === 'SUPPORTED' && (
                      <ClaimInfoPopover check={claim} copiedText={copiedText} onCopy={copyText} onClose={() => setInfoId(null)} />
                    )}
                  </div>
                ) : (
                  <p className="text-lg leading-[1.75] text-slate-700 sm:text-xl 2xl:text-[26px]">{segment.text}</p>
                )}
              </article>
            )
          })}
        </div>

        <button onClick={() => setShowAllTranscript((showAll) => !showAll)} className="mt-6 rounded-md px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 sm:text-sm">
          {showAllTranscript ? 'Show recent transcript' : 'View earlier transcript'}
        </button>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-t border-slate-200 bg-white px-6 sm:px-8 2xl:h-16 2xl:px-10">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 sm:text-sm"><AudioLines size={22} className="text-slate-700" /><span>{isPaused ? 'Paused' : 'Listening…'}</span><button onClick={() => setIsPaused((paused) => !paused)} aria-label={isPaused ? 'Resume transcription' : 'Pause transcription'} className="ml-1 rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pause size={17} /></button></div>
        <div className="flex items-center gap-4 text-xs text-slate-500 sm:gap-6 sm:text-sm">
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-dotted border-slate-400" /><span className="hidden sm:inline">Checking</span><span className="sm:hidden">Check</span></span>
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-emerald-600" />Correct</span>
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-dotted border-red-500" />False / uncertain</span>
        </div>
      </footer>

      {activeAlert && <FactAlertModal key={activeAlert.id} check={activeAlert} copiedText={copiedText} onCopy={copyText} onDismiss={() => setAlertId(null)} />}
    </main>
  )
}

function claimUnderline(status: ClaimCheck['status']) {
  if (status === 'SUPPORTED') return 'underline decoration-emerald-600 decoration-2 underline-offset-[5px]'
  if (status === 'CHECKING') return 'underline decoration-dotted decoration-slate-400 decoration-2 underline-offset-[5px]'
  if (status === 'UNVERIFIED') return 'underline decoration-wavy decoration-orange-500 decoration-2 underline-offset-[5px]'
  return 'underline decoration-wavy decoration-red-600 decoration-2 underline-offset-[5px]'
}

function ClaimStatusButton({ check, infoOpen, onClick }: { check: ClaimCheck; infoOpen: boolean; onClick: () => void }) {
  if (check.status === 'CHECKING') {
    return <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 align-middle text-xs font-medium text-slate-600 sm:text-sm"><LoaderCircle size={16} className="animate-spin" />Checking…</span>
  }
  if (check.status === 'SUPPORTED') {
    return <button onClick={onClick} aria-expanded={infoOpen} className="ml-2 inline-flex translate-y-[-1px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 align-middle text-xs font-semibold text-emerald-800 hover:bg-emerald-100 sm:text-sm"><CircleCheck size={16} />Info</button>
  }
  const statusLabel = check.status === 'CONTRADICTED' ? 'False' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'
  const tone = check.status === 'UNVERIFIED' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
  return <button onClick={onClick} className={`ml-2 inline-flex translate-y-[-1px] items-center gap-1.5 rounded-full px-3 py-1 align-middle text-xs font-bold text-white sm:text-sm ${tone}`}><AlertTriangle size={15} />{statusLabel} · View</button>
}

type InfoTab = 'context' | 'sources' | 'questions'

function ClaimInfoPopover({ check, copiedText, onCopy, onClose }: { check: ClaimCheck; copiedText: string | null; onCopy: (text: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<InfoTab>('context')
  const tabs: { id: InfoTab; label: string }[] = [
    { id: 'context', label: 'Context' },
    { id: 'sources', label: `Sources ${check.evidence.length}` },
    { id: 'questions', label: `Questions ${check.suggestedQuestions.length}` },
  ]

  return (
    <div className="absolute left-0 top-full z-20 mt-3 w-[min(460px,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.16)] 2xl:w-[520px]" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><Check size={15} />Correct</span>
        <span className="text-xs text-slate-500">with context</span>
        <button onClick={onClose} aria-label="Close claim details" className="ml-auto rounded p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
      </div>
      <div className="mt-3 flex border-b border-slate-100 px-4">
        {tabs.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>)}
      </div>
      <div className="max-h-80 overflow-y-auto p-5 text-sm leading-[1.65] 2xl:text-base">
        {tab === 'context' && <>
          <p className="text-slate-800">{check.explanation}</p>
          {check.evidence[0] && <p className="mt-2 text-slate-500">{check.evidence[0].summary}</p>}
          {check.suggestedQuestions[0] && <div className="mt-4 rounded-lg bg-slate-50 p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Related question</p><div className="mt-2 flex items-start gap-3"><span className="flex-1 text-base font-medium text-slate-800">{check.suggestedQuestions[0].text}</span><button onClick={() => onCopy(check.suggestedQuestions[0].text)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200">{copiedText === check.suggestedQuestions[0].text ? <Check size={16} /> : <Copy size={16} />}</button></div></div>}
        </>}
        {tab === 'sources' && <div className="space-y-3 text-xs 2xl:text-sm">{check.evidence.map((source) => <a key={source.title} href={source.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-100 p-3 hover:border-emerald-200"><span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">{source.title}<ExternalLink size={14} /></span><span className="mt-1 block text-slate-500">{source.summary}</span></a>)}</div>}
        {tab === 'questions' && <div className="space-y-3">{check.suggestedQuestions.map((question) => <div key={question.text} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3.5"><span className="flex-1 text-base font-medium text-slate-800">{question.text}</span><button onClick={() => onCopy(question.text)} aria-label="Copy question" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200">{copiedText === question.text ? <Check size={16} /> : <Copy size={16} />}</button></div>)}</div>}
      </div>
    </div>
  )
}

function FactAlertModal({ check, copiedText, onCopy, onDismiss }: { check: ClaimCheck; copiedText: string | null; onCopy: (text: string) => void; onDismiss: () => void }) {
  const isFalse = check.status === 'CONTRADICTED'
  const isRedAlert = isFalse || check.status === 'MISLEADING'
  const statusLabel = isFalse ? 'False' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'
  const firstQuestion = check.suggestedQuestions[0]?.text

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px] sm:p-6 2xl:p-10" onMouseDown={(event) => { if (event.currentTarget === event.target) onDismiss() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="fact-alert-title" className="max-h-[94vh] w-full max-w-[780px] overflow-y-auto rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] 2xl:max-w-[900px]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 pt-6 sm:px-8 2xl:px-9 2xl:pt-8">
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold text-white ${isRedAlert ? 'bg-red-600' : 'bg-amber-600'}`}><X size={17} />{statusLabel}</span>
          <span className="text-sm font-medium text-slate-600 sm:text-base">{demoInterview.intervieweeName} · {formatTimestamp(check.timestampMs)}</span>
          <button onClick={onDismiss} aria-label="Close fact alert" className="ml-auto rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"><X size={20} /></button>
        </div>

        <div className="px-6 pb-5 pt-5 sm:px-8 2xl:px-9">
          <p id="fact-alert-title" className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500 sm:text-sm">What was said</p>
          <p className={`mt-2 text-2xl font-bold leading-[1.4] text-slate-900 sm:text-3xl 2xl:text-4xl ${isFalse || check.status === 'MISLEADING' ? 'decoration-wavy decoration-red-500 underline decoration-2 underline-offset-4' : check.status === 'UNVERIFIED' ? 'decoration-wavy decoration-orange-500 underline decoration-2 underline-offset-4' : ''}`}>“{check.originalQuote}”</p>
        </div>

        <div className="mx-6 grid grid-cols-[120px_minmax(0,1fr)] gap-4 rounded-xl bg-slate-100 p-5 sm:mx-8 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-6 2xl:mx-9 2xl:grid-cols-[170px_minmax(0,1fr)]">
          <div className="flex flex-col justify-center border-r border-slate-200 pr-3">
          <span className={`text-xs font-bold uppercase sm:text-sm ${isRedAlert ? 'text-red-700' : 'text-orange-800'}`}>The facts</span>
            <span className="mt-1 text-xs text-slate-500 sm:text-sm">{check.confidence === undefined ? 'Checking' : `${Math.round(check.confidence * 100)}% confidence`}</span>
          </div>
          <p className="text-base leading-[1.65] text-slate-800 sm:text-lg">{check.explanation}</p>
        </div>

        <div className="px-6 pt-5 sm:px-8 2xl:px-9">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500 sm:text-sm">Ask to follow up</h3>
          <div className="space-y-2">
            {check.suggestedQuestions.slice(0, 2).map((question, index) => <div key={question.text} className={`flex items-start gap-4 rounded-xl p-4 sm:p-5 ${index === 0 ? 'border-2 border-slate-800' : 'border border-slate-200'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${index === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{index + 1}</span>
              <p className={`flex-1 text-base leading-[1.55] text-slate-900 sm:text-lg 2xl:text-xl ${index === 0 ? 'font-semibold' : 'font-medium'}`}>{question.text}</p>
              <button onClick={() => onCopy(question.text)} aria-label={`Copy question ${index + 1}`} className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50">{copiedText === question.text ? <Check size={18} /> : <Copy size={18} />}</button>
            </div>)}
          </div>
          {check.suggestedStatement && <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-[1.6] text-slate-600 sm:text-base"><b className="text-slate-700">Possible wording: </b>{check.suggestedStatement}</p>}
        </div>

        <div className="px-6 pb-5 pt-5 sm:px-8 2xl:px-9">
          <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500 sm:text-xs">Sources</h3>
          <div className="space-y-2">
            {check.evidence.length ? check.evidence.map((source) => <a key={source.title} href={source.url} target="_blank" rel="noreferrer" className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 text-xs leading-[1.5] hover:text-cyan-800 sm:text-sm">
              <span className="font-bold text-slate-500">{source.stance === 'supporting' ? 'Supporting' : 'Contrary'}</span><span className="underline decoration-slate-300 underline-offset-2">{source.title}<span className="block text-slate-400 no-underline">{source.summary}</span></span>
            </a>) : <p className="text-xs text-slate-500 sm:text-sm">No reliable sources found yet.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 sm:px-8 2xl:px-9">
          <button onClick={onDismiss} className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Dismiss</button>
          {firstQuestion && <button onClick={() => onCopy(firstQuestion)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700">{copiedText === firstQuestion ? <Check size={17} /> : <Copy size={17} />}{copiedText === firstQuestion ? 'Copied' : 'Copy question 1'}</button>}
        </div>
      </section>
    </div>
  )
}
