import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'

type TagFieldProps = {
  id: string
  label: string
  placeholder: string
  hint: string
  values: string[]
  onChange: (values: string[]) => void
}

export function TagField({ id, label, placeholder, hint, values, onChange }: TagFieldProps) {
  const [draft, setDraft] = useState('')

  function addValue() {
    const value = draft.trim()
    if (!value || values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return
    onChange([...values, value])
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addValue()
    }
    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>}
      <div className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm transition focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/15">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {values.map((value, index) => (
            <span key={`${value}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900">
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}
                aria-label={`Remove ${value}`}
                className="rounded p-0.5 text-emerald-800/60 hover:bg-emerald-100 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              ><X size={13} /></button>
            </span>
          ))}
          <input
            id={id}
            aria-label={label || placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={values.length ? 'Add another…' : placeholder}
            className="h-7 min-w-36 flex-1 border-0 bg-transparent px-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
          />
        </div>
        <button type="button" onClick={addValue} aria-label={`Add ${label.toLowerCase()}`} className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"><Plus size={15} /> Add</button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
