import type { ClaimCheck, TranscriptSegment } from '../../shared/types'

/** A claim located inside a segment, as a whole-word range of the segment text. */
export interface LocatedClaim {
  check: ClaimCheck
  /** Index of the first word of the claim (words are runs of non-whitespace). */
  fromWord: number
  /** Index one past the last word of the claim. */
  toWord: number
}

export interface SegmentClaims {
  /** Claims found in the text, sorted by position and never overlapping. */
  located: LocatedClaim[]
  /**
   * Claims of this segment whose quote could not be placed in its text (for example,
   * a quote that joins the end of the question with the start of the answer).
   */
  trailing: ClaimCheck[]
}

interface CharRange { start: number; end: number }

/**
 * Lowercases, strips diacritics, and reduces punctuation and whitespace runs to single
 * spaces. `map[i]` is the index in `text` of the character that produced output char `i`.
 */
function normalize(text: string) {
  let value = ''
  const map: number[] = []
  let index = 0
  for (const char of text) {
    if (/[\p{L}\p{N}]/u.test(char)) {
      for (const folded of char.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()) {
        value += folded
        map.push(index)
      }
    } else if (value && !value.endsWith(' ')) {
      value += ' '
      map.push(index)
    }
    index += char.length
  }
  if (value.endsWith(' ')) {
    value = value.slice(0, -1)
    map.pop()
  }
  return { value, map }
}

function allIndexes(haystack: string, needle: string) {
  const indexes: number[] = []
  if (!needle) return indexes
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) indexes.push(at)
  return indexes
}

/** Character ranges where `quote` occurs: exact matches first, else normalized whole-word matches. */
function findOccurrences(text: string, quote: string): CharRange[] {
  const trimmed = quote.trim()
  if (!trimmed) return []
  const exact = allIndexes(text, trimmed).map((start) => ({ start, end: start + trimmed.length }))
  if (exact.length) return exact

  const source = normalize(text)
  const needle = normalize(trimmed).value
  return allIndexes(source.value, needle)
    .filter((at) => (at === 0 || source.value[at - 1] === ' ') && (at + needle.length === source.value.length || source.value[at + needle.length] === ' '))
    .map((at) => ({ start: source.map[at], end: source.map[at + needle.length - 1] + 1 }))
}

/** Converts a character range to the words it touches, so spans never split a word. */
function toWordRange(text: string, range: CharRange) {
  let fromWord = -1
  let toWord = 0
  let word = 0
  for (const match of text.matchAll(/\S+/gu)) {
    const start = match.index
    const end = start + match[0].length
    if (end > range.start && start < range.end) {
      if (fromWord === -1) fromWord = word
      toWord = word + 1
    }
    word += 1
  }
  return fromWord === -1 ? undefined : { fromWord, toWord }
}

/** True when `text` contains `quote` exactly or modulo case, accents, punctuation, and spacing. */
export function textContainsQuote(text: string, quote: string) {
  return findOccurrences(text, quote).length > 0
}

/** Claim ids are `${segment.id}:c${n}` when the backend extracted them from that segment. */
function isOwnedBy(check: ClaimCheck, segment: TranscriptSegment) {
  return check.id.startsWith(`${segment.id}:`)
}

/**
 * The final segment a claim belongs to: the segment it was extracted from, else the
 * first final segment whose text contains its quote.
 */
export function findClaimSegment(check: ClaimCheck, transcript: TranscriptSegment[]) {
  const finals = transcript.filter((segment) => segment.isFinal)
  return finals.find((segment) => isOwnedBy(check, segment))
    ?? finals.find((segment) => textContainsQuote(segment.text, check.originalQuote))
}

/**
 * Groups claims by segment and places each one in its segment's text. Longer quotes are
 * placed first, each at its earliest occurrence that does not overlap a placed claim, so
 * repeated quotes spread over their occurrences. A claim with no free occurrence is
 * listed as trailing so it still shows its own verdict.
 */
export function groupClaimsBySegment(checks: ClaimCheck[], transcript: TranscriptSegment[]) {
  const bySegment = new Map<string, ClaimCheck[]>()
  for (const check of checks) {
    const segment = findClaimSegment(check, transcript)
    if (segment) bySegment.set(segment.id, [...(bySegment.get(segment.id) ?? []), check])
  }

  const result = new Map<string, SegmentClaims>()
  for (const segment of transcript) {
    const segmentChecks = bySegment.get(segment.id)
    if (segmentChecks) result.set(segment.id, locateClaims(segment.text, segmentChecks))
  }
  return result
}

function locateClaims(text: string, checks: ClaimCheck[]): SegmentClaims {
  const candidates = checks.map((check, order) => ({
    check,
    order,
    occurrences: findOccurrences(text, check.originalQuote)
      .map((range) => toWordRange(text, range))
      .filter((range) => range !== undefined),
  }))
  // Longer quotes are placed first so a short quote cannot split a longer claim.
  candidates.sort((a, b) => b.check.originalQuote.trim().length - a.check.originalQuote.trim().length || a.order - b.order)

  const located: LocatedClaim[] = []
  const trailing: ClaimCheck[] = []
  for (const { check, occurrences } of candidates) {
    const free = occurrences.find((range) => located.every((taken) => range.toWord <= taken.fromWord || range.fromWord >= taken.toWord))
    if (free) located.push({ check, ...free })
    else trailing.push(check)
  }
  located.sort((a, b) => a.fromWord - b.fromWord)
  trailing.sort((a, b) => checks.indexOf(a) - checks.indexOf(b))
  return { located, trailing }
}
