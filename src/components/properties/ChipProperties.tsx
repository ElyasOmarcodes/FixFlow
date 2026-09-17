import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { ChipLayer, Layer } from '@/types'
import { ColorField, FillControl, SliderField } from '@/components/properties/PropertyControls'
import { FontPicker } from '@/components/properties/TextProperties'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { IconPickerModal } from '@/components/panels/IconPickerModal'
import { Icon } from '@/components/ui/Icon'
import { getIconGlyph } from '@/assets/icons/library'
import {
  inputCls, labelCls, panelSectionCls, subtleButtonCls, pauseTemporal, resumeTemporal,
} from '@/components/properties/panelConstants'
import { ensureFontReady, getFontWeights } from '@/utils/fonts'
import { useT } from '@/i18n'

/**
 * Chip editor.
 *
 * A chip is a pill: label, plate, and an optional leading or trailing glyph.
 * Its geometry is derived from those properties rather than stored, so every
 * control here changes one input and the pill re-measures itself — there is no
 * width or height to edit, which is the whole point of the layer type.
 */
export function ChipProperties({ layer }: { layer: ChipLayer }) {
  const t = useT()
  const { updateLayer, project } = useEditorStore(useShallow((s) => ({
    updateLayer: s.updateLayer,
    project: s.project,
  })))
  const upd = (patch: Partial<ChipLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const [pickerOpen, setPickerOpen] = useState(false)

  const glyph = layer.icon ? getIconGlyph(layer.icon) : undefined

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>{t('chip.label')}</label>
        <input
          type="text"
          value={layer.text}
          onChange={(event) => upd({ text: event.target.value })}
          className={inputCls}
          placeholder={t('chip.labelPlaceholder')}
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('text.font')}</label>
        <FontPicker
          value={layer.fontFamily}
          customFonts={project.customFonts ?? []}
          onChange={(family) => {
            const weights = getFontWeights(family)
            const weight = weights.includes(layer.fontWeight)
              ? layer.fontWeight
              : weights.reduce((prev, curr) =>
                  Math.abs(curr - layer.fontWeight) < Math.abs(prev - layer.fontWeight) ? curr : prev)
            void ensureFontReady(family, weight)
            upd({ fontFamily: family, fontWeight: weight })
          }}
        />
        <SliderField
          label={t('chip.fontSize')}
          value={layer.fontSize}
          min={8} max={160} unit="px"
          onChange={(value) => upd({ fontSize: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className="mt-3"
        />
        <SliderField
          label={t('text.weight')}
          value={layer.fontWeight}
          min={100} max={900} step={100}
          onChange={(value) => upd({ fontWeight: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className="!mb-0"
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('chip.textColor')}</label>
        <ColorField
          value={layer.textColor}
          onChange={(value) => upd({ textColor: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('chip.background')}</label>
        <FillControl
          fill={layer.fill}
          onChange={(fill) => upd({ fill })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('chip.shape')}</label>
        <SliderField
          label={t('chip.cornerRadius')}
          value={layer.cornerRadius}
          min={0} max={200} unit="px"
          onChange={(value) => upd({ cornerRadius: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
        <SliderField
          label={t('chip.paddingX')}
          value={layer.paddingX}
          min={0} max={160} unit="px"
          onChange={(value) => upd({ paddingX: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
        <SliderField
          label={t('chip.paddingY')}
          value={layer.paddingY}
          min={0} max={120} unit="px"
          onChange={(value) => upd({ paddingY: value })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className="!mb-0"
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>{t('chip.icon')}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`${subtleButtonCls} flex flex-1 items-center gap-2`}
          >
            {glyph
              ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={glyph.d} />
                </svg>
              : <Icon name="sparkles" size={14} />}
            <span className="truncate">{layer.icon ? layer.icon.replace(/-/g, ' ') : t('chip.iconNone')}</span>
          </button>
          {layer.icon && (
            <button
              type="button"
              className={subtleButtonCls}
              onClick={() => upd({ icon: undefined })}
              title={t('chip.iconRemove')}
              aria-label={t('chip.iconRemove')}
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        {layer.icon && (
          <>
            <div className="mt-3">
              <label className={labelCls}>{t('chip.iconSide')}</label>
              <SegmentedControl
                value={layer.iconPosition}
                options={[
                  { value: 'start' as const, label: t('chip.iconStart') },
                  { value: 'end' as const, label: t('chip.iconEnd') },
                ]}
                onChange={(iconPosition) => upd({ iconPosition })}
              />
            </div>
            <SliderField
              label={t('chip.iconSize')}
              value={layer.iconSize}
              min={6} max={140} unit="px"
              onChange={(value) => upd({ iconSize: value })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
              className="mt-3"
            />
            <SliderField
              label={t('chip.iconGap')}
              value={layer.iconGap}
              min={0} max={80} unit="px"
              onChange={(value) => upd({ iconGap: value })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
            />
            <label className={labelCls}>{t('chip.iconColor')}</label>
            <ColorField
              value={layer.iconColor ?? layer.textColor}
              onChange={(value) => upd({ iconColor: value })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
            />
          </>
        )}
      </div>

      <IconPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={layer.icon}
        // A chip draws its glyph from the bundled library only: it is inline
        // with text at text weight, where a filled Material shape reads as a
        // blob rather than as part of the label.
        libraryOnly
        onPick={(icon) => upd({ icon: icon.name })}
      />
    </div>
  )
}
