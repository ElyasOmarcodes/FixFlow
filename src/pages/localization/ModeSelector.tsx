import type { Layer, LocalizationMode } from '@/types'
import { effectiveLocalizationMode } from '@/utils/locale'

const MODE_OPTIONS: { value: LocalizationMode; label: string; title: string }[] = [
  { value: 'auto',   label: 'Auto',   title: 'Eligible for bulk AI translation' },
  { value: 'manual', label: 'Manual', title: 'Human-entered only; skipped by bulk AI translate' },
  { value: 'skip',   label: 'Skip',   title: 'Not localized; excluded from progress' },
]

export interface ModeSelectorProps {
  layer: Layer
  onUpdate: (mode: LocalizationMode | undefined) => void
}

export function ModeSelector({ layer, onUpdate }: ModeSelectorProps) {
  const effective = effectiveLocalizationMode(layer)
  const isImageType = layer.type === 'image' || layer.type === 'phone'

  return (
    <div className="flex gap-0.5 mt-1.5">
      {MODE_OPTIONS.map((opt) => {
        const active = effective === opt.value
        const disabled = isImageType && opt.value === 'auto'
        return (
          <button
            key={opt.value}
            type="button"
            title={disabled ? 'AI image generation not available yet' : opt.title}
            disabled={disabled}
            onClick={() => onUpdate(opt.value === 'auto' ? undefined : opt.value)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide transition ${
              disabled
                ? 'cursor-not-allowed text-[#3a3a4a] border border-[var(--pd-fill-subtle)]'
                : active
                  ? opt.value === 'skip'
                    ? 'bg-[rgba(239,68,68,0.18)] border border-[rgba(239,68,68,0.4)] text-[var(--pd-danger-soft)]'
                    : opt.value === 'manual'
                      ? 'bg-[rgba(245,158,11,0.18)] border border-[rgba(245,158,11,0.4)] text-[var(--pd-warn)]'
                      : 'bg-[var(--pd-accent-wash-strong)] border border-[var(--pd-accent-soft)] text-[#c4b5fd]'
                  : 'border border-[var(--pd-line-soft)] text-[#555665] hover:text-[#9a9ab0] hover:border-[var(--pd-line-strong)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
