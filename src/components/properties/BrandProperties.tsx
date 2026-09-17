import { useEditorStore } from '@/store'
import type { BrandLayer, Layer } from '@/types'
import { fileToDataUrl } from '@/utils/files'
import { ColorField, SliderField } from '@/components/properties/PropertyControls'
import { FileUploadButton } from '@/components/ui/FileUploadButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  inputCls,
  labelCls,
  fieldCls,
  subtleButtonCls,
  pauseTemporal,
  resumeTemporal,
} from '@/components/properties/panelConstants'
import { PropertySection } from '@/components/properties/PropertySection'
import { useT } from '@/i18n'

export function BrandProperties({ layer }: { layer: BrandLayer }) {
  const t = useT()
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<BrandLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-3">
      <PropertySection id="brand-name" title={t('brand.appName')} icon="brand">
        <input type="text" value={layer.appName} onChange={(e) => upd({ appName: e.target.value })} className={inputCls} />
      </PropertySection>

      <PropertySection id="brand-logo" title={t('brand.logo')} icon="image">
        <div className="flex items-center gap-3">
          {layer.logoDataUrl && <img src={layer.logoDataUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-[var(--pd-c-0f0f13)]" />}
          <FileUploadButton
            accept="image/*"
            className={subtleButtonCls}
            onFiles={async (files) => {
              const file = files[0]
              if (!file) return
              const dataUrl = await fileToDataUrl(file)
              upd({ logoDataUrl: dataUrl })
            }}
          >
            {layer.logoDataUrl ? t('brand.changeLogo') : t('brand.uploadLogo')}
          </FileUploadButton>
        </div>
      </PropertySection>

      <PropertySection id="brand-name-style" title={t('brand.nameStyle')} icon="text">
        <label className={labelCls}>{t('brand.nameColor')}</label>
        <ColorField value={layer.nameColor} onChange={(value) => upd({ nameColor: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />

        <div className="mt-3">
          <SliderField label={t('brand.fontSize')} value={layer.nameFontSize} min={6} max={200} unit="px" onChange={(v) => upd({ nameFontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <div className={fieldCls}>
            <label className={labelCls}>{t('brand.fontWeight')}</label>
            <select value={layer.nameFontWeight} onChange={(e) => upd({ nameFontWeight: Number(e.target.value) })} className={inputCls}>
              <option value={400}>400</option>
              <option value={600}>600</option>
              <option value={700}>700</option>
              <option value={800}>800</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className={fieldCls}>
            <label className={labelCls}>{t('brand.fontFamily')}</label>
            <select value={layer.nameFontFamily} onChange={(e) => upd({ nameFontFamily: e.target.value })} className={inputCls}>
              <option value="Sora">Sora</option>
              <option value="Inter">Inter</option>
              <option value="system-ui">system-ui</option>
            </select>
          </div>
          <SliderField label={t('brand.logoSize')} value={layer.logoSize} min={8} max={300} unit="px" onChange={(v) => upd({ logoSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="mt-3" />
        </div>
      </PropertySection>

      <PropertySection id="brand-arrangement" title={t('brand.arrangement')} icon="layers">
        <SegmentedControl
          value={layer.direction}
          options={[
            { value: 'row', label: t('brand.horizontal') },
            { value: 'column', label: t('brand.vertical') },
          ]}
          onChange={(dir) => upd({ direction: dir })}
          className="grid grid-cols-2 gap-2 mb-3"
          optionClassName="rounded-lg border px-3 py-2 text-xs transition-colors"
        />
        <SliderField label={t('brand.gap')} value={layer.gap} min={0} max={200} unit="px" onChange={(v) => upd({ gap: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </PropertySection>
    </div>
  )
}
