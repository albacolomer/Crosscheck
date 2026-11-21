import { useEffect, useState, type MouseEvent } from 'react'
import { AlertCircle, AudioLines, Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import type { ParsedPreparation } from '../../shared/preparation'
import type { InterviewContext } from '../../shared/types'
import { Collapsible } from '../components/preparation/Collapsible'
import { DictationPanel } from '../components/preparation/DictationPanel'
import '../components/preparation/preparation-motion.css'
import { useContextDictation } from '../hooks/useContextDictation'
import { useFreshItems } from '../hooks/useFreshItems'
import { mergeInterviewees, mergeNotes, mergeTopics } from '../lib/mergePreparation'
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

const inputClassName = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

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

const commonTopicNames = commonTopics.map(({ name }) => name)

function isFilledPerson(person: Interviewee) {
  return Boolean(person.name.trim() || person.role.trim() || person.organization.trim())
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

type MicrophoneStatus = 'checking' | 'permission-needed' | 'ready' | 'denied' | 'missing' | 'unavailable' | 'requesting'

export function PreparationPage({ onStart }: PreparationPageProps) {
  const [interviewees, setInterviewees] = useState<Interviewee[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [editingPeople, setEditingPeople] = useState(false)
  const [editingTopics, setEditingTopics] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>('checking')
  const [dictationSummary, setDictationSummary] = useState<string | null>(null)
  const dictation = useContextDictation({ knownTopics: commonTopicNames, onResult: applyDictation })
  // Indexes of people and notes, and topic names, that were just added and should animate in.
  const freshPeople = useFreshItems<number>()
  const freshTopics = useFreshItems<string>()
  const freshNotes = useFreshItems<number>()

  /** Merges dictated context into what the user already entered, then opens the filled editors. */
  function applyDictation(result: ParsedPreparation) {
    const filled = [
      result.interviewees.length && countLabel(result.interviewees.length, 'person', 'people'),
      result.topics.length && countLabel(result.topics.length, 'topic', 'topics'),
      result.notes.length && countLabel(result.notes.length, 'note', 'notes'),
    ].filter(Boolean)
    setDictationSummary(`Filled from dictation: ${filled.join(', ')}.`)
    // Animate and highlight what dictation added or filled in, staggered people → topics → notes.
    let step = 0
    if (result.interviewees.length) {
      const kept = interviewees.filter(isFilledPerson)
      const merged = mergeInterviewees(interviewees, result.interviewees)
      const changed = merged.flatMap((person, index) => {
        const before = kept[index]
        return !before || before.role !== person.role || before.organization !== person.organization ? [index] : []
      })
      setInterviewees(merged)
      setEditingPeople(true)
      freshPeople.mark(changed, { highlight: true, firstStep: step })
      step += changed.length
    }
    if (result.topics.length) {
      const merged = mergeTopics(topics, result.topics, commonTopicNames)
      const added = merged.slice(topics.length)
      setTopics(merged)
      freshTopics.mark(added, { highlight: true, firstStep: step })
      step += added.length
    }
    if (result.notes.length) {
      const kept = notes.filter((note) => note.trim()).length
      const merged = mergeNotes(notes, result.notes)
      setNotes(merged)
      setEditingNotes(true)
      freshNotes.mark(merged.map((_, index) => index).slice(kept), { highlight: true, firstStep: step })
    }
  }

  const completedInterviewees = interviewees.filter(isFilledPerson)
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
    freshPeople.mark([interviewees.length])
    setInterviewees([...interviewees, { name: '', role: '', organization: '' }])
  }

  function removeInterviewee(index: number) {
    // Indexes shift after a removal, so drop marks instead of moving them to other people.
    freshPeople.clear()
    setInterviewees((current) => current.filter((_, personIndex) => personIndex !== index))
  }

  function addNote() {
    freshNotes.mark([notes.length])
    setNotes([...notes, ''])
  }

  function removeNote(index: number) {
    freshNotes.clear()
    setNotes((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function changeTopics(next: string[]) {
    freshTopics.mark(next.filter((topic) => !topics.includes(topic)))
    setTopics(next)
  }

  function toggleTopic(topic: string) {
    changeTopics(topics.some((item) => item.toLocaleLowerCase() === topic.toLocaleLowerCase())
      ? topics.filter((item) => item.toLocaleLowerCase() !== topic.toLocaleLowerCase())
      : [...topics, topic])
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">{completedInterviewees.length ? `Interview with ${completedInterviewees.map((person) => person.name.trim()).filter(Boolean).join(', ')}` : 'New interview'}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Not recording</div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 sm:flex"><AudioLines size={14} /> Interview setup</div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-16 pt-7 sm:pt-10">
        <button type="button" onClick={handleStartClick} aria-label={microphoneStatus === 'ready' ? 'Start interview' : 'Enable microphone'} className="group flex flex-col items-center rounded-xl px-6 py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-4">
          <span className="grid h-28 w-28 place-items-center rounded-full bg-rose-100 shadow-[0_8px_25px_rgba(220,38,38,0.12)] transition group-hover:bg-rose-200 group-hover:shadow-[0_10px_30px_rgba(220,38,38,0.2)] sm:h-32 sm:w-32">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-red-600 shadow-inner transition group-hover:bg-red-700 sm:h-24 sm:w-24"><span className="h-5 w-5 rounded-full bg-white sm:h-6 sm:w-6" /></span>
          </span>
          <span className="mt-3 text-lg font-semibold text-slate-900">{microphoneStatus === 'ready' ? 'Start interview' : microphoneStatus === 'requesting' ? 'Checking microphone' : 'Enable microphone'}</span>
        </button>
        <div className={`mt-1 flex items-center gap-1.5 text-xs ${microphoneStatus === 'ready' ? 'text-emerald-700' : microphoneStatus === 'denied' || microphoneStatus === 'missing' || microphoneStatus === 'unavailable' ? 'text-rose-700' : 'text-slate-500'}`} role="status" aria-live="polite">
          {microphoneStatus === 'checking' || microphoneStatus === 'requesting'
            ? <LoaderCircle size={13} className="animate-spin" />
            : microphoneStatus === 'ready' ? <Check size={13} /> : <AlertCircle size={13} />}
          {microphoneMessage[microphoneStatus]}
        </div>
        {microphoneStatus === 'permission-needed' && <p className="mt-1 text-center text-[11px] text-slate-500">Choose Allow in your browser’s microphone prompt.</p>}
        {microphoneStatus === 'denied' && <p className="mt-1 max-w-sm text-center text-[11px] leading-5 text-slate-500">Allow microphone access in this site’s browser settings, then try again.</p>}
        {microphoneStatus !== 'ready' && microphoneStatus !== 'checking' && microphoneStatus !== 'requesting' && <button type="button" onClick={startInterview} className="mt-2 text-[11px] text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800">Continue without microphone</button>}

        <section className="mt-7 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="context-title">
          <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <h1 id="context-title" className="text-sm font-semibold text-slate-900">Interview context <span className="ml-1 font-normal text-slate-400">Optional · helps fact-checking</span></h1>
          </div>

          <DictationPanel
            phase={dictation.phase}
            transcript={dictation.transcript}
            error={dictation.error}
            filledSummary={dictationSummary}
            onStart={() => { setDictationSummary(null); dictation.start() }}
            onStop={dictation.stop}
          />

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-[10px] font-semibold tracking-wide text-slate-500">WHO</span>
            <div className="min-w-0 pt-1.5">
              <Collapsible open={!editingPeople}>
                <p key={peopleLabel} className={`prep-fade ${completedInterviewees.length ? 'text-sm text-slate-800' : 'text-xs leading-5 text-slate-500'}`}>{peopleLabel}</p>
              </Collapsible>
              <Collapsible open={editingPeople}>
                <div className="space-y-3">
                  {interviewees.map((person, index) => (
                    <fieldset key={index} style={freshPeople.motion(index)?.style} className={`${freshPeople.motion(index)?.className ?? ''} rounded-lg border border-slate-200 bg-slate-50 p-3`}>
                      <legend className="sr-only">Person {index + 1}</legend>
                      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Person {index + 1}</span><button type="button" onClick={() => removeInterviewee(index)} aria-label={`Remove person ${index + 1}`} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-[11px] font-medium text-slate-600">Name<input value={person.name} onChange={(event) => updateInterviewee(index, 'name', event.target.value)} placeholder="Full name" className={`${inputClassName} mt-1 font-normal`} /></label>
                        <label className="text-[11px] font-medium text-slate-600">Role<input value={person.role} onChange={(event) => updateInterviewee(index, 'role', event.target.value)} placeholder="Role or title" className={`${inputClassName} mt-1 font-normal`} /></label>
                        <label className="text-[11px] font-medium text-slate-600">Organization<input value={person.organization} onChange={(event) => updateInterviewee(index, 'organization', event.target.value)} placeholder="Optional" className={`${inputClassName} mt-1 font-normal`} /></label>
                      </div>
                    </fieldset>
                  ))}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={addInterviewee} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"><Plus size={13} /> Add person</button>
                    <button type="button" onClick={() => setEditingPeople(false)} className="text-xs font-medium text-emerald-800 hover:text-emerald-950">Done</button>
                  </div>
                </div>
              </Collapsible>
            </div>
            {!editingPeople && <button type="button" onClick={() => { if (!interviewees.length) addInterviewee(); setEditingPeople(true) }} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">{completedInterviewees.length ? 'Edit' : '+ Add'}</button>}
          </div>

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-[10px] font-semibold tracking-wide text-slate-500">TOPICS</span>
            <div className="min-w-0 pt-1">
              <Collapsible open={!editingTopics}>
                {topics.length
                  ? <div className="flex flex-wrap gap-1.5">{topics.map((topic) => <span key={topic} style={freshTopics.motion(topic)?.style} className={`${freshTopics.motion(topic)?.className ?? ''} rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700`}>{topic}</span>)}</div>
                  : <p className="prep-fade pt-1 text-xs text-slate-500">Add topics you want to keep an eye on</p>}
              </Collapsible>
              <Collapsible open={editingTopics}><div className="py-1">
                <TagField id="topics" label="" placeholder="Type a topic and press Enter" hint="" values={topics} onChange={changeTopics} motion={freshTopics.motion} />
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-medium text-slate-600">10 common topics <span className="ml-1 text-slate-400">Tap to add</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {commonTopics.map(({ name, recommended }) => {
                      const selected = topics.some((topic) => topic.toLocaleLowerCase() === name.toLocaleLowerCase())
                      return <button key={name} type="button" aria-pressed={selected} onClick={() => toggleTopic(name)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] transition ${selected ? 'border-emerald-200 bg-emerald-50 font-medium text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60'}`}>
                        {selected && <Check size={12} />}{name}{recommended && <span className="ml-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">Recommended</span>}
                      </button>
                    })}
                  </div>
                </div>
                <button type="button" onClick={() => setEditingTopics(false)} className="mt-3 text-xs font-medium text-emerald-800 hover:text-emerald-950">Done</button>
              </div></Collapsible>
            </div>
            {!editingTopics && <button type="button" onClick={() => setEditingTopics(true)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">+ Add</button>}
          </div>

          <div className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-start gap-2 px-4 py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5">
            <span className="pt-2 text-[10px] font-semibold tracking-wide text-slate-500">NOTES</span>
            <div className="min-w-0 pt-1">
              <Collapsible open={!editingNotes}>
                {notes.some((note) => note.trim())
                  ? <ul className="space-y-1.5">{notes.map((note, index) => note.trim() && <li key={index} style={freshNotes.motion(index)?.style} className={`${freshNotes.motion(index)?.className ?? ''} text-xs leading-5 text-slate-700`}>{note}</li>)}</ul>
                  : <p className="prep-fade pt-1 text-xs text-slate-500">Questions, background, or anything useful to remember</p>}
              </Collapsible>
              <Collapsible open={editingNotes}><div className="space-y-2">
                {notes.map((note, index) => <div key={index} style={freshNotes.motion(index)?.style} className={`${freshNotes.motion(index)?.className ?? ''} flex items-start gap-2 rounded-md`}><textarea value={note} onChange={(event) => setNotes((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} rows={2} placeholder="Add a question, background, or another useful note" className="min-h-10 flex-1 resize-y rounded-md border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" /><button type="button" onClick={() => removeNote(index)} aria-label={`Remove note ${index + 1}`} className="rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={14} /></button></div>)}
                <div className="flex items-center gap-3"><button type="button" onClick={addNote} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"><Plus size={13} /> Add note</button><button type="button" onClick={() => setEditingNotes(false)} className="text-xs font-medium text-emerald-800 hover:text-emerald-950">Done</button></div>
              </div></Collapsible>
            </div>
            {!editingNotes && <button type="button" onClick={() => { if (!notes.length) addNote(); setEditingNotes(true) }} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">+ Add</button>}
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-5 mt-6 w-[calc(100%+2.5rem)] border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:w-full sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button type="button" onClick={handleStartClick} disabled={microphoneStatus === 'requesting'} aria-label={microphoneStatus === 'ready' ? 'Start interview' : 'Enable microphone to start interview'} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
            {microphoneStatus === 'requesting' ? <LoaderCircle size={16} className="animate-spin" /> : <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />}
            {microphoneStatus === 'ready' ? 'Start interview' : microphoneStatus === 'requesting' ? 'Checking microphone' : 'Enable microphone'}
          </button>
        </div>
      </div>
    </main>
  )
}
