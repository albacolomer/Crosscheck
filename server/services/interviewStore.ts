import { randomUUID } from 'node:crypto'
import type { InterviewContext, TranscriptSegment, ClaimCheck } from '../../shared/types.ts'
import type { InterviewSnapshot, ProcessingJob, SummaryResponse } from '../../shared/api.ts'
import type { AiPipeline, ExtractedClaim } from '../types/pipeline.ts'
import { ApiError } from '../routes/validation.ts'
import { PipelineUnavailableError } from './pipelineAdapter.ts'

interface Session {
  state: InterviewSnapshot
  listeners: Set<(snapshot: InterviewSnapshot) => void>
  claims: Map<string, { job: ProcessingJob; factCheck: ClaimCheck }>
}

const normalize = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export class InterviewStore {
  private sessions = new Map<string, Session>()
  private queue: Array<() => Promise<void>> = []
  private active = 0
  private pipeline: AiPipeline
  private timeoutMs: number

  constructor(pipeline: AiPipeline, timeoutMs = 30000) {
    this.pipeline = pipeline
    this.timeoutMs = timeoutMs
  }

  create(context: InterviewContext) {
    const interview = { ...structuredClone(context), id: randomUUID(), createdAt: Date.now() }
    this.sessions.set(interview.id, {
      state: { interview, transcript: [], factChecks: [], jobs: [] },
      listeners: new Set(), claims: new Map(),
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

  ingest(id: string, segment: TranscriptSegment) {
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
    if (segment.isFinal) this.queueExtraction(session, segment)
    this.publish(session)
    return { segment: structuredClone(segment), duplicate: false }
  }

  private queueExtraction(session: Session, segment: TranscriptSegment, job?: ProcessingJob) {
    const extraction: ProcessingJob = job ?? { id: randomUUID(), kind: 'extraction', status: 'queued', segmentId: segment.id }
    if (!job) session.state.jobs.push(extraction)
    this.enqueue(session, extraction, async signal => {
      const claims = await this.pipeline.extractClaims({
        context: this.context(session),
        segment: structuredClone(segment),
      }, signal)
      if (!Array.isArray(claims) || claims.length > 20 || claims.some(claim => !validClaim(claim))) {
        throw new Error('Invalid claim extraction result.')
      }
      return () => {
        for (const claim of claims) this.queueClaim(session, { ...claim, timestampMs: segment.timestampMs })
      }
    })
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

  private queueClaim(session: Session, claim: ExtractedClaim) {
    const key = normalize(claim.normalizedClaim)
    const previous = session.claims.get(key)
    if (previous) return { ...previous, duplicate: true }
    const factCheck: ClaimCheck = {
      ...claim, status: 'CHECKING', evidence: [], suggestedQuestions: [],
    }
    if (session.state.factChecks.some(check => check.id === factCheck.id)) factCheck.id = randomUUID()
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
      const result = await this.pipeline.checkClaim({
        context: this.context(session),
        claim: { id, originalQuote, normalizedClaim, timestampMs },
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
        job.error = error instanceof PipelineUnavailableError
          ? error.message
          : controller.signal.aborted ? 'Processing timed out.' : 'Fact-check pipeline processing failed.'
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
    const failedClaimIds = new Set(jobs.filter(job => job.status === 'failed').map(job => job.claimId))
    const completed = factChecks.filter(c => c.status !== 'CHECKING' && !failedClaimIds.has(c.id))
    const pendingJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running').length
    const count = (status: ClaimCheck['status']) => completed.filter(c => c.status === status).length
    return {
      summary: {
        totalClaims: completed.length, supported: count('SUPPORTED'), contradicted: count('CONTRADICTED'),
        misleading: count('MISLEADING'), unverified: count('UNVERIFIED'),
        keyFindings: completed.filter(c => c.status !== 'UNVERIFIED').map(c => `${c.normalizedClaim}: ${c.explanation ?? c.status}`),
        unansweredQuestions: [...new Set(completed.filter(c => c.status === 'UNVERIFIED').flatMap(c => c.suggestedQuestions.length ? c.suggestedQuestions.map(q => q.text) : [c.normalizedClaim]))],
      },
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
