import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const DURATION_MS = 260
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

type CollapsibleProps = {
  open: boolean
  children: ReactNode
  className?: string
}

/**
 * Expands its content from zero height when `open` turns on and collapses it before unmounting
 * when it turns off. Content clips only while animating, so focus rings stay visible.
 */
export function Collapsible({ open, children, className }: CollapsibleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const previousOpen = useRef(open)
  const [present, setPresent] = useState(open)

  if (open && !present) setPresent(true)
  if (!open && present && prefersReducedMotion()) setPresent(false)

  useLayoutEffect(() => {
    if (previousOpen.current === open) return
    previousOpen.current = open
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    // Clip before measuring so child margins count, and start from the current height so
    // reversing mid-animation does not jump.
    element.style.overflow = 'hidden'
    const running = animationRef.current
    const startHeight = running ? element.offsetHeight : open ? 0 : element.offsetHeight
    const startOpacity = running ? Number(getComputedStyle(element).opacity) : open ? 0 : 1
    running?.cancel()
    const endHeight = open ? element.offsetHeight : 0

    const animation = element.animate(
      [
        { height: `${startHeight}px`, opacity: startOpacity },
        { height: `${endHeight}px`, opacity: open ? 1 : 0 },
      ],
      { duration: DURATION_MS, easing: EASING, fill: open ? 'none' : 'forwards' },
    )
    animationRef.current = animation
    const settle = () => {
      if (animationRef.current !== animation) return
      animationRef.current = null
      element.style.overflow = ''
      if (!open) setPresent(false)
    }
    animation.onfinish = settle
    animation.oncancel = () => {
      if (animationRef.current === animation) element.style.overflow = ''
    }
  }, [open])

  if (!present) return null
  return <div ref={ref} className={className}>{children}</div>
}
