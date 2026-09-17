import { useState } from 'react'
import { useEditorStore } from '@/store'
import type { IconLayer, Layer } from '@/types'
import { ColorField, FillControl, SliderField } from '@/components/properties/PropertyControls'
import { IconPickerModal } from '@/components/panels/IconPickerModal'
import { Icon } from '@/components/ui/Icon'
import { getIconGlyph } from '@/assets/icons/library'
import { parseViewBox } from '@/utils/materialSymbols'
import {
  labelCls, panelSectionCls, subtleButtonCls, pauseTemporal, resumeTemporal,
} from '@/components/properties/panelConstants'
import { useT } from '@/i18n'

/** The layer's own glyph at a fixed preview size, in whichever paint mode it uses. */
function CurrentGlyph({ layer, size = 26 }: { layer: IconLayer; size?: number }) {
  const d = layer.customPath ?? getIconGlyph(layer.icon)?.d
  if (!d) return <Icon name="sparkles" size={size} />
  const viewBox = layer.customPath ? (layer.customViewBox ?? '0 -960 960 960') : '0 0 24 24'
  const [, , boxW, boxH] = parseViewBox(viewBox)
  const filled = layer.customPath ? layer.customFilled === true : false
  return (
    <svg width={size} height={size} viewBox={viewBox} aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      {...(filled
        ? { fill: 'currentColor' }
        : {
            fill: 'none',
            stroke: 'currentColor',
            // The bundled library is drawn on a 24-grid; a fetched glyph on a
            // much larger one, where a strokeWidth of 1.8 would be invisible.
            strokeWidth: 1.8 * (Math.max(boxW, boxH) / 24),
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          })}
    >
      <path d={d} />
    </svg>
  )
}

/**
 * Icon editor.
 *
 * Two kinds of glyph end up on this layer and they are not interchangeable:
 * a bundled library glyph is stroked, so line weight is meaningful, while a
 * fetched Material Symbol is a filled shape, where it is not. The panel hides
 * the control rather than showing one that silently does nothing.
 */
export function IconProperties({ layer }: { layer: IconLayer }) {
  const t = useT()
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<IconLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const [pickerOpen, setPickerOpen] = useState(false)

  const filled = layer.customPath ? layer.customFilled === true : false
  const displayName = layer.icon.replace(/^material:/, '').replace(/[-_]/g, ' ')

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>{t('iconProps.glyph')}</label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`${subtleButtonCls} flex w-full items-center gap-3`}
        >
          <CurrentGlyph layer={layer} />
          <span className="flex-1 truncate text-start">{displayName}</span>
          <span className="text-[var(--pd-c-6b6b7a)]">{t('iconProps.change')}</span>
        </button>
      </div>

      <div className={panelSectionCls}>
        <SliderField
          label={t('iconProps.size')}
          value={layer.size}
          min={8} max={800} unit="px"
          onChange={(value) => upd({ size: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className={filled ? '!mb-0' : ''}
        />
        {!filled && (
          <SliderField
            label={t('iconProps.strokeWidth')}
            value={layer.strokeWidth}
            min={0.5} max={40} step={0.5} unit="px"
            onChange={(value) => upd({ strokeWidth: value })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
            className="!mb-0"
          />
        )}
        {filled && <p className="mt-2 text-[11px] text-[var(--pd-c-6b6b7a)]">{t('iconProps.filledNote')}</p>}
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('iconProps.color')}</label>
        <ColorField
          value={layer.color}
          onChange={(value) => upd({ color: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
      </div>

      <div className={panelSectionCls}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className={`${labelCls} !mb-0`}>{t('iconProps.plate')}</label>
          <button
            type="button"
            className={subtleButtonCls}
            onClick={() => upd(layer.background
              ? { background: undefined }
              : {
                  background: 'rgba(255,255,255,0.12)',
                  // A plate with no padding is a square the size of the glyph,
                  // which reads as a crop rather than as a backing shape.
                  backgroundPadding: layer.backgroundPadding || Math.round(layer.size * 0.35),
                })}
          >
            {t(layer.background ? 'iconProps.plateOff' : 'iconProps.plateOn')}
          </button>
        </div>

        {layer.background && (
          <>
            <FillControl
              fill={layer.background}
              onChange={(background) => upd({ background })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
            />
            <SliderField
              label={t('iconProps.platePadding')}
              value={layer.backgroundPadding}
              min={0} max={300} unit="px"
              onChange={(value) => upd({ backgroundPadding: value })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
              className="mt-3"
            />
            <SliderField
              label={t('iconProps.plateRadius')}
              value={layer.backgroundRadius}
              min={0} max={300} unit="px"
              onChange={(value) => upd({ backgroundRadius: value })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
              className="!mb-0"
            />
          </>
        )}
      </div>

      <IconPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={layer.icon}
        onPick={(icon) => upd({
          icon: icon.name,
          customPath: icon.path,
          customViewBox: icon.viewBox,
          customFilled: icon.filled,
        })}
      />
    </div>
  )
}
