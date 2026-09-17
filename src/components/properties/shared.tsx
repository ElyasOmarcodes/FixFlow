/**
 * Shared sub-components used across multiple per-layer-type property files.
 */

import { useEditorStore } from '@/store'
import { ColorField, SliderField } from '@/components/properties/PropertyControls'
import type { Layer } from '@/types'
import { labelCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

// ─── ShadowControls ──────────────────────────────────────────────────────────

export function ShadowControls({ layer }: { layer: Layer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<Layer>) => updateLayer(layer.id, patch)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className={labelCls + ' !mb-0'}>Shadow</label>
        <ToggleSwitch
          checked={Boolean(layer.shadow)}
          ariaLabel="Toggle shadow"
          onChange={() => {
            if (layer.shadow) {
              upd({ shadow: undefined })
            } else {
              upd({ shadow: { color: '#000000', blur: 20, offsetX: 0, offsetY: 4, opacity: 0.5 } })
            }
          }}
          size="lg"
        />
      </div>

      {layer.shadow && (
        <div className="space-y-3 rounded-lg border border-[var(--pd-line-subtle)] bg-[var(--pd-fill-subtle)] p-3">
          <div>
            <label className={labelCls}>Color</label>
            <ColorField value={layer.shadow.color} onChange={(value) => upd({ shadow: { ...layer.shadow!, color: value } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
          <SliderField label="Blur" value={layer.shadow.blur} min={0} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, blur: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Opacity" value={Math.round(layer.shadow.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => upd({ shadow: { ...layer.shadow!, opacity: v / 100 } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Offset X" value={layer.shadow.offsetX} min={-100} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, offsetX: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Offset Y" value={layer.shadow.offsetY} min={-100} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, offsetY: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
        </div>
      )}
    </div>
  )
}
