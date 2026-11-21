import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import './live-motion.css'

const WORD_STAGGER_MS = 35
const MAX_STAGGER_STEPS = 8

// Words already shown per segment. It survives remounts, such as the claim
// highlight replacing the plain paragraph or the transcript filter toggling.
const shownWordCounts = new Map<string, number>()

function splitWords(text: string) {
  return text.match(/\S+/gu) ?? []
}

interface AnimatedTextProps {
  id: string
  text: string
}

/**
 * Renders transcript text word by word. Words keep their index as React key,
 * so a growing partial segment only mounts — and animates — the new words.
 */
export function AnimatedText({ id, text }: AnimatedTextProps) {
  const words = splitWords(text)
  // Words below this index were shown before this instance mounted.
  const [skipBelow] = useState(() => shownWordCounts.get(id) ?? 0)
  const [batch, setBatch] = useState(() => ({ text, firstNewWord: skipBelow }))

  if (batch.text !== text) {
    // Words added by this update form one batch that shares the stagger.
    setBatch({ text, firstNewWord: splitWords(batch.text).length })
  }

  useEffect(() => {
    shownWordCounts.set(id, Math.max(shownWordCounts.get(id) ?? 0, words.length))
  }, [id, words.length])

  return words.map((word, index) => {
    const animated = index >= skipBelow
    const step = index - batch.firstNewWord
    const style = animated && step > 0
      ? { '--live-word-delay': `${Math.min(step, MAX_STAGGER_STEPS) * WORD_STAGGER_MS}ms` } as CSSProperties
      : undefined
    return (
      <Fragment key={index}>
        {index > 0 && ' '}
        <span className={animated ? 'live-word' : undefined} style={style}>{word}</span>
      </Fragment>
    )
  })
}
