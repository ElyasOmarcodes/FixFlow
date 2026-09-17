import { useEditorStore } from '@/store'
import type { ImageLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'
import { PropertySection } from '@/components/properties/PropertySection'
import { useT } from '@/i18n'

export function ImageProperties({ layer }: { layer: ImageLayer }) {
  const t = useT()
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<ImageLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-3">
      <PropertySection id="image-corner" title={t('image.corner')} icon="image">
        <SliderField label={t('image.corner')} value={layer.cornerRadius} min={0} max={500} unit="px" onChange={(v) => upd({ cornerRadius: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </PropertySection>
    </div>
  )
}
