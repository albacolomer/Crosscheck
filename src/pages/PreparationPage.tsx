import { useEffect, useState, type MouseEvent } from 'react'
import { AlertCircle, AudioLines, Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import type { InterviewContext } from '../../shared/types'
import { TagField } from '../components/preparation/TagField'

export type Interviewee = { name: string; role: string; organization: string }

export type PreparedInterview = InterviewContext & {
  organization: string
  interviewees: Interviewee[]
  notes: string[]
}

type PreparationPageProps = {
  onStart: (interview: PreparedInterview) => void
}

const inputClassName = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 2xl:h-12 2xl:text-base'

const commonTopics = [
  { name: 'Politics & government', recommended: true },
  { name: 'Economy & cost of living', recommended: true },
  { name: 'Health & healthcare', recommended: true },
  { name: 'Housing', recommended: false },
  { name: 'Education', recommended: false },
  { name: 'Work & employment', recommended: false },
  { name: 'Climate & energy', recommended: false },
  { name: 'Public safety', recommended: false },
  { name: 'Immigration', recommended: false },
  { name: 'Technology & AI', recommended: false },
]

type MicrophoneStatus = 'checking' | 'permission-needed' | 'ready' | 'denied' | 'missing' | 'unavailable' | 'requesting'

export function PreparationPage({ onStart }: PreparationPageProps) {
  const [interviewees, setInterviewees] = useState<Interviewee[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [editingPeople, setEditingPeople] = useState(false)
  const [editingTopics, setEditingTopics] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>('checking')

  const completedInterviewees = interviewees.filter((person) => person.name.trim() || person.role.trim() || person.organization.trim())
  const peopleLabel = completedInterviewees.length
    ? completedInterviewees.map((person) => [person.name.trim(), person.role.trim(), person.organization.trim()].filter(Boolean).join(' · ')).join('  /  ')
    : 'Add one or more people to fact-check their statements'

  function startInterview() {
    const cleanPeople = completedInterviewees.map((person) => ({
      name: person.name.trim(),
      role: person.role.trim(),
      organization: person.organization.trim(),
    }))
    const cleanNotes = notes.map((note) => note.trim()).filter(Boolean)
    const organizations = [...new Set(cleanPeople.map(({ organization }) => organization).filter(Boolean))]

    onStart({
      title: '',
      intervieweeName: cleanPeople.map(({ name }) => name).filter(Boolean).join(', '),
      intervieweeRole: cleanPeople.map(({ role }) => role).filter(Boolean).join(', '),
      organization: organizations.join(', '),
      background: cleanNotes.join('\n'),
      topics,
      keyQuestions: cleanNotes.filter((note) => note.includes('?')),
      interviewees: cleanPeople,
      notes: cleanNotes,
    })
  }

  useEffect(() => {
    let active = true
    let permissionStatus: PermissionStatus | undefined

    async function checkMicrophone() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        if (active) setMicrophoneStatus('unavailable')
        return
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!active) return
        if (!devices.some((device) => device.kind === 'audioinput')) {
          setMicrophoneStatus('missing')
          return
        }

        if (!navigator.permissions?.query) {
          setMicrophoneStatus('permission-needed')
          return
        }

        permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        if (!active) return
        if (permissionStatus.state === 'denied') {
          setMicrophoneStatus('denied')
          return
        }
        if (permissionStatus.state !== 'granted') {
          setMicrophoneStatus('permission-needed')
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        if (active) setMicrophoneStatus('ready')
      } catch (error) {
        if (!active) return
        const name = error instanceof DOMException ? error.name : ''
        setMicrophoneStatus(name === 'NotFoundError' ? 'missing' : name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }

    void checkMicrophone()
    navigator.mediaDevices?.addEventListener('devicechange', checkMicrophone)
    return () => {
      active = false
      permissionStatus?.removeEventListener('change', checkMicrophone)
      navigator.mediaDevices?.removeEventListener('devicechange', checkMicrophone)
    }
  }, [])

  async function handleStartClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (microphoneStatus === 'ready') {
      startInterview()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophoneStatus('unavailable')
      return
    }

    setMicrophoneStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const hasLiveAudioTrack = stream.getAudioTracks().some((track) => track.readyState === 'live')
      stream.getTracks().forEach((track) => track.stop())
      setMicrophoneStatus(hasLiveAudioTrack ? 'ready' : 'unavailable')
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setMicrophoneStatus(name === 'NotFoundError' ? 'missing' : name === 'NotAllowedError' ? 'denied' : 'unavailable')
    }
  }

  const microphoneMessage: Record<MicrophoneStatus, string> = {
    checking: 'Checking microphone…',
    'permission-needed': 'Microphone permission needed',
    ready: 'Microphone ready',
    denied: 'Microphone access blocked',
    missing: 'No microphone found',
    unavailable: 'Microphone unavailable in this browser',
    requesting: 'Waiting for microphone permission…',
  }

  function updateInterviewee(index: number, field: keyof Interviewee, value: string) {
    setInterviewees((current) => current.map((person, personIndex) => personIndex === index ? { ...person, [field]: value } : person))
  }

  function addInterviewee() {
    setInterviewees((current) => [...current, { name: '', role: '', organization: '' }])
  }

  function addNote() {
    setNotes((current) => [...current, ''])
  }

  function toggleTopic(topic: string) {
    setTopics((current) => current.some((item) => item.toLocaleLowerCase() === topic.toLocaleLowerCase())
      ? current.filter((item) => item.toLocaleLowerCase() !== topic.toLocaleLowerCase())
      : [...current, topic])
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex min-h-[84px] max-w-6xl items-center justify-between gap-5 px-6 sm:px-8 2xl:min-h-[96px] 2xl:max-w-7xl 2xl:px-10">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">{completedInterviewees.length ? `Interview with ${completedInterviewees.map((person) => person.name.trim()).filter(Boolean).join(', ')}` : 'New interview'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 sm:text-base"><span className="h-2 w-2 rounded-full bg-slate-400" /> Not recording</div>
          </div>
          <div className="hidden shrink-0 items-center gap-2.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 sm:flex sm:text-base"><AudioLines size={19} /> Interview setup</div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-16 pt-8 sm:pt-10 2xl:max-w-4xl 2xl:pt-12">
        <button type="button" onClick={handleStartClick} aria-label={microphoneStatus === 'ready' ? 'Start interview' : 'Enable microphone'} className="group flex flex-col items-center rounded-xl px-6 py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-4">
          <span className="grid h-32 w-32 place-items-center rounded-full bg-rose-100 shadow-[0_8px_25px_rgba(220,38,38,0.12)] transition group-hover:bg-rose-200 group-hover:shadow-[0_10px_30px_rgba(220,38,38,0.2)] sm:h-36 sm:w-36 2xl:h-40 2xl:w-40">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-red-600 shadow-inner transition group-hover:bg-red-700 sm:h-28 sm:w-28 2xl:h-32 2xl:w-32"><span className="h-6 w-6 rounded-full bg-white sm:h-7 sm:w-7 2xl:h-8 2xl:w-8" /></span>
          </span>
          <span className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">{microphoneStatus === 'ready' ? 'Start interview' : microphoneStatus === 'requesting' ? 'Checking microphone' : 'Enable microphone'}</span>
        </button>
        <div className={`mt-2 flex items-center gap-2 text-sm sm:text-base ${microphoneStatus === 'ready' ? 'text-emerald-700' : microphoneStatus === 'denied' || microphoneStatus === 'missing' || microphoneStatus === 'unavailable' ? 'text-rose-700' : 'text-slate-500'}`} role="status" aria-live="polite">
          {microphoneStatus === 'checking' || microphoneStatus === 'requesting'
            ? <LoaderCircle size={17} className="animate-spin" />
            : microphoneStatus === 'ready' ? <Check size={17} /> : <AlertCircle size={17} />}
          {microphoneMessage[microphoneStatus]}
        </div>
        {microphoneStatus === 'permission-needed' && <p className="mt-2 text-center text-xs text-slate-500 sm:text-sm">Choose Allow in your browser’s microphone prompt.</p>}
        {microphoneStatus === 'denied' && <p className="mt-2 max-w-sm text-center text-xs leading-5 text-slate-500 sm:text-sm">Allow microphone access in this site’s browser settings, then try again.</p>}
        {microphoneStatus !== 'ready' && microphoneStatus !== 'checking' && microphoneStatus !== 'requesting' && <button type="button" onClick={startInterview} className="mt-3 text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 sm:text-sm">Continue without microphone</button>}

        <section className="mt-7 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="context-title">
          <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <h1 id="context-title" className="text-base font-semibold text-slate-900 sm:text-lg">Interview context <span className="ml-1 font-normal text-slate-500">Optional · helps fact-checking</span></h1>
          </div>

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-xs font-semibold tracking-wide text-slate-600 sm:text-sm">WHO</span>
            <div className="min-w-0 pt-1.5">
              {!editingPeople && <p className={completedInterviewees.length ? 'text-base text-slate-800' : 'text-sm leading-5 text-slate-500'}>{peopleLabel}</p>}
              {editingPeople && (
                <div className="space-y-3">
                  {interviewees.map((person, index) => (
                    <fieldset key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <legend className="sr-only">Person {index + 1}</legend>
                      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Person {index + 1}</span><button type="button" onClick={() => setInterviewees((current) => current.filter((_, personIndex) => personIndex !== index))} aria-label={`Remove person ${index + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={18} /></button></div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-medium text-slate-700 sm:text-sm">Name<input value={person.name} onChange={(event) => updateInterviewee(index, 'name', event.target.value)} placeholder="Full name" className={`${inputClassName} mt-1 font-normal`} /></label>
                        <label className="text-xs font-medium text-slate-700 sm:text-sm">Role<input value={person.role} onChange={(event) => updateInterviewee(index, 'role', event.target.value)} placeholder="Role or title" className={`${inputClassName} mt-1 font-normal`} /></label>
                        <label className="text-xs font-medium text-slate-700 sm:text-sm">Organization<input value={person.organization} onChange={(event) => updateInterviewee(index, 'organization', event.target.value)} placeholder="Optional" className={`${inputClassName} mt-1 font-normal`} /></label>
                      </div>
                    </fieldset>
                  ))}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={addInterviewee} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"><Plus size={17} /> Add person</button>
                    <button type="button" onClick={() => setEditingPeople(false)} className="text-sm font-medium text-emerald-800 hover:text-emerald-950">Done</button>
                  </div>
                </div>
              )}
            </div>
            {!editingPeople && <button type="button" onClick={() => { if (!interviewees.length) addInterviewee(); setEditingPeople(true) }} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{completedInterviewees.length ? 'Edit' : '+ Add'}</button>}
          </div>

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-xs font-semibold tracking-wide text-slate-600 sm:text-sm">TOPICS</span>
            <div className="min-w-0 pt-1">
              {!editingTopics && (topics.length ? <div className="flex flex-wrap gap-2">{topics.map((topic, index) => <span key={`${topic}-${index}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 sm:text-sm">{topic}</span>)}</div> : <p className="pt-1 text-sm text-slate-500">Add topics you want to keep an eye on</p>)}
              {editingTopics && <div className="py-1">
                <TagField id="topics" label="" placeholder="Type a topic and press Enter" hint="" values={topics} onChange={setTopics} />
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">10 common topics <span className="ml-1 text-slate-500">Tap to add</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {commonTopics.map(({ name, recommended }) => {
                      const selected = topics.some((topic) => topic.toLocaleLowerCase() === name.toLocaleLowerCase())
                      return <button key={name} type="button" aria-pressed={selected} onClick={() => toggleTopic(name)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition sm:text-sm ${selected ? 'border-emerald-200 bg-emerald-50 font-medium text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60'}`}>
                        {selected && <Check size={16} />}{name}{recommended && <span className="ml-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Recommended</span>}
                      </button>
                    })}
                  </div>
                </div>
                <button type="button" onClick={() => setEditingTopics(false)} className="mt-3 text-sm font-medium text-emerald-800 hover:text-emerald-950">Done</button>
              </div>}
            </div>
            {!editingTopics && <button type="button" onClick={() => setEditingTopics(true)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Add</button>}
          </div>

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-xs font-semibold tracking-wide text-slate-600 sm:text-sm">NOTES</span>
            <div className="min-w-0 pt-1">
              {!editingNotes && (notes.filter((note) => note.trim()).length ? <ul className="space-y-2">{notes.filter((note) => note.trim()).map((note, index) => <li key={`${note}-${index}`} className="text-sm leading-6 text-slate-700">{note}</li>)}</ul> : <p className="pt-1 text-sm text-slate-500">Questions, background, or anything useful to remember</p>)}
              {editingNotes && <div className="space-y-2">
                {notes.map((note, index) => <div key={index} className="flex items-start gap-2"><textarea value={note} onChange={(event) => setNotes((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} rows={2} placeholder="Add a question, background, or another useful note" className="min-h-12 flex-1 resize-y rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 2xl:text-base" /><button type="button" onClick={() => setNotes((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove note ${index + 1}`} className="rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={18} /></button></div>)}
                <div className="flex items-center gap-3"><button type="button" onClick={addNote} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"><Plus size={17} /> Add note</button><button type="button" onClick={() => setEditingNotes(false)} className="text-sm font-medium text-emerald-800 hover:text-emerald-950">Done</button></div>
              </div>}
            </div>
            {!editingNotes && <button type="button" onClick={() => { if (!notes.length) addNote(); setEditingNotes(true) }} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Add</button>}
          </div>
        </section>
      </div>
    </main>
  )
}
