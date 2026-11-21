import { useEffect, useState } from 'react'
import { PreparationPage, type PreparedInterview } from './pages/PreparationPage'
import { InsightsPage } from './features/insights/InsightsPage'
import { LiveDashboard } from './features/live/LiveDashboard'
import { useLiveInterview } from './hooks/useLiveInterview'

type Page = 'preparation' | 'interview' | 'insights'

function pageFromLocation(): Page {
  if (window.location.pathname === '/interview') return 'interview'
  if (window.location.pathname === '/insights') return 'insights'
  return 'preparation'
}

function App() {
  const [page, setPage] = useState<Page>(pageFromLocation)
  const [interview, setInterview] = useState<PreparedInterview | null>(null)
  const live = useLiveInterview(interview)

  useEffect(() => {
    function handlePopState() {
      setPage(pageFromLocation())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(nextPage: Page) {
    const path = nextPage === 'interview' ? '/interview' : nextPage === 'insights' ? '/insights' : '/'
    window.history.pushState({ page: nextPage }, '', path)
    setPage(nextPage)
  }

  function startInterview(context: PreparedInterview) {
    setInterview(context)
    navigate('interview')
  }

  if (page === 'preparation' || !interview) {
    return <PreparationPage onStart={startInterview} />
  }

  if (page === 'insights') {
    return <InsightsPage checks={live.factChecks} onBack={() => navigate('interview')} />
  }

  async function endInterview() {
    if (live.endedAt !== undefined || await live.end()) navigate('insights')
  }

  return (
    <LiveDashboard
      title={live.interview?.title ?? 'New interview'}
      intervieweeName={live.interview?.intervieweeName ?? interview.intervieweeName}
      transcript={live.transcript}
      checks={live.factChecks}
      connectionStatus={live.connectionStatus}
      recordingStatus={live.recordingStatus}
      error={live.recordingError ?? live.error}
      ending={live.ending}
      onStartRecording={live.start}
      onStopRecording={() => void live.stop()}
      onRetryConnection={live.retry}
      onEndInterview={() => void endInterview()}
    />
  )
}

export default App
