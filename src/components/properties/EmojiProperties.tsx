import { useEditorStore } from '@/store'
import type { EmojiLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'
import { PropertySection } from '@/components/properties/PropertySection'
import { useT } from '@/i18n'

// Common emoji categories for quick picking
const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😀','😂','🥹','😍','🤩','😎','🥳','🤔','😴','🤯','🥺','😭','😤','🤗','😇','🫡'] },
  { label: 'Gestures', emojis: ['👍','👎','👏','🙌','🤝','✌️','🤞','🫶','❤️','🔥','⭐','✨','💫','🎉','🎊','🏆'] },
  { label: 'Nature', emojis: ['🌟','🌈','☀️','🌙','⚡','❄️','🌊','🍀','🌸','🌺','🦋','🐝','🦄','🐉','🌴','🍁'] },
  { label: 'Objects', emojis: ['🚀','💡','🎯','🔑','💎','🎨','📱','💻','🎵','🎮','📸','🔮','⚙️','🛡️','⚔️','🏹'] },
  { label: 'Food', emojis: ['🍕','🍔','🍣','🍜','🍦','🍩','☕','🧃','🍺','🥂','🍓','🥑','🌮','🍿','🧁','🍰'] },
  { label: 'Symbols', emojis: ['✅','❌','⚠️','💯','🔴','🟢','🔵','🟡','⬆️','➡️','🔄','♾️','🆕','🆓','💬','📣'] },
]

export function EmojiProperties({ layer }: { layer: EmojiLayer }) {
  const t = useT()
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<EmojiLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-3">
      <PropertySection id="emoji-glyph" title={t('emoji.title')} icon="emoji">
        <input
          type="text"
          value={layer.emoji}
          onChange={(e) => upd({ emoji: e.target.value })}
          className="w-full rounded-lg border border-[var(--pd-line)] bg-[var(--pd-fill-soft)] px-3 py-2 text-2xl text-center text-[var(--pd-c-e8e8f0)] outline-none focus:border-[var(--pd-c-7c6ef6)] transition-colors"
          placeholder={t('emoji.placeholder')}
          maxLength={8}
        />
      </PropertySection>

      <PropertySection id="emoji-size" title={t('props.secSize')} icon="maximize">
        <SliderField
          label={t('emoji.size')}
          value={layer.fontSize}
          min={10}
          max={500}
          unit="px"
          onChange={(v) => upd({ fontSize: v })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className="!mb-0"
        />
      </PropertySection>

      {EMOJI_CATEGORIES.map((cat) => (
        <PropertySection key={cat.label} id={`emoji-${cat.label}`} title={cat.label} icon="emoji" defaultCollapsed>
          <div className="grid grid-cols-8 gap-1">
            {cat.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => upd({ emoji })}
                title={emoji}
                className={`flex items-center justify-center w-full aspect-square text-xl rounded-lg transition-colors hover:bg-[var(--pd-fill-strong)] ${layer.emoji === emoji ? 'bg-[var(--pd-accent-wash-strong)] ring-1 ring-[var(--pd-c-7c6ef6)]' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PropertySection>
      ))}
    </div>
  )
}
