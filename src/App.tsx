import { useEffect, useState } from 'react'
import { ArrowLeft, AudioLines } from 'lucide-react'
import { PreparationPage, type PreparedInterview } from './pages/PreparationPage'

type Page = 'preparation' | 'interview'

function pageFromLocation(): Page {
  return window.location.pathname === '/interview' ? 'interview' : 'preparation'
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
    const path = nextPage === 'interview' ? '/interview' : '/'
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

  // Replace this integration fallback with Person 2's live dashboard when that page lands.
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{interview.intervieweeName ? `Interview with ${interview.intervieweeName}` : 'New interview'}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Not recording</div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex"><AudioLines size={15} /> Interview</div>
        </div>
      </header>
      <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
        <p className="text-[11px] font-semibold tracking-[0.13em] text-emerald-800">LIVE INTERVIEW</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Dashboard not connected yet</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Your interview context has been passed to this screen. The live dashboard will appear here when Person 2's page is added.</p>
        <button type="button" onClick={() => navigate('preparation')} className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><ArrowLeft size={15} /> Edit interview context</button>
      </section>
    </main>
  )
}

export default App
