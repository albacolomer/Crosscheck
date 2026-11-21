import { Volume2, VolumeX } from 'lucide-react'

/** Footer switch for the verdict chime (false and misleading claims only). */
export function SoundToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Mute alert sound' : 'Play a sound for false or misleading claims'}
      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      {enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
      <span className="hidden sm:inline">Sound</span>
    </button>
  )
}
