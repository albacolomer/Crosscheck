import { AlertTriangle, Check, CircleHelp, LoaderCircle, X } from 'lucide-react'
import type { ClaimCheck } from '../../../shared/types'

type ClaimStatus = ClaimCheck['status']

const ITEMS: { status: ClaimStatus; label: string; className: string; Icon: typeof X }[] = [
  { status: 'CONTRADICTED', label: 'false', className: 'bg-red-50 text-red-700 hover:bg-red-100', Icon: X },
  { status: 'MISLEADING', label: 'misleading', className: 'bg-amber-50 text-amber-800 hover:bg-amber-100', Icon: AlertTriangle },
  { status: 'UNVERIFIED', label: 'uncertain', className: 'bg-slate-100 text-slate-700 hover:bg-slate-200', Icon: CircleHelp },
  { status: 'SUPPORTED', label: 'correct', className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', Icon: Check },
  { status: 'CHECKING', label: 'checking', className: 'bg-slate-50 text-slate-500 hover:bg-slate-100', Icon: LoaderCircle },
]

/** Live verdict tallies; each chip jumps to the latest transcript segment with that status. */
export function VerdictCounter({ checks, onReveal }: { checks: ClaimCheck[]; onReveal: (claimId: string) => void }) {
  const counts = new Map<ClaimStatus, number>()
  for (const check of checks) counts.set(check.status, (counts.get(check.status) ?? 0) + 1)
  const visible = ITEMS.filter(({ status }) => counts.get(status))
  if (!visible.length) return null

  function revealLatest(status: ClaimStatus) {
    const elements = document.querySelectorAll<HTMLElement>(`[data-claim-status="${status}"]`)
    const claimId = elements[elements.length - 1]?.dataset.claimId
    if (claimId) onReveal(claimId)
  }

  return (
    <div role="group" aria-label="Claim verdicts" className="flex flex-wrap items-center gap-1">
      {visible.map(({ status, label, className, Icon }) => {
        const count = counts.get(status) ?? 0
        return (
          <button
            key={status}
            onClick={() => revealLatest(status)}
            title={`Jump to the latest ${label} claim`}
            aria-label={`${count} ${label}. Jump to the latest`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tabular-nums transition ${className}`}
          >
            <Icon size={11} className={status === 'CHECKING' ? 'animate-spin' : undefined} />{count}
          </button>
        )
      })}
    </div>
  )
}
