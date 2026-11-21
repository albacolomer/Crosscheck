import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CircleCheck, CircleHelp, Copy, LoaderCircle, X } from 'lucide-react'
import type { ClaimCheck } from '../../../shared/types'
import type { VerdictToast } from './useVerdictNotifications'
import './verdict-notifications.css'

const CHECKING_TIMEOUT_MS = 5_000
const VERDICT_TIMEOUT_MS = 8_000

interface VerdictToastsProps {
  toasts: VerdictToast[]
  copiedText: string | null
  onDismiss: (key: string) => void
  onView: (claimId: string) => void
  onCopy: (text: string) => void
}

const verdictStyle: Record<Exclude<ClaimCheck['status'], 'CHECKING'>, { label: string; card: string; chip: string; Icon: typeof X }> = {
  CONTRADICTED: { label: 'False', card: 'border-red-300 bg-red-50 ring-red-500/20', chip: 'bg-red-600 text-white', Icon: X },
  MISLEADING: { label: 'Misleading', card: 'border-amber-300 bg-amber-50 ring-amber-500/20', chip: 'bg-amber-600 text-white', Icon: AlertTriangle },
  UNVERIFIED: { label: 'Uncertain', card: 'border-slate-300 bg-slate-50 ring-amber-400/20', chip: 'bg-slate-600 text-white', Icon: CircleHelp },
  SUPPORTED: { label: 'Correct', card: 'border-emerald-300 bg-emerald-50 ring-emerald-500/20', chip: 'bg-emerald-600 text-white', Icon: CircleCheck },
}

function isDoubtful(status: ClaimCheck['status']) {
  return status === 'CONTRADICTED' || status === 'MISLEADING' || status === 'UNVERIFIED'
}

function firstQuestion(check: ClaimCheck) {
  return (check.suggestedQuestions.find((question) => question.type === 'challenge') ?? check.suggestedQuestions[0])?.text
}

function announcementFor(toast: VerdictToast) {
  if (toast.kind === 'checking' || toast.check.status === 'CHECKING') return `Checking claim: ${toast.check.normalizedClaim}`
  return `${verdictStyle[toast.check.status].label}: ${toast.check.normalizedClaim}. ${toast.check.explanation ?? ''}`
}

/** Corner stack of claim notifications plus screen reader announcements. */
export function VerdictToasts({ toasts, copiedText, onDismiss, onView, onCopy }: VerdictToastsProps) {
  const latest = toasts.at(-1)
  const urgent = latest?.kind === 'verdict' && latest.check.status === 'CONTRADICTED'
  const announcement = latest ? announcementFor(latest) : ''

  return (
    <>
      {/* Visual stack is not live; the hidden regions below announce the latest toast once. */}
      <section aria-label="Claim notifications" className="pointer-events-none fixed bottom-16 right-3 z-40 flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5">
        {toasts.map((toast) => (
          <ToastCard key={toast.key} toast={toast} copiedText={copiedText} onDismiss={onDismiss} onView={onView} onCopy={onCopy} />
        ))}
      </section>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{urgent ? '' : announcement}</div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{urgent ? announcement : ''}</div>
    </>
  )
}

function useAutoDismiss(timeoutMs: number, paused: boolean, onExpire: () => void) {
  const remaining = useRef(timeoutMs)
  const expire = useRef(onExpire)

  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (paused) return
    const startedAt = performance.now()
    const timer = window.setTimeout(() => expire.current(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(1_000, remaining.current - (performance.now() - startedAt))
    }
  }, [paused])
}

function ToastCard({ toast, copiedText, onDismiss, onView, onCopy }: { toast: VerdictToast } & Omit<VerdictToastsProps, 'toasts'>) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const { check } = toast
  const isChecking = toast.kind === 'checking' || check.status === 'CHECKING'
  useAutoDismiss(isChecking ? CHECKING_TIMEOUT_MS : VERDICT_TIMEOUT_MS, hovered || focused, () => onDismiss(toast.key))

  const pauseHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }

  if (isChecking) {
    return (
      <div {...pauseHandlers} className="verdict-toast-enter pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-[0_6px_20px_rgba(15,23,42,0.10)] backdrop-blur">
        <LoaderCircle size={13} className="shrink-0 animate-spin text-slate-400" />
        <span className="shrink-0 font-semibold text-slate-700">Checking claim…</span>
        <span className="min-w-0 flex-1 truncate">{check.normalizedClaim}</span>
        <button onClick={() => onDismiss(toast.key)} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={12} /></button>
      </div>
    )
  }

  const style = verdictStyle[check.status as keyof typeof verdictStyle]
  const { Icon } = style
  const question = isDoubtful(check.status) ? firstQuestion(check) : undefined

  return (
    <div {...pauseHandlers} className={`verdict-toast-enter pointer-events-auto rounded-2xl border p-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] ring-4 ${style.card}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.chip}`}><Icon size={11} />{style.label}</span>
        <span className="text-[10px] font-medium text-slate-500">Verdict ready</span>
        <button onClick={() => onDismiss(toast.key)} aria-label="Dismiss notification" className="ml-auto rounded p-1 text-slate-400 hover:bg-white/70 hover:text-slate-700"><X size={13} /></button>
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{check.normalizedClaim}</p>
      {check.explanation && <p className="mt-1 truncate text-[11px] text-slate-600" title={check.explanation}>{check.explanation}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <button onClick={() => onView(check.id)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-slate-700">View</button>
        {question && (
          <button onClick={() => onCopy(question)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
            {copiedText === question ? <Check size={11} /> : <Copy size={11} />}{copiedText === question ? 'Copied' : 'Copy question'}
          </button>
        )}
      </div>
    </div>
  )
}
