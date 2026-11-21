import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
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
import type { ProcessingJob } from '../../../shared/api'
import type { ClaimCheck, TranscriptSegment } from '../../../shared/types'
import type { InterviewConnectionStatus } from '../../hooks/useLiveInterview'
import type { SpeakerCandidate, SpeakerIdentity } from '../../lib/speakers'
import { AnimatedText } from './AnimatedText'
import { formatTimestamp } from './mock-data'
import { SoundToggle } from './SoundToggle'
import { useVerdictNotifications } from './useVerdictNotifications'
import { VerdictCounter } from './VerdictCounter'
import { VerdictToasts } from './VerdictToasts'

export type RecordingStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

interface LiveDashboardProps {
  title: string
  intervieweeName: string
  transcript: TranscriptSegment[]
  speakers: SpeakerIdentity[]
  speakerCandidates: SpeakerCandidate[]
  onRenameSpeaker: (label: string, name: string) => void
  onSwapSpeakers: () => void
  checks: ClaimCheck[]
  jobs?: ProcessingJob[]
  connectionStatus: InterviewConnectionStatus
  recordingStatus: RecordingStatus
  error: string | null
  ending: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onRetryConnection: () => void
  onEndInterview: () => void
}

const intervieweeStyles = [
  { dot: 'bg-emerald-600', text: 'text-emerald-800', chip: 'border-emerald-200 bg-emerald-50 text-emerald-900', body: 'text-slate-800' },
  { dot: 'bg-violet-600', text: 'text-violet-800', chip: 'border-violet-200 bg-violet-50 text-violet-900', body: 'text-slate-800' },
  { dot: 'bg-amber-600', text: 'text-amber-800', chip: 'border-amber-200 bg-amber-50 text-amber-900', body: 'text-slate-800' },
]
const interviewerStyle = { dot: 'bg-sky-600', text: 'text-sky-800', chip: 'border-sky-200 bg-sky-50 text-sky-900', body: 'text-slate-500' }
const unknownStyle = { dot: 'bg-slate-300', text: 'text-slate-500', chip: 'border-slate-200 bg-slate-50 text-slate-700', body: 'text-slate-700' }

function speakerStyle(speaker: SpeakerIdentity | undefined, speakers: SpeakerIdentity[]) {
  if (!speaker) return unknownStyle
  if (speaker.role === 'interviewer') return interviewerStyle
  const position = speakers.filter(({ role }) => role !== 'interviewer').indexOf(speaker)
  return intervieweeStyles[Math.max(0, position) % intervieweeStyles.length]
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
  speakers,
  speakerCandidates,
  onRenameSpeaker,
  onSwapSpeakers,
  checks,
  jobs = [],
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
  const failedExtractions = new Map(jobs.filter((job) => job.kind === 'extraction' && job.status === 'failed' && job.segmentId).map((job) => [job.segmentId, job.error]))
  const notifications = useVerdictNotifications(checks, connectionStatus)
  const [handledAlert, setHandledAlert] = useState(0)
  // A newly wrong claim opens the full centered detail right away (no corner toast).
  if (notifications.alertRequest && notifications.alertRequest.seq !== handledAlert) {
    setHandledAlert(notifications.alertRequest.seq)
    setInfoId(null)
    setAlertId(notifications.alertRequest.claimId)
  }
  const transcript = showAllTranscript ? fullTranscript : fullTranscript.slice(-5)
  const speakerByLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]))
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

  // Opens a claim's detail from a notification and brings its segment into view.
  function openClaim(claimId: string) {
    const check = checks.find(({ id }) => id === claimId)
    if (!check) return
    notifications.dismissClaim(claimId)
    setShowAllTranscript(true)
    if (check.status === 'SUPPORTED') setInfoId(claimId)
    else if (check.status !== 'CHECKING') {
      setInfoId(null)
      setAlertId(claimId)
    }
    window.requestAnimationFrame(() => notifications.reveal(claimId))
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
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl 2xl:text-3xl">Interview: {title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm">
              <span className={`inline-flex items-center gap-1.5 font-semibold ${recordingStatus === 'recording' ? 'text-red-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${recordingStatus === 'recording' ? 'animate-pulse bg-red-600' : 'bg-slate-400'}`} /> {recordingLabel}</span>
              <span className="text-slate-500">{connectionStatus === 'creating' ? 'Creating interview…' : connectionStatus === 'connecting' ? 'Connecting…' : connectionStatus === 'reconnecting' ? 'Reconnecting…' : connectionStatus === 'error' ? 'Backend unavailable' : isPaused ? 'Transcription paused' : 'Transcribing'}</span>
            </div>
          </div>
          <div className="ml-auto hidden sm:block"><VerdictCounter checks={checks} onReveal={notifications.reveal} /></div>
          <button onClick={onEndInterview} disabled={ending || connectionStatus === 'creating'} className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,0.22)] transition hover:bg-red-700 disabled:opacity-60 sm:px-5 sm:text-base 2xl:px-6 2xl:py-3.5">
            {ending ? <LoaderCircle size={16} className="animate-spin" /> : <Square size={16} fill="currentColor" />} <span className="hidden sm:inline">{ending ? 'Ending…' : 'End interview'}</span><span className="sm:hidden">End</span>
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[960px] px-6 pb-16 pt-14 sm:px-8 sm:pt-16 2xl:max-w-[1120px] 2xl:px-10 2xl:pt-20">
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            {connectionStatus === 'error' && <button onClick={onRetryConnection} className="font-semibold underline underline-offset-2">Retry</button>}
          </div>
        )}
        {!fullTranscript.length && (
          <div className="flex flex-col items-center py-16 text-center">
            {isRecording ? (
              <p className="text-base text-slate-500 sm:text-lg">{recordingStatus === 'connecting' ? 'Starting microphone…' : 'Listening for speech…'}</p>
            ) : (
              <>
                <button onClick={onStartRecording} disabled={!canRecord || recordingStatus === 'stopping'} className="inline-flex items-center gap-2.5 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_3px_10px_rgba(220,38,38,0.22)] transition hover:bg-red-700 disabled:opacity-50 sm:text-base 2xl:px-6 2xl:py-3.5"><Mic size={18} /> Start recording</button>
                <p className="mt-3 text-sm text-slate-500 sm:text-base">{canRecord ? 'The transcript will appear here.' : 'Waiting for the backend…'}</p>
              </>
            )}
          </div>
        )}
        {speakers.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.09em] text-slate-400 sm:text-sm">Voices</span>
            {speakers.map((speaker) => {
              const style = speakerStyle(speaker, speakers)
              const options = [...new Set([...speakerCandidates.map(({ name }) => name), speaker.name, speaker.label])]
              return (
                <label key={speaker.label} title={`Detected as ${speaker.label}`} className={`inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1.5 ${style.chip}`}>
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <select value={speaker.name} onChange={(event) => onRenameSpeaker(speaker.label, event.target.value)} aria-label={`Name for ${speaker.label}`} className="max-w-[220px] cursor-pointer truncate bg-transparent font-semibold outline-none">
                    {options.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
              )
            })}
            {speakers.length === 2 && <button onClick={onSwapSpeakers} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 sm:text-sm"><ArrowLeftRight size={16} /> Swap</button>}
          </div>
        )}
        <div className="space-y-2">
          {transcript.map((segment) => {
            const claim = findClaim(checks, segment)
            const speaker = segment.speaker ? speakerByLabel.get(segment.speaker.trim()) : undefined
            const style = speakerStyle(speaker, speakers)
            const isInfoOpen = claim?.id === infoId
            return (
              <article key={segment.id} className={`live-segment-enter relative py-4 sm:py-5 2xl:py-6 ${isInfoOpen ? 'z-30' : ''}`}>
                <div className="mb-2 flex items-center text-xs font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-sm">
                  <span className={`mr-2 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <span className={style.text}>{speaker?.name ?? 'Speaker'}</span> <span className="px-1 text-slate-300">·</span> {formatTimestamp(segment.timestampMs)}
                  {!segment.isFinal && <span className="ml-2 normal-case tracking-normal text-slate-400">Transcribing…</span>}
                  {failedExtractions.has(segment.id) && <span title={failedExtractions.get(segment.id) ?? undefined} className="ml-2 inline-flex items-center gap-1.5 normal-case tracking-normal text-rose-600"><AlertTriangle size={14} />Claim detection failed</span>}
                </div>

                {claim ? (
                  <div data-claim-id={claim.id} data-claim-status={claim.status} className={`relative scroll-mt-28 ${notifications.isFlashing(claim.id) ? 'verdict-flash' : ''}`}>
                    <span className={`text-lg leading-[1.75] sm:text-xl 2xl:text-[26px] transition-colors duration-300 ${claim.status === 'CHECKING' ? 'text-slate-500' : 'text-slate-900'}`}>
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
                  <p className={`text-lg leading-[1.75] sm:text-xl 2xl:text-[26px] ${style.body}`}><AnimatedText id={segment.id} text={segment.text} /></p>
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
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 sm:text-sm"><AudioLines size={22} className="text-slate-700" /><span>{isPaused ? 'Paused' : 'Listening…'}</span>{isRecording ? <button onClick={onStopRecording} aria-label="Pause transcription" className="ml-1 rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pause size={17} /></button> : <button onClick={onStartRecording} disabled={!canRecord || recordingStatus === 'stopping'} aria-label="Start recording" className="ml-1 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"><Mic size={17} />{fullTranscript.length ? 'Resume' : 'Start recording'}</button>}<SoundToggle enabled={notifications.soundEnabled} onChange={notifications.setSoundEnabled} /></div>
        <div className="flex items-center gap-4 text-xs text-slate-500 sm:gap-6 sm:text-sm">
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-dotted border-slate-400" /><span className="hidden sm:inline">Checking</span><span className="sm:hidden">Check</span></span>
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-emerald-600" />Correct</span>
          <span className="inline-flex items-center gap-2"><span className="w-5 border-b-2 border-dotted border-red-500" />False / uncertain</span>
        </div>
      </footer>

      <VerdictToasts toasts={notifications.toasts} copiedText={copiedText} onDismiss={notifications.dismiss} onView={openClaim} onCopy={copyText} />
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
    <div className="live-card-enter absolute left-0 top-full z-40 mt-3 w-[min(460px,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.16)] 2xl:w-[520px]" onClick={(event) => event.stopPropagation()}>
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

function FactAlertModal({ check, intervieweeName, copiedText, onCopy, onDismiss }: { check: ClaimCheck; intervieweeName: string; copiedText: string | null; onCopy: (text: string) => void; onDismiss: () => void }) {
  const isFalse = check.status === 'CONTRADICTED'
  const isRedAlert = isFalse || check.status === 'MISLEADING'
  const statusLabel = isFalse ? 'False' : check.status === 'MISLEADING' ? 'Misleading' : 'Uncertain'
  const firstQuestion = check.suggestedQuestions[0]?.text

  return (
    <div className="live-fade-enter fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px] sm:p-6 2xl:p-10" onMouseDown={(event) => { if (event.currentTarget === event.target) onDismiss() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="fact-alert-title" className="live-card-enter max-h-[94vh] w-full max-w-[780px] overflow-y-auto rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] 2xl:max-w-[900px]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 pt-6 sm:px-8 2xl:px-9 2xl:pt-8">
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold text-white ${isRedAlert ? 'bg-red-600' : 'bg-amber-600'}`}><X size={17} />{statusLabel}</span>
          <span className="text-sm font-medium text-slate-600 sm:text-base">{intervieweeName} · {formatTimestamp(check.timestampMs)}</span>
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
