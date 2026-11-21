import { useEffect, useRef, useState } from 'react'
import { PreparationPage, type PreparedInterview } from './pages/PreparationPage'
import { InsightsPage } from './features/insights/InsightsPage'
import { clearShownWords } from './features/live/shown-words'
import { LiveDashboard } from './features/live/LiveDashboard'
import { useLiveInterview } from './hooks/useLiveInterview'
import { useSpeakerNames } from './hooks/useSpeakerNames'
import type { Participant } from './lib/speakers'

type Page = 'preparation' | 'interview' | 'insights'

const noParticipants: Participant[] = []

function pageFromLocation(): Page {
  if (window.location.pathname === '/interview') return 'interview'
  if (window.location.pathname === '/insights') return 'insights'
  return 'preparation'
}

function App() {
  const [page, setPage] = useState<Page>(pageFromLocation)
  const [interview, setInterview] = useState<PreparedInterview | null>(null)
  // Set when the user presses Start interview; recording starts as soon as the backend session is ready.
  const autoStart = useRef(false)
  const live = useLiveInterview(interview)
  const speakerNames = useSpeakerNames(interview?.interviewees ?? noParticipants, live.transcript)

  useEffect(() => {
    function handlePopState() {
      setPage(pageFromLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const { connectionStatus, recordingStatus, start: startRecording } = live
  useEffect(() => {
    if (!autoStart.current || connectionStatus !== 'connected' || recordingStatus !== 'idle') return
    autoStart.current = false
    startRecording()
  }, [connectionStatus, recordingStatus, startRecording])

  function navigate(nextPage: Page) {
    const path = nextPage === 'interview' ? '/interview' : nextPage === 'insights' ? '/insights' : '/'
    window.history.pushState({ page: nextPage }, '', path)
    setPage(nextPage)
  }

  function startInterview(context: PreparedInterview) {
    setInterview(context)
    autoStart.current = true
    navigate('interview')
  }

  /** Starts over with the same preparation context: a new backend interview that records right away. */
  function restartInterview() {
    if (!live.restart()) return
    speakerNames.reset()
    clearShownWords()
    autoStart.current = true
    if (page !== 'interview') navigate('interview')
  }

  if (page === 'preparation' || !interview) {
    return <PreparationPage onStart={startInterview} />
  }

  if (page === 'insights') {
    return (
      <InsightsPage
        interviewId={live.interviewId}
        createdAt={live.interview?.createdAt}
        title={live.interview?.title ?? 'New interview'}
        intervieweeName={live.interview?.intervieweeName ?? interview.intervieweeName}
        transcript={speakerNames.namedTranscript}
        checks={live.factChecks}
        jobs={live.jobs}
        onBack={() => navigate('interview')}
        onRestart={restartInterview}
      />
    )
  }

  async function endInterview() {
    if (live.endedAt !== undefined || await live.end()) navigate('insights')
  }

  return (
    <LiveDashboard
      key={live.session}
      title={live.interview?.title ?? 'New interview'}
      intervieweeName={live.interview?.intervieweeName ?? interview.intervieweeName}
      transcript={live.transcript}
      speakers={speakerNames.speakers}
      speakerCandidates={speakerNames.candidates}
      onRenameSpeaker={speakerNames.rename}
      onSwapSpeakers={speakerNames.swap}
      checks={live.factChecks}
      jobs={live.jobs}
      connectionStatus={live.connectionStatus}
      recordingStatus={live.recordingStatus}
      error={live.recordingError ?? live.error}
      ending={live.ending}
      restarting={live.restarting}
      onStartRecording={live.start}
      onStopRecording={() => void live.stop()}
      onRetryConnection={live.retry}
      onEndInterview={() => void endInterview()}
      onRestartInterview={restartInterview}
    />
  )
}

export default App
