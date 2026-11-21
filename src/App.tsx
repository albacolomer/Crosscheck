import { useState } from 'react'
import { InsightsPage } from './features/insights/InsightsPage'
import { LiveDashboard } from './features/live/LiveDashboard'
import { demoChecks } from './features/live/mock-data'

function App() {
  const [screen, setScreen] = useState<'live' | 'insights'>('live')

  if (screen === 'insights') {
    return <InsightsPage checks={demoChecks} onBack={() => setScreen('live')} />
  }

  return <LiveDashboard onEndInterview={() => setScreen('insights')} />
}

export default App
