import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, LoaderCircle, Mic, Square } from 'lucide-react'
import { AnimatedText } from '../../features/live/AnimatedText'
import type { DictationPhase } from '../../hooks/useContextDictation'
import { Collapsible } from './Collapsible'
import './preparation-motion.css'

type DictationPanelProps = {
  phase: DictationPhase
  transcript: string
  error: string | null
  filledSummary: string | null
  onStart: () => void
  onStop: () => void
}

const phaseLabel: Record<DictationPhase, string> = {
  idle: 'Dictate context',
  connecting: 'Connecting…',
  recording: 'Listening — tap to finish',
  stopping: 'Finishing transcript…',
  processing: 'Processing…',
}

export function DictationPanel({ phase, transcript, error, filledSummary, onStart, onStop }: DictationPanelProps) {
  const transcriptRef = useRef<HTMLParagraphElement>(null)
  const active = phase !== 'idle'
  const listening = phase === 'connecting' || phase === 'recording'
  const busy = phase === 'stopping' || phase === 'processing'
  // Each recording gets its own id so the word-by-word animation starts fresh.
  const [session, setSession] = useState({ count: 0, active })
  if (session.active !== active) setSession({ count: session.count + (active ? 1 : 0), active })
  const hint = phase === 'idle'
    ? 'Say who you are interviewing, the topics, and what you want to ask. English or Spanish.'
    : phase === 'processing' ? 'Filling in the people, topics, and notes from your dictation.' : 'Speak naturally; you can review everything before starting.'
  const icon = busy || phase === 'connecting' ? 'loading' : listening ? 'stop' : 'mic'

  useEffect(() => {
    const element = transcriptRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [transcript])

  return (
    <div className="border-b border-slate-100 bg-emerald-50/40 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={listening ? onStop : onStart}
          disabled={busy}
          aria-pressed={listening}
          aria-label={listening ? 'Stop dictation' : 'Dictate interview context'}
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
        >
          <span key={icon} className="prep-pop">
            {icon === 'loading'
              ? <LoaderCircle size={18} className="animate-spin" />
              : icon === 'stop' ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}
          </span>
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900" role="status" aria-live="polite"><span key={phase} className="prep-fade">{phaseLabel[phase]}</span></p>
          <p className="text-[11px] leading-4 text-slate-500"><span key={hint} className="prep-fade">{hint}</span></p>
        </div>
      </div>

      <Collapsible open={active} className="pt-3">
        <p ref={transcriptRef} className={`max-h-28 overflow-y-auto rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700 transition-opacity duration-300 ${busy ? 'opacity-70' : ''}`} aria-label="Dictation transcript">
          {transcript
            ? <AnimatedText id={`dictation-${session.count}`} text={transcript} />
            : <span key={listening ? 'listening' : 'waiting'} className="prep-fade text-slate-400">{listening ? 'Listening… e.g. “I’m interviewing Ana López, mayor of Valencia, about housing and rent prices.”' : 'Waiting for the transcript…'}</span>}
        </p>
      </Collapsible>

      {error && phase === 'idle' && <p className="prep-enter mt-2 flex items-start gap-1.5 text-xs text-rose-700" role="alert"><AlertCircle size={13} className="mt-0.5 shrink-0" />{error}</p>}
      {!error && filledSummary && phase === 'idle' && <p className="prep-enter mt-2 flex items-center gap-1.5 text-xs text-emerald-800"><Check size={13} />{filledSummary} Review below before starting.</p>}
    </div>
  )
}
