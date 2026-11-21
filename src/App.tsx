import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json() as Promise<{ status: string }>
      })
      .then(({ status }) => setApiStatus(status === 'ok' ? 'available' : 'no response'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Crosscheck · Setup complete</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Research copilot for interviews</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          The development setup is ready. Next, agree on the shared contracts and build the live interview flow.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${apiStatus === 'available' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>API server: {apiStatus}</span>
          <code className="ml-auto text-slate-400">/api/health</code>
        </div>
      </section>
    </main>
  )
}

export default App
