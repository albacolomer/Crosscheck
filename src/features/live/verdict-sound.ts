import type { ClaimCheck } from '../../../shared/types'

let context: AudioContext | null = null

function audioContext() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  context ??= new AudioContext()
  // Browsers start the context suspended until a user gesture; recording already required one.
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

function tone(ctx: AudioContext, frequency: number, startAt: number, durationS: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // Quiet, soft attack and exponential release so it never clicks or startles.
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationS)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + durationS + 0.02)
}

/** Plays a short generated chime for doubtful verdicts. Other statuses stay silent. */
export function playVerdictSound(status: ClaimCheck['status']) {
  if (status !== 'CONTRADICTED' && status !== 'MISLEADING') return
  const ctx = audioContext()
  if (!ctx) return
  const now = ctx.currentTime
  if (status === 'CONTRADICTED') {
    tone(ctx, 659, now, 0.16)
    tone(ctx, 440, now + 0.13, 0.22)
  } else {
    tone(ctx, 587, now, 0.2)
  }
}
