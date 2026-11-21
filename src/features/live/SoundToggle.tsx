import { Volume2, VolumeX } from 'lucide-react'

/** Footer switch for the verdict chime (false and misleading claims only). */
export function SoundToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Mute alert sound' : 'Play a sound for false or misleading claims'}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:text-sm"
    >
      {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
      <span className="hidden sm:inline">Sound</span>
    </button>
  )
}
