// Words already shown per segment. It survives remounts, such as the claim
// highlight replacing the plain paragraph or the transcript filter toggling.
export const shownWordCounts = new Map<string, number>()

/** Forgets every segment's shown words, for example when the interview restarts. */
export function clearShownWords() {
  shownWordCounts.clear()
}
