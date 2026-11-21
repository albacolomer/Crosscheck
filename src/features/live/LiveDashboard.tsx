import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  AudioLines,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  LoaderCircle,
  Mic,
  Pause,
  Square,
  X,
} from 'lucide-react'
import type { ClaimCheck, TranscriptSegment } from '../../../shared/types'
import type { InterviewConnectionStatus } from '../../hooks/useLiveInterview'
import { AnimatedText } from './AnimatedText'
import { formatTimestamp } from './mock-data'

export type RecordingStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

interface LiveDashboardProps {
  title: string
  intervieweeName: string
  transcript: TranscriptSegment[]
  checks: ClaimCheck[]
  connectionStatus: InterviewConnectionStatus
  recordingStatus: RecordingStatus
  error: string | null
  ending: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onRetryConnection: () => void
  onEndInterview: () => void
}

function findClaim(checks: ClaimCheck[], segment: TranscriptSegment) {
  if (!segment.isFinal) return undefined
  const text = segment.text.toLocaleLowerCase()
  return checks.find((check) => check.originalQuote.trim() && text.includes(check.originalQuote.trim().toLocaleLowerCase()))
}

export function LiveDashboard({
  title,
  intervieweeName,
  transcript: fullTranscript,
  checks,
  connectionStatus,
  recordingStatus,
  error,
  ending,
  onStartRecording,
  onStopRecording,
  onRetryConnection,
  onEndInterview,
}: LiveDashboardProps) {
  const [alertId, setAlertId] = useState<string | null>(null)
  const [infoId, setInfoId] = useState<string | null>(null)
  const [showAllTranscript, setShowAllTranscript] = useState(true)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const activeAlert = checks.find((check) => check.id === alertId)
  const transcript = showAllTranscript ? fullTranscript : fullTranscript.slice(-5)
  const isRecording = recordingStatus === 'recording' || recordingStatus === 'connecting'
  const isPaused = !isRecording
  const canRecord = connectionStatus === 'connected' && !ending
  const recordingLabel = {
    idle: 'Not recording',
    connecting: 'Starting microphone…',
    recording: 'Recording',
    stopping: 'Finishing last segment…',
    error: 'Recording stopped',
  }[recordingStatus]

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
        <div className="flex min-h-[74px] items-center justify-between gap-4 px-5 sm:px-7">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">Interview: {title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px]">
              <span className={`inline-flex items-center gap-1.5 font-semibold ${recordingStatus === 'recording' ? 'text-red-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${recordingStatus === 'recording' ? 'animate-pulse bg-red-600' : 'bg-slate-400'}`} /> {recordingLabel}</span>
              <span className="text-slate-500">{connectionStatus === 'creating' ? 'Creating interview…' : connectionStatus === 'connecting' ? 'Connecting…' : connectionStatus === 'reconnecting' ? 'Reconnecting…' : connectionStatus === 'error' ? 'Backend unavailable' : isPaused ? 'Transcription paused' : 'Transcribing'}</span>
            </div>
          </div>
          <button onClick={onEndInterview} disabled={ending || connectionStatus === 'creating'} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,0.22)] transition hover:bg-red-700 disabled:opacity-60 sm:px-4 sm:text-sm">
            {ending ? <LoaderCircle size={12} className="animate-spin" /> : <Square size={12} fill="currentColor" />} <span className="hidden sm:inline">{ending ? 'Ending…' : 'End interview'}</span><span className="sm:hidden">End</span>
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-12 sm:px-8 sm:pt-16">
        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            {connectionStatus === 'error' && <button onClick={onRetryConnection} className="font-semibold underline underline-offset-2">Retry</button>}
          </div>
        )}
        {!fullTranscript.length && (
          <div className="flex flex-col items-center py-16 text-center">
            {isRecording ? (
              <p className="text-sm text-slate-500">{recordingStatus === 'connecting' ? 'Starting microphone…' : 'Listening for speech…'}</p>
            ) : (
              <>
                <button onClick={onStartRecording} disabled={!canRecord || recordingStatus === 'stopping'} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,0.22)] transition hover:bg-red-700 disabled:opacity-50"><Mic size={16} /> Start recording</button>
                <p className="mt-2 text-xs text-slate-500">{canRecord ? 'The transcript will appear here.' : 'Waiting for the backend…'}</p>
              </>
            )}
          </div>
        )}
        <div className="space-y-1">
          {transcript.map((segment) => {
            const claim = findClaim(checks, segment)
            const isInterviewer = segment.speaker === 'Journalist'
            const isInfoOpen = claim?.id === infoId
            return (
              <article key={segment.id} className="live-segment-enter relative py-3.5 sm:py-4">
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-[10px]">
                  {isInterviewer ? 'INTERVIEWER' : 'INTERVIEWEE'} <span className="px-1 text-slate-300">·</span> {formatTimestamp(segment.timestampMs)}
                  {!segment.isFinal && <span className="ml-2 normal-case tracking-normal text-slate-400">Transcribing…</span>}
                </div>

                {claim ? (
                  <div className="relative">
                    <span className={`text-[16px] leading-[1.8] sm:text-[17px] transition-colors duration-300 ${claim.status === 'CHECKING' ? 'text-slate-500' : 'text-slate-900'}`}>
                      <span className={claimUnderline(claim.status)}><AnimatedText id={segment.id} text={segment.text} /></span>
                      {' '}
                      <span key={claim.status} className="live-badge-enter">
                        <ClaimStatusButton
                          check={claim}
                          infoOpen={isInfoOpen}
                          onClick={() => selectClaim(claim)}
                        />
                      </span>
                    </span>
                    {isInfoOpen && claim.status === 'SUPPORTED' && (
                      <ClaimInfoPopover check={claim} copiedText={copiedText} onCopy={copyText} onClose={() => setInfoId(null)} />
                    )}
                  </div>
                ) : (
                  <p className="text-[16px] leading-[1.8] text-slate-700 sm:text-[17px]"><AnimatedText id={segment.id} text={segment.text} /></p>
                )}
              </article>
            )
          })}
        </div>

        <button onClick={() => setShowAllTranscript((showAll) => !showAll)} className="mt-4 rounded-md px-2 py-1.5 text-[10px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700">
          {showAllTranscript ? 'Show recent transcript' : 'View earlier transcript'}
        </button>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 z-30 flex h-12 items-center justify-between border-t border-slate-200 bg-white px-5 sm:px-7">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600"><AudioLines size={17} className="text-slate-700" /><span>{isPaused ? 'Paused' : 'Listening…'}</span>{isRecording ? <button onClick={onStopRecording} aria-label="Pause transcription" className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100"><Pause size={12} /></button> : <button onClick={onStartRecording} disabled={!canRecord || recordingStatus === 'stopping'} aria-label="Start recording" className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"><Mic size={12} />{fullTranscript.length ? 'Resume' : 'Start recording'}</button>}</div>
        <div className="flex items-center gap-3.5 text-[9px] text-slate-500 sm:gap-5 sm:text-[10px]">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-b-2 border-dotted border-slate-400" /><span className="hidden sm:inline">Checking</span><span className="sm:hidden">Check</span></span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-b-2 border-emerald-600" />Correct</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-b-2 border-dotted border-red-500" />False / uncertain</span>
        </div>
      </footer>

      {activeAlert && <FactAlertModal key={activeAlert.id} check={activeAlert} intervieweeName={intervieweeName} copiedText={copiedText} onCopy={copyText} onDismiss={() => setAlertId(null)} />}
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
    return <span className="ml-1 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[9px] font-medium text-slate-500"><LoaderCircle size={11} className="animate-spin" />Checking…</span>
  }
  if (check.status === 'SUPPORTED') {
    return <button onClick={onClick} aria-expanded={infoOpen} className="ml-1 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 align-middle text-[9px] font-semibold text-emerald-800 hover:bg-emerald-100"><CircleCheck size={11} />Info</button>
  }
  const statusLabel = check.status === 'CONTRADICTED' ? 'False' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'
  const tone = check.status === 'UNVERIFIED' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
  return <button onClick={onClick} className={`ml-1 inline-flex translate-y-[-1px] items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold text-white ${tone}`}><AlertTriangle size={10} />{statusLabel} · View</button>
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
    <div className="live-card-enter absolute left-0 top-full z-20 mt-2 w-[min(365px,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.16)]" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-800"><Check size={11} />Correct</span>
        <span className="text-[9px] text-slate-400">with context</span>
        <button onClick={onClose} aria-label="Close claim details" className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"><X size={13} /></button>
      </div>
      <div className="mt-2 flex border-b border-slate-100 px-3">
        {tabs.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-2 py-2 text-[10px] font-semibold ${tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>{label}</button>)}
      </div>
      <div className="max-h-64 overflow-y-auto p-3.5 text-[11px] leading-[1.6]">
        {tab === 'context' && <>
          <p className="text-slate-800">{check.explanation}</p>
          {check.evidence[0] && <p className="mt-2 text-slate-500">{check.evidence[0].summary}</p>}
          {check.suggestedQuestions[0] && <div className="mt-3 rounded-lg bg-slate-50 p-2.5"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Related question</p><div className="mt-1 flex items-start gap-2"><span className="flex-1 text-slate-700">{check.suggestedQuestions[0].text}</span><button onClick={() => onCopy(check.suggestedQuestions[0].text)} className="rounded p-1 text-slate-500 hover:bg-slate-200">{copiedText === check.suggestedQuestions[0].text ? <Check size={12} /> : <Copy size={12} />}</button></div></div>}
        </>}
        {tab === 'sources' && <div className="space-y-2">{check.evidence.map((source) => <a key={source.title} href={source.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-100 p-2.5 hover:border-emerald-200"><span className="inline-flex items-center gap-1 font-semibold text-slate-800">{source.title}<ExternalLink size={10} /></span><span className="mt-0.5 block text-slate-500">{source.summary}</span></a>)}</div>}
        {tab === 'questions' && <div className="space-y-2">{check.suggestedQuestions.map((question) => <div key={question.text} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5"><span className="flex-1 text-slate-700">{question.text}</span><button onClick={() => onCopy(question.text)} aria-label="Copy question" className="rounded p-1 text-slate-500 hover:bg-slate-200">{copiedText === question.text ? <Check size={12} /> : <Copy size={12} />}</button></div>)}</div>}
      </div>
    </div>
  )
}

function FactAlertModal({ check, intervieweeName, copiedText, onCopy, onDismiss }: { check: ClaimCheck; intervieweeName: string; copiedText: string | null; onCopy: (text: string) => void; onDismiss: () => void }) {
  const isFalse = check.status === 'CONTRADICTED'
  const isRedAlert = isFalse || check.status === 'MISLEADING'
  const statusLabel = isFalse ? 'False' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'
  const firstQuestion = check.suggestedQuestions[0]?.text

  return (
    <div className="live-fade-enter fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3 backdrop-blur-[1px] sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) onDismiss() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="fact-alert-title" className="live-card-enter max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-5 sm:px-6">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold text-white ${isRedAlert ? 'bg-red-600' : 'bg-amber-600'}`}><X size={12} />{statusLabel}</span>
          <span className="text-[10px] font-medium text-slate-500">{intervieweeName} · {formatTimestamp(check.timestampMs)}</span>
          <button onClick={onDismiss} aria-label="Close fact alert" className="ml-auto rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={15} /></button>
        </div>

        <div className="px-5 pb-4 pt-4 sm:px-6">
          <p id="fact-alert-title" className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">What was said</p>
          <p className={`mt-1.5 text-xl font-bold leading-[1.4] text-slate-900 ${isFalse || check.status === 'MISLEADING' ? 'decoration-wavy decoration-red-500 underline decoration-2 underline-offset-4' : check.status === 'UNVERIFIED' ? 'decoration-wavy decoration-orange-500 underline decoration-2 underline-offset-4' : ''}`}>“{check.originalQuote}”</p>
        </div>

        <div className="mx-5 grid grid-cols-[100px_minmax(0,1fr)] gap-3 rounded-xl bg-slate-100 p-4 sm:mx-6 sm:grid-cols-[130px_minmax(0,1fr)]">
          <div className="flex flex-col justify-center border-r border-slate-200 pr-3">
          <span className={`text-[10px] font-bold uppercase ${isRedAlert ? 'text-red-700' : 'text-orange-800'}`}>The facts</span>
            <span className="mt-1 text-[10px] text-slate-500">{check.confidence === undefined ? 'Checking' : `${Math.round(check.confidence * 100)}% confidence`}</span>
          </div>
          <p className="text-sm leading-[1.65] text-slate-800">{check.explanation}</p>
        </div>

        <div className="px-5 pt-4 sm:px-6">
          <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Ask to follow up</h3>
          <div className="space-y-1.5">
            {check.suggestedQuestions.slice(0, 2).map((question, index) => <div key={question.text} className={`flex items-start gap-3 rounded-xl p-3.5 ${index === 0 ? 'border-2 border-slate-800' : 'border border-slate-200'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{index + 1}</span>
              <p className={`flex-1 text-sm leading-[1.55] text-slate-900 ${index === 0 ? 'font-semibold' : 'font-medium'}`}>{question.text}</p>
              <button onClick={() => onCopy(question.text)} aria-label={`Copy question ${index + 1}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">{copiedText === question.text ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>)}
          </div>
          {check.suggestedStatement && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-[1.6] text-slate-600"><b className="text-slate-700">Possible wording: </b>{check.suggestedStatement}</p>}
        </div>

        <div className="px-5 pb-4 pt-4 sm:px-6">
          <h3 className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Sources</h3>
          <div className="space-y-1.5">
            {check.evidence.length ? check.evidence.map((source) => <a key={source.title} href={source.url} target="_blank" rel="noreferrer" className="grid grid-cols-[68px_minmax(0,1fr)] gap-2 text-[9px] leading-[1.45] hover:text-cyan-800">
              <span className="font-bold text-slate-500">{source.stance === 'supporting' ? 'Supporting' : 'Contrary'}</span><span className="underline decoration-slate-300 underline-offset-2">{source.title}<span className="block text-slate-400 no-underline">{source.summary}</span></span>
            </a>) : <p className="text-[10px] text-slate-500">No reliable sources found yet.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 sm:px-6">
          <button onClick={onDismiss} className="rounded-lg border border-slate-200 px-4 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50">Dismiss</button>
          {firstQuestion && <button onClick={() => onCopy(firstQuestion)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-bold text-white hover:bg-slate-700">{copiedText === firstQuestion ? <Check size={12} /> : <Copy size={12} />}{copiedText === firstQuestion ? 'Copied' : 'Copy question 1'}</button>}
        </div>
      </section>
    </div>
  )
}
