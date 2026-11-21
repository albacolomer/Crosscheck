import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const STAGGER_MS = 60
const MAX_STAGGER_STEPS = 8
// Longest entrance plus highlight, so the classes come off after the animations end.
const SETTLE_MS = 1300

type FreshState<K> = { keys: K[]; firstStep: number; highlight: boolean }

export type FreshMotion = { className: string; style?: CSSProperties }

/**
 * Tracks which list items were just added so only they play the entrance animation.
 * Items keep their class until the animation has ended, then it is dropped without a visual change.
 */
export function useFreshItems<K extends string | number>() {
  const [state, setState] = useState<FreshState<K>>({ keys: [], firstStep: 0, highlight: false })
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  /** Marks `keys` as just added, staggered in order starting at `firstStep`. */
  const mark = useCallback((keys: K[], options: { highlight?: boolean; firstStep?: number } = {}) => {
    window.clearTimeout(timerRef.current)
    if (!keys.length) {
      setState((current) => current.keys.length ? { keys: [], firstStep: 0, highlight: false } : current)
      return
    }
    const firstStep = options.firstStep ?? 0
    setState({ keys, firstStep, highlight: options.highlight ?? false })
    const lastStep = Math.min(firstStep + keys.length - 1, MAX_STAGGER_STEPS)
    timerRef.current = window.setTimeout(() => {
      setState({ keys: [], firstStep: 0, highlight: false })
    }, SETTLE_MS + lastStep * STAGGER_MS)
  }, [])

  /** Drops all marks, for example before indexes shift after a removal. */
  const clear = useCallback(() => mark([]), [mark])

  function motion(key: K): FreshMotion | undefined {
    const order = state.keys.indexOf(key)
    if (order < 0) return undefined
    const step = Math.min(state.firstStep + order, MAX_STAGGER_STEPS)
    return {
      className: state.highlight ? 'prep-enter prep-filled' : 'prep-enter',
      style: step ? { '--prep-enter-delay': `${step * STAGGER_MS}ms` } as CSSProperties : undefined,
    }
  }

  return { mark, clear, motion }
}
