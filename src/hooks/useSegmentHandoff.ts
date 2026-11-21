import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSegmentInterview, streamSegmentAcknowledgements } from '../services/interviews/segmentHandoff.ts'

type HandoffStatus = 'idle' | 'preparing' | 'connecting' | 'connected' | 'reconnecting' | 'error'
type InterviewSelection = { initialId: string | undefined }

interface HandoffState {
  status: HandoffStatus
  error: string | null
  acknowledgedSegmentIds: ReadonlySet<string>
}

const emptyIds: ReadonlySet<string> = new Set<string>()
const idle: HandoffState = { status: 'idle', error: null, acknowledgedSegmentIds: emptyIds }

export function useSegmentHandoff(initialInterviewId?: string) {
  const initialId = initialInterviewId?.trim() || undefined
  const selection = useMemo(() => ({ initialId }), [initialId])
  const request = useRef<{ selection: InterviewSelection; controller: AbortController } | null>(null)
  const [prepared, setPrepared] = useState<{ selection: InterviewSelection; id: string }>()
  const [preparation, setPreparation] = useState<{
    selection: InterviewSelection
    status: 'preparing' | 'error'
    error: string | null
  }>()
  const [stream, setStream] = useState<HandoffState & { selection: InterviewSelection; interviewId: string }>()
  const interviewId = prepared?.selection === selection ? prepared.id : selection.initialId

  useEffect(() => () => {
    const pending = request.current
    if (pending?.selection === selection) {
      pending.controller.abort()
      request.current = null
    }
  }, [selection])

  useEffect(() => {
    if (!interviewId) return

    return streamSegmentAcknowledgements(interviewId, (update) => {
      setStream((current) => {
        if (update.status === 'connected') {
          return { selection, interviewId, status: 'connected', error: null, acknowledgedSegmentIds: update.segmentIds }
        }

        const acknowledgedSegmentIds = current?.selection === selection && current.interviewId === interviewId
          ? current.acknowledgedSegmentIds
          : emptyIds
        return { selection, interviewId, status: update.status, error: update.error, acknowledgedSegmentIds }
      })
    })
  }, [interviewId, selection])

  const prepare = useCallback(async () => {
    if (request.current) return

    const controller = new AbortController()
    request.current = { selection, controller }
    setPreparation({ selection, status: 'preparing', error: null })
    try {
      const id = await createSegmentInterview(controller.signal)
      if (controller.signal.aborted) return
      setPrepared({ selection, id })
      setPreparation(undefined)
    } catch (error) {
      if (controller.signal.aborted) return
      setPreparation({
        selection,
        status: 'error',
        error: error instanceof TypeError || !(error instanceof Error)
          ? 'Could not connect to the backend to prepare an interview.'
          : error.message,
      })
    } finally {
      if (request.current?.controller === controller) request.current = null
    }
  }, [selection])

  const state: HandoffState = stream?.selection === selection && stream.interviewId === interviewId
    ? stream
    : { ...idle, status: interviewId ? 'connecting' : 'idle' }
  const currentPreparation = preparation?.selection === selection ? preparation : undefined

  return {
    interviewId,
    status: currentPreparation?.status ?? state.status,
    error: currentPreparation ? currentPreparation.error : state.error,
    acknowledgedSegmentIds: state.acknowledgedSegmentIds,
    prepare,
  }
}
