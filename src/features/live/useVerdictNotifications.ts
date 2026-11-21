import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClaimCheck } from '../../../shared/types'
import type { InterviewConnectionStatus } from '../../hooks/useLiveInterview'
import { playVerdictSound } from './verdict-sound'

export interface VerdictToast {
  /** Unique per notification, so a replaced toast restarts its timer and entrance. */
  key: string
  kind: 'checking' | 'verdict'
  check: ClaimCheck
}

const MAX_TOASTS = 3
const FLASH_MS = 2_400
const SOUND_STORAGE_KEY = 'crosscheck.verdictSound'

let toastSequence = 0
let flashSequence = 0

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeSoundPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for this session.
  }
}

/** Keeps at most MAX_TOASTS, dropping stale "checking" toasts before verdicts. */
function capToasts(toasts: VerdictToast[]) {
  const next = [...toasts]
  while (next.length > MAX_TOASTS) {
    const checkingIndex = next.findIndex((toast) => toast.kind === 'checking')
    next.splice(checkingIndex === -1 ? 0 : checkingIndex, 1)
  }
  return next
}

function withoutKey<K, V>(map: ReadonlyMap<K, V>, key: K) {
  const next = new Map(map)
  next.delete(key)
  return next
}

/** Finds the transcript block rendered for a claim (LiveDashboard tags it with data-claim-id). */
function findClaimElement(claimId: string) {
  return document.querySelector<HTMLElement>(`[data-claim-id="${CSS.escape(claimId)}"]`)
}

/**
 * Watches claim checks for transitions that happen while the dashboard is live
 * and turns them into toasts, a short transcript highlight, and an optional chime.
 * Checks seen on mount or in the first snapshot after a (re)connect are a silent
 * baseline, so reconnects do not replay every past verdict.
 */
export function useVerdictNotifications(checks: ClaimCheck[], connectionStatus: InterviewConnectionStatus) {
  const live = connectionStatus === 'connected'
  const [previous, setPrevious] = useState({ checks, live })
  const [toasts, setToasts] = useState<VerdictToast[]>([])
  // Claim id -> highlight token; a new token restarts the highlight timer.
  const [flashing, setFlashing] = useState<ReadonlyMap<string, number>>(() => new Map())
  const flashStarts = useRef(new Map<number, number>())
  const [soundEnabled, setSoundEnabledState] = useState(readSoundPreference)
  const announcedKeys = useRef(new Set<string>())

  // Derive notifications while rendering (React's "adjust state on prop change" pattern).
  if (previous.checks !== checks || previous.live !== live) {
    setPrevious({ checks, live })
    if (previous.live && live) {
      const before = new Map(previous.checks.map((check) => [check.id, check.status]))
      const changed = checks.filter((check) => before.get(check.id) !== check.status)
      const detected = changed.filter((check) => check.status === 'CHECKING')
      const resolved = changed.filter((check) => check.status !== 'CHECKING')
      if (changed.length) {
        const resolvedIds = new Set(resolved.map((check) => check.id))
        setToasts(capToasts([
          ...toasts.filter((toast) => !resolvedIds.has(toast.check.id)),
          ...detected.map((check) => ({ key: `toast-${++toastSequence}`, kind: 'checking' as const, check })),
          ...resolved.map((check) => ({ key: `toast-${++toastSequence}`, kind: 'verdict' as const, check })),
        ]))
      }
      if (resolved.length) {
        const next = new Map(flashing)
        for (const check of resolved) next.set(check.id, ++flashSequence)
        setFlashing(next)
      }
    }
  }

  // Ends each highlight FLASH_MS after it started.
  useEffect(() => {
    const starts = flashStarts.current
    const now = performance.now()
    for (const token of starts.keys()) {
      if (![...flashing.values()].includes(token)) starts.delete(token)
    }
    const timers = [...flashing].map(([claimId, token]) => {
      if (!starts.has(token)) starts.set(token, now)
      const remaining = Math.max(0, (starts.get(token) ?? now) + FLASH_MS - now)
      return window.setTimeout(() => {
        setFlashing((current) => current.get(claimId) === token ? withoutKey(current, claimId) : current)
      }, remaining)
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [flashing])

  // One chime per batch of new verdict toasts; the loudest verdict wins.
  useEffect(() => {
    const fresh = toasts.filter((toast) => toast.kind === 'verdict' && !announcedKeys.current.has(toast.key))
    for (const toast of fresh) announcedKeys.current.add(toast.key)
    if (!soundEnabled) return
    const statuses = fresh.map((toast) => toast.check.status)
    if (statuses.includes('CONTRADICTED')) playVerdictSound('CONTRADICTED')
    else if (statuses.includes('MISLEADING')) playVerdictSound('MISLEADING')
  }, [toasts, soundEnabled])

  const dismiss = useCallback((key: string) => {
    setToasts((current) => current.filter((toast) => toast.key !== key))
  }, [])

  const dismissClaim = useCallback((claimId: string) => {
    setToasts((current) => current.filter((toast) => toast.check.id !== claimId))
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled)
    writeSoundPreference(enabled)
  }, [])

  /** Scrolls a claim's transcript block into view and pulses it. */
  const reveal = useCallback((claimId: string) => {
    const element = findClaimElement(claimId)
    if (element) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }
    // Drop the class for a frame so a repeated reveal restarts the CSS animation.
    setFlashing((current) => withoutKey(current, claimId))
    window.requestAnimationFrame(() => setFlashing((current) => new Map(current).set(claimId, ++flashSequence)))
  }, [])

  return {
    toasts,
    dismiss,
    dismissClaim,
    isFlashing: (claimId: string) => flashing.has(claimId),
    reveal,
    soundEnabled,
    setSoundEnabled,
  }
}
