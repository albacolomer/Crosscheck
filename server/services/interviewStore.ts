import { randomUUID } from 'node:crypto'
import type { InterviewContext, TranscriptSegment, ClaimCheck } from '../../shared/types.ts'
import type { InterviewSnapshot, ProcessingJob, SummaryResponse } from '../../shared/api.ts'
import type { AiPipeline, ClaimConversation, ExtractedClaim } from '../types/pipeline.ts'
import { ApiError } from '../routes/validation.ts'
import { PipelineUnavailableError } from './pipelineAdapter.ts'
import { PipelineError } from './pipeline/contracts.ts'
import { summarizeInterview } from './summaryGenerator.ts'

interface Session {
  state: InterviewSnapshot
  listeners: Set<(snapshot: InterviewSnapshot) => void>
  claims: Map<string, { job: ProcessingJob; factCheck: ClaimCheck }>
  /** Conversation each extracted claim was made in, by claim id; reused when its check is retried. */
  conversations: Map<string, ClaimConversation>
  /** Final segments whose extraction waits briefly for a diarization speaker label. */
  awaitingSpeaker: Map<string, () => void>
}

export interface IngestOptions {
  /**
   * Diarization will label this segment shortly: delay its extraction (never its publication) until
   * the label arrives or SPEAKER_WAIT_MS passes, so interviewer questions can be skipped by speaker.
   */
  awaitSpeaker?: boolean
}

export const DEFAULT_JOB_TIMEOUT_MS = 45000

/** Upper bound on how long extraction waits for a diarization speaker label (labels usually take 1–3 s). */
export const SPEAKER_WAIT_MS = 3500

/** Preceding final segments sent to extraction as conversational context. */
const RECENT_SEGMENTS = 6

const normalize = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export class InterviewStore {
  private sessions = new Map<string, Session>()
  private queue: Array<() => Promise<void>> = []
  private active = 0
  private pipeline: AiPipeline
  private timeoutMs: number

  /**
   * Per-job budget, measured from when the job starts running (not while queued). A fact-check job is
   * one Tavily search (12s cap) plus one OpenAI analysis call (20s cap), so 45s leaves headroom over 32s.
   */
  constructor(pipeline: AiPipeline, timeoutMs = DEFAULT_JOB_TIMEOUT_MS) {
    this.pipeline = pipeline
    this.timeoutMs = timeoutMs
  }

  create(context: InterviewContext) {
    const interview = { ...structuredClone(context), id: randomUUID(), createdAt: Date.now() }
    this.sessions.set(interview.id, {
      state: { interview, transcript: [], factChecks: [], jobs: [] },
      listeners: new Set(), claims: new Map(), conversations: new Map(), awaitingSpeaker: new Map(),
    })
    return structuredClone(interview)
  }

  private session(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new ApiError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found.')
    return session
  }

  snapshot(id: string): InterviewSnapshot { return structuredClone(this.session(id).state) }

  subscribe(id: string, listener: (snapshot: InterviewSnapshot) => void) {
    const session = this.session(id)
    session.listeners.add(listener)
    return () => { session.listeners.delete(listener) }
  }

  private publish(session: Session) {
    for (const listener of session.listeners) listener(structuredClone(session.state))
  }

  private requireOpen(session: Session) {
    if (session.state.interview.endedAt !== undefined) throw new ApiError(409, 'INTERVIEW_ENDED', 'Interview has ended.')
  }

  ingest(id: string, segment: TranscriptSegment, options: IngestOptions = {}) {
    const session = this.session(id)
    this.requireOpen(session)
    const index = session.state.transcript.findIndex(entry => entry.id === segment.id)
    const existing = session.state.transcript[index]
    if (existing?.isFinal) {
      if (segment.isFinal && !sameSegment(existing, segment)) {
        throw new ApiError(409, 'SEGMENT_FINALIZED', 'A final segment cannot be changed.')
      }
      return { segment: structuredClone(existing), duplicate: true }
    }
    if (existing && sameSegment(existing, segment)) return { segment: structuredClone(existing), duplicate: true }
    if (existing) session.state.transcript[index] = structuredClone(segment)
    else session.state.transcript.push(structuredClone(segment))
    session.state.transcript.sort((a, b) => a.timestampMs - b.timestampMs)
    if (segment.isFinal) {
      if (options.awaitSpeaker && !segment.speaker) this.queueExtractionAfterSpeaker(session, segment)
      else this.queueExtraction(session, segment)
    }
    this.publish(session)
    return { segment: structuredClone(segment), duplicate: false }
  }

  /**
   * Attaches a speaker label to an existing segment. Diarization finishes after a segment is final,
   * so this is the only change allowed to a final segment; it also applies after the interview ends.
   */
  setSpeaker(id: string, segmentId: string, speaker: string) {
    const session = this.session(id)
    const segment = session.state.transcript.find(entry => entry.id === segmentId)
    if (!segment || segment.speaker === speaker) return
    segment.speaker = speaker
    session.awaitingSpeaker.get(segmentId)?.()
    this.publish(session)
  }

  /** Shows the extraction job as queued now and starts it when the speaker label arrives or the wait expires. */
  private queueExtractionAfterSpeaker(session: Session, segment: TranscriptSegment) {
    const job: ProcessingJob = { id: randomUUID(), kind: 'extraction', status: 'queued', segmentId: segment.id }
    session.state.jobs.push(job)
    const start = () => {
      clearTimeout(timer)
      if (session.awaitingSpeaker.get(segment.id) !== start) return
      session.awaitingSpeaker.delete(segment.id)
      this.queueExtraction(session, segment, job)
    }
    const timer = setTimeout(start, SPEAKER_WAIT_MS)
    timer.unref?.()
    session.awaitingSpeaker.set(segment.id, start)
  }

  private queueExtraction(session: Session, segment: TranscriptSegment, job?: ProcessingJob) {
    const extraction: ProcessingJob = job ?? { id: randomUUID(), kind: 'extraction', status: 'queued', segmentId: segment.id }
    if (!job) session.state.jobs.push(extraction)
    this.enqueue(session, extraction, async signal => {
      // Read the stored copy so a speaker label attached after ingestion is included.
      const current = session.state.transcript.find(entry => entry.id === segment.id) ?? segment
      const recentSegments = this.recentSegments(session, current)
      const claims = await this.pipeline.extractClaims({
        context: this.context(session),
        segment: structuredClone(current),
        recentSegments,
      }, signal)
      if (!Array.isArray(claims) || claims.length > 20 || claims.some(claim => !validClaim(claim))) {
        throw new Error('Invalid claim extraction result.')
      }
      return () => {
        // Verification sees the same conversation extraction saw, ending with the claim's segment.
        const segments = [...recentSegments, structuredClone(current)]
        for (const claim of claims) {
          const subject = typeof claim.subject === 'string' && claim.subject.trim() ? claim.subject.trim().slice(0, 200) : undefined
          this.queueClaim(session, { ...claim, timestampMs: segment.timestampMs }, subject ? { segments, subject } : { segments })
        }
      }
    })
  }

  private recentSegments(session: Session, segment: TranscriptSegment): TranscriptSegment[] {
    const index = session.state.transcript.findIndex(entry => entry.id === segment.id)
    const preceding = index === -1 ? session.state.transcript : session.state.transcript.slice(0, index)
    return structuredClone(preceding.filter(entry => entry.isFinal && entry.id !== segment.id).slice(-RECENT_SEGMENTS))
  }

  private context(session: Session): InterviewContext {
    const { title, intervieweeName, intervieweeRole, background, topics, keyQuestions } = session.state.interview
    return structuredClone({ title, intervieweeName, intervieweeRole, background, topics, keyQuestions })
  }

  check(id: string, claim: string, originalQuote = claim) {
    const session = this.session(id)
    this.requireOpen(session)
    return structuredClone(this.queueClaim(session, {
      id: randomUUID(), normalizedClaim: claim, originalQuote, timestampMs: Date.now() - session.state.interview.createdAt,
    }))
  }

  private queueClaim(session: Session, claim: ExtractedClaim, conversation?: ClaimConversation) {
    const key = normalize(claim.normalizedClaim)
    const previous = session.claims.get(key)
    if (previous) return { ...previous, duplicate: true }
    const { id, originalQuote, normalizedClaim, timestampMs } = claim
    const factCheck: ClaimCheck = {
      id, originalQuote, normalizedClaim, timestampMs, status: 'CHECKING', evidence: [], suggestedQuestions: [],
    }
    if (session.state.factChecks.some(check => check.id === factCheck.id)) factCheck.id = randomUUID()
    if (conversation) session.conversations.set(factCheck.id, conversation)
    const job: ProcessingJob = { id: randomUUID(), kind: 'fact-check', status: 'queued', claimId: factCheck.id }
    session.claims.set(key, { job, factCheck })
    session.state.factChecks.push(factCheck)
    session.state.jobs.push(job)
    this.queueCheck(session, job, factCheck)
    this.publish(session)
    return { job, factCheck, duplicate: false }
  }

  private queueCheck(session: Session, job: ProcessingJob, factCheck: ClaimCheck) {
    const { id, originalQuote, normalizedClaim, timestampMs } = factCheck
    this.enqueue(session, job, async signal => {
      const conversation = session.conversations.get(id)
      const result = await this.pipeline.checkClaim({
        context: this.context(session),
        claim: { id, originalQuote, normalizedClaim, timestampMs, ...(conversation?.subject ? { subject: conversation.subject } : {}) },
        ...(conversation ? { conversation: structuredClone(conversation) } : {}),
      }, signal)
      validateResult(result, id)
      const { status, explanation, confidence, evidence, suggestedQuestions } = structuredClone(result)
      return () => { Object.assign(factCheck, { status, explanation, confidence, evidence, suggestedQuestions }) }
    })
  }

  private enqueue(session: Session, job: ProcessingJob, work: (signal: AbortSignal) => Promise<() => void>) {
    job.status = 'queued'
    delete job.error
    this.queue.push(async () => {
      job.status = 'running'
      this.publish(session)
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const commit = await Promise.race([
          Promise.resolve().then(() => work(controller.signal)),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Processing timed out.')) }, this.timeoutMs)
          }),
        ])
        commit()
        job.status = 'completed'
      } catch (error) {
        // Provider errors may contain API keys or private upstream response bodies.
        job.status = 'failed'
        // PipelineError messages are sanitized by contract (no keys, no upstream bodies).
        job.error = error instanceof PipelineUnavailableError
          ? error.message
          : controller.signal.aborted ? 'Processing timed out.'
          : error instanceof PipelineError ? `${error.code}: ${error.message}` : 'Fact-check pipeline processing failed.'
        const check = session.state.factChecks.find(c => c.id === job.claimId)
        if (check) Object.assign(check, { status: 'UNVERIFIED', confidence: 0, explanation: job.error })
      } finally {
        clearTimeout(timer)
        this.publish(session)
      }
    })
    setImmediate(() => this.drain())
  }

  private drain() {
    while (this.active < 2 && this.queue.length) {
      const work = this.queue.shift()!
      this.active++
      void work().finally(() => { this.active--; this.drain() })
    }
  }

  end(id: string) {
    const session = this.session(id)
    session.state.interview.endedAt ??= Date.now()
    this.publish(session)
    return this.snapshot(id)
  }

  retry(id: string, jobId: string) {
    const session = this.session(id)
    const job = session.state.jobs.find(j => j.id === jobId)
    if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.')
    if (job.status !== 'failed') throw new ApiError(409, 'JOB_NOT_FAILED', 'Only failed jobs can be retried.')
    if (job.kind === 'extraction') {
      const segment = session.state.transcript.find(s => s.id === job.segmentId)!
      this.queueExtraction(session, segment, job)
    } else {
      const check = session.state.factChecks.find(c => c.id === job.claimId)!
      check.status = 'CHECKING'
      delete check.explanation
      delete check.confidence
      this.queueCheck(session, job, check)
    }
    this.publish(session)
    return structuredClone(job)
  }

  summary(id: string): SummaryResponse {
    const { factChecks, jobs } = this.session(id).state
    // Failed checks carry a placeholder UNVERIFIED status; they are not investigations, so exclude them.
    const failedClaimIds = new Set(jobs.filter(job => job.status === 'failed').map(job => job.claimId))
    const pendingJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running').length
    return {
      summary: summarizeInterview({ checks: factChecks.filter(c => !failedClaimIds.has(c.id)) }),
      pendingJobs, failedJobs: jobs.filter(j => j.status === 'failed').length, isComplete: pendingJobs === 0,
    }
  }
}

function sameSegment(left: TranscriptSegment, right: TranscriptSegment) {
  return left.id === right.id && left.isFinal === right.isFinal && left.text === right.text &&
    left.timestampMs === right.timestampMs && left.speaker === right.speaker
}

function validClaim(claim: ExtractedClaim) {
  return claim && typeof claim.id === 'string' && claim.id.trim() && claim.id.length <= 200 &&
    typeof claim.normalizedClaim === 'string' && claim.normalizedClaim.trim() && claim.normalizedClaim.length <= 10000 &&
    typeof claim.originalQuote === 'string' && claim.originalQuote.trim() && claim.originalQuote.length <= 10000
}

function validateResult(result: ClaimCheck, id: string) {
  if (!result || result.id !== id || !['SUPPORTED', 'CONTRADICTED', 'MISLEADING', 'UNVERIFIED'].includes(result.status) ||
      typeof result.explanation !== 'string' || (result.confidence !== undefined && (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1)) ||
      !Array.isArray(result.evidence) || !Array.isArray(result.suggestedQuestions)) throw new Error('Invalid fact-check result.')
  for (const evidence of result.evidence) {
    if (!evidence || typeof evidence.title !== 'string' || typeof evidence.summary !== 'string' || !['supporting', 'contradicting'].includes(evidence.stance)) throw new Error('Invalid evidence.')
    const url = new URL(evidence.url)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid evidence URL.')
  }
  for (const question of result.suggestedQuestions) {
    if (!question || typeof question.text !== 'string' || !['challenge', 'follow_up', 'context'].includes(question.type)) throw new Error('Invalid question.')
  }
  if (result.status !== 'UNVERIFIED' && !result.evidence.length) throw new Error('A verdict requires evidence.')
}
