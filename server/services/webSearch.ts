/**
 * P4-B — neutral evidence retrieval through Tavily.
 *
 * `createWebSearch` returns a `SearchEvidence` function that searches for material able to
 * support OR contradict one normalized claim and returns validated, deduplicated
 * `SearchSource` records. It never assigns a stance or verdict and never calls a model.
 *
 * Behavior:
 * - Construction is offline: no client is created and no request is sent until the first call.
 * - A missing or blank `apiKey` is reported at call time as PipelineError('CONFIGURATION'),
 *   so the server can still boot without Tavily credentials. The SDK's own
 *   `TAVILY_API_KEY`/keyless fallbacks are never used.
 * - Up to two queries run in parallel with `basic` depth. If at least one succeeds its records
 *   are used; if all fail the most relevant failure is thrown.
 * - Failures: abort → 'ABORTED', `timeoutMs` (default 12000) → 'TIMEOUT', HTTP 401/403 →
 *   'CONFIGURATION', other upstream/network failures → 'PROVIDER', unusable response shape →
 *   'INVALID_OUTPUT'. Messages never contain the API key or upstream bodies.
 * - A successful search with no usable records resolves `[]`.
 */
import { tavily, TavilyRequestError, type TavilyClient } from '@tavily/core'
import {
  PipelineError,
  type InterviewContext,
  type SearchEvidence,
  type SearchInput,
  type SearchSource,
  type WebSearchOptions,
} from './pipeline/contracts.ts'

const DEFAULT_MAX_RESULTS = 5
const DEFAULT_TIMEOUT_MS = 12_000
const MAX_SOURCES = 8
const MAX_CONTENT_CHARS = 1_500
/** Tavily rejects queries longer than 400 characters. */
const MAX_QUERY_CHARS = 380

export function createWebSearch(options: WebSearchOptions): SearchEvidence {
  const apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : ''
  const maxResults = clampInteger(options.maxResults, DEFAULT_MAX_RESULTS, 1, 20)
  const timeoutMs = clampInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1_000, 120_000)
  let client: TavilyClient | undefined

  return async function searchEvidence(input: SearchInput, signal?: AbortSignal): Promise<SearchSource[]> {
    if (signal?.aborted) throw new PipelineError('ABORTED', 'Evidence search was aborted.')
    if (!apiKey) throw new PipelineError('CONFIGURATION', 'Tavily API key is not configured.')

    const queries = buildQueries(input)
    if (queries.length === 0) throw new PipelineError('INVALID_OUTPUT', 'Claim has no searchable text.')

    client ??= tavily({ apiKey })
    const search = client.search
    const requestTimeoutSeconds = Math.ceil(timeoutMs / 1000)

    const settled = await withDeadline(
      Promise.allSettled(
        queries.map((query) =>
          search(query, {
            searchDepth: 'basic',
            topic: 'general',
            maxResults,
            includeAnswer: false,
            includeRawContent: false,
            includeImages: false,
            timeout: requestTimeoutSeconds,
          }),
        ),
      ),
      timeoutMs,
      signal,
    )

    const records: unknown[] = []
    const failures: PipelineError[] = []
    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        failures.push(toPipelineError(outcome.reason))
        continue
      }
      const results = readResults(outcome.value)
      if (results === undefined) {
        failures.push(new PipelineError('INVALID_OUTPUT', 'Tavily returned a malformed search response.'))
        continue
      }
      records.push(...results)
    }

    if (failures.length === settled.length) throw pickFailure(failures)
    return normalizeSources(records)
  }
}

// ---------------------------------------------------------------------------
// Queries

function buildQueries({ claim, context }: SearchInput): string[] {
  const base = collapse(claim.normalizedClaim)
  if (!base) return []

  const queries = [truncateQuery(base)]
  const subject = subjectHint(context, base)
  // Second query looks for independent data on the same claim (keeping its period, scope and
  // units because the claim text is reused verbatim), which can confirm or refute it.
  const second = truncateQuery(`${subject ? `${subject} ` : ''}${base} official data report`)
  if (second !== queries[0]) queries.push(second)
  return queries
}

/** Adds the interviewee and role only when the normalized claim does not already name them. */
function subjectHint(context: InterviewContext | undefined, claimText: string): string {
  const lowerClaim = claimText.toLowerCase()
  const parts = [context?.intervieweeName, context?.intervieweeRole]
    .map((part) => (typeof part === 'string' ? collapse(part) : ''))
    .filter((part) => part && part.length <= 80 && !lowerClaim.includes(part.toLowerCase()))
  return parts.join(' ')
}

function truncateQuery(query: string): string {
  if (query.length <= MAX_QUERY_CHARS) return query
  const cut = query.slice(0, MAX_QUERY_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > MAX_QUERY_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trim()
}

// ---------------------------------------------------------------------------
// Response validation and normalization

function readResults(response: unknown): unknown[] | undefined {
  if (!isRecord(response)) return undefined
  return Array.isArray(response.results) ? response.results : undefined
}

interface Candidate {
  key: string
  title: string
  url: string
  content: string
  score?: number
  publishedDate?: string
}

function normalizeSources(records: unknown[]): SearchSource[] {
  const byKey = new Map<string, Candidate>()
  for (const record of records) {
    const candidate = toCandidate(record)
    if (!candidate) continue
    const existing = byKey.get(candidate.key)
    if (!existing || (candidate.score ?? -Infinity) > (existing.score ?? -Infinity)) {
      byKey.set(candidate.key, candidate)
    }
  }

  return [...byKey.values()]
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .slice(0, MAX_SOURCES)
    .map(({ title, url, content, score, publishedDate }, index) => {
      const source: SearchSource = { id: `s${index + 1}`, title, url, content }
      if (score !== undefined) source.score = score
      if (publishedDate !== undefined) source.publishedDate = publishedDate
      return source
    })
}

function toCandidate(record: unknown): Candidate | undefined {
  if (!isRecord(record)) return undefined
  const title = typeof record.title === 'string' ? collapse(record.title) : ''
  const url = typeof record.url === 'string' ? record.url.trim() : ''
  const content = typeof record.content === 'string' ? truncateContent(collapse(record.content)) : ''
  if (!title || !url || !content) return undefined

  const key = urlKey(url)
  if (!key) return undefined

  const candidate: Candidate = { key, title, url, content }
  if (typeof record.score === 'number' && Number.isFinite(record.score)) candidate.score = record.score
  if (typeof record.publishedDate === 'string' && record.publishedDate.trim()) {
    candidate.publishedDate = record.publishedDate.trim()
  }
  return candidate
}

/** Dedupe key for http(s) URLs: no hash, no `www.`, no trailing slash. Unsafe schemes → undefined. */
function urlKey(raw: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
  if (!parsed.hostname) return undefined
  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname.replace(/\/+$/, '')
  return `${host}${parsed.port ? `:${parsed.port}` : ''}${path}${parsed.search}`
}

function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text
  const cut = text.slice(0, MAX_CONTENT_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > MAX_CONTENT_CHARS * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// ---------------------------------------------------------------------------
// Errors, timeout, cancellation

/**
 * Resolves with `work` unless the deadline passes or the signal aborts first. The SDK does not
 * accept an AbortSignal, so an abandoned request is bounded by its own SDK timeout instead.
 */
function withDeadline<T>(work: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new PipelineError('TIMEOUT', `Evidence search timed out after ${timeoutMs} ms.`))
    }, timeoutMs)
    const onAbort = () => {
      cleanup()
      reject(new PipelineError('ABORTED', 'Evidence search was aborted.'))
    }
    function cleanup() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    work.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(toPipelineError(error))
      },
    )
  })
}

/** Maps SDK failures to sanitized PipelineErrors. Upstream messages and bodies are discarded. */
function toPipelineError(error: unknown): PipelineError {
  if (error instanceof PipelineError) return error
  if (error instanceof TavilyRequestError) {
    if (error.status === 401 || error.status === 403) {
      return new PipelineError('CONFIGURATION', `Tavily rejected the API key (HTTP ${error.status}).`)
    }
    return new PipelineError('PROVIDER', `Tavily search failed (HTTP ${error.status}).`)
  }
  // The SDK maps response fields without checking them, so a malformed body surfaces as a TypeError.
  if (error instanceof TypeError) {
    return new PipelineError('INVALID_OUTPUT', 'Tavily returned a malformed search response.')
  }
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return new PipelineError('TIMEOUT', 'Tavily search request timed out.')
  }
  return new PipelineError('PROVIDER', 'Tavily search request failed.')
}

const FAILURE_PRIORITY: Record<PipelineError['code'], number> = {
  ABORTED: 0,
  CONFIGURATION: 1,
  TIMEOUT: 2,
  PROVIDER: 3,
  INVALID_OUTPUT: 4,
}

function pickFailure(failures: PipelineError[]): PipelineError {
  return failures.reduce((best, next) => (FAILURE_PRIORITY[next.code] < FAILURE_PRIORITY[best.code] ? next : best))
}

// ---------------------------------------------------------------------------
// Small helpers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
