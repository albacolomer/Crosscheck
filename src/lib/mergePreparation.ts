import type { ParsedInterviewee } from '../../shared/preparation.ts'

const key = (value: string) => value.trim().toLocaleLowerCase()

/** Appends dictated people by name (case-insensitive) and fills blank fields of people already listed. */
export function mergeInterviewees<T extends ParsedInterviewee>(current: T[], dictated: ParsedInterviewee[]): ParsedInterviewee[] {
  const people: ParsedInterviewee[] = current
    .filter((person) => person.name.trim() || person.role.trim() || person.organization.trim())
    .map(({ name, role, organization }) => ({ name, role, organization }))
  for (const person of dictated) {
    const existing = people.find(({ name }) => key(name) === key(person.name))
    if (!existing) {
      people.push({ ...person })
      continue
    }
    if (!existing.role.trim()) existing.role = person.role
    if (!existing.organization.trim()) existing.organization = person.organization
  }
  return people
}

/** Union of topics, case-insensitive, using the canonical spelling from `known` when it matches. */
export function mergeTopics(current: string[], dictated: string[], known: string[]): string[] {
  const topics = [...current]
  for (const topic of dictated) {
    const value = known.find((name) => key(name) === key(topic)) ?? topic.trim()
    if (value && !topics.some((item) => key(item) === key(value))) topics.push(value)
  }
  return topics
}

/** Appends dictated notes that are not already present, dropping empty note drafts. */
export function mergeNotes(current: string[], dictated: string[]): string[] {
  const notes = current.filter((note) => note.trim())
  for (const note of dictated) {
    if (note.trim() && !notes.some((item) => key(item) === key(note))) notes.push(note.trim())
  }
  return notes
}
