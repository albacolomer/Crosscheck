import { useEffect, useRef } from 'react'
import { AlertCircle, Check, LoaderCircle, Mic, Square } from 'lucide-react'
import type { DictationPhase } from '../../hooks/useContextDictation'

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
          {phase === 'recording' && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" aria-hidden="true" />}
          {busy || phase === 'connecting'
            ? <LoaderCircle size={18} className="animate-spin" />
            : listening ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900" role="status" aria-live="polite">{phaseLabel[phase]}</p>
          <p className="text-[11px] leading-4 text-slate-500">
            {phase === 'idle'
              ? 'Say who you are interviewing, the topics, and what you want to ask. English or Spanish.'
              : phase === 'processing' ? 'Filling in the people, topics, and notes from your dictation.' : 'Speak naturally; you can review everything before starting.'}
          </p>
        </div>
      </div>

      {active && (
        <p ref={transcriptRef} className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700" aria-label="Dictation transcript">
          {transcript || <span className="text-slate-400">{listening ? 'Listening… e.g. “I’m interviewing Ana López, mayor of Valencia, about housing and rent prices.”' : 'Waiting for the transcript…'}</span>}
        </p>
      )}

      {error && phase === 'idle' && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700" role="alert"><AlertCircle size={13} className="mt-0.5 shrink-0" />{error}</p>}
      {!error && filledSummary && phase === 'idle' && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-800"><Check size={13} />{filledSummary} Review below before starting.</p>}
    </div>
  )
}
