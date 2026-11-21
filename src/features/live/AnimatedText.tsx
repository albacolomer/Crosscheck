import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import './live-motion.css'
import { shownWordCounts } from './shown-words'

const WORD_STAGGER_MS = 35
const MAX_STAGGER_STEPS = 8


function splitWords(text: string) {
  return text.match(/\S+/gu) ?? []
}

interface AnimatedTextProps {
  id: string
  /** The whole segment text, even when only a range of its words is rendered. */
  text: string
  /** First word to render; ranges let a segment be split into claim spans. */
  fromWord?: number
  /** One past the last word to render. */
  toWord?: number
}

/**
 * Renders transcript text word by word. Words keep their index in the whole
 * segment as identity, so a growing partial segment only mounts — and
 * animates — the new words, and splitting the text into ranges (claim spans)
 * does not replay words that were already shown.
 */
export function AnimatedText({ id, text, fromWord = 0, toWord }: AnimatedTextProps) {
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

  return words.slice(fromWord, toWord).map((word, offset) => {
    const index = fromWord + offset
    const animated = index >= skipBelow
    const step = index - batch.firstNewWord
    const style = animated && step > 0
      ? { '--live-word-delay': `${Math.min(step, MAX_STAGGER_STEPS) * WORD_STAGGER_MS}ms` } as CSSProperties
      : undefined
    return (
      <Fragment key={index}>
        {offset > 0 && ' '}
        <span className={animated ? 'live-word' : undefined} style={style}>{word}</span>
      </Fragment>
    )
  })
}
