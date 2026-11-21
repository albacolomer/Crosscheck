import { useEffect, useState } from 'react'
import { PreparationPage, type PreparedInterview } from './pages/PreparationPage'
import { InsightsPage } from './features/insights/InsightsPage'
import { LiveDashboard } from './features/live/LiveDashboard'
import { demoChecks } from './features/live/mock-data'

type Page = 'preparation' | 'interview' | 'insights'

function pageFromLocation(): Page {
  if (window.location.pathname === '/interview') return 'interview'
  if (window.location.pathname === '/insights') return 'insights'
  return 'preparation'
}

function App() {
  const [page, setPage] = useState<Page>(pageFromLocation)
  const [interview, setInterview] = useState<PreparedInterview | null>(null)

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
    return <InsightsPage checks={demoChecks} onBack={() => navigate('interview')} />
  }

  return <LiveDashboard onEndInterview={() => navigate('insights')} />
}

export default App
