import { useEditorStore } from '@/store'
import type { GroupLayer, Layer } from '@/types'
import { labelCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'
import { PropertySection } from '@/components/properties/PropertySection'
import { useT } from '@/i18n'
import { Icon } from '@/components/ui/Icon'
import { LAYER_ICON } from '@/components/panels/layers/constants'



export function GroupProperties({ layer }: { layer: GroupLayer }) {
  const t = useT()
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<GroupLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const scale = layer.scale ?? 1

  return (
    <div className="space-y-3">
      {/* Enter hint */}
      <div className="rounded-xl border border-[rgba(124,110,246,0.25)] bg-[rgba(124,110,246,0.08)] p-3">
        <p className="text-xs font-semibold text-[var(--pd-c-c4b5fd)] mb-1">{t('group.selected')}</p>
        <p className="text-xs text-[var(--pd-c-9b8fff)]">{t('group.enterHint')}</p>
      </div>

      {/* Scale */}
      <PropertySection id="group-scale" title={t('group.scale')} icon="group">
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>{t('group.scale')}</label>
          <span className="text-xs text-[var(--pd-c-e8e8f0)]">{scale.toFixed(2)}×</span>
        </div>
        <input type="range" min={0.1} max={4} step={0.05} value={scale} onChange={(e) => upd({ scale: Number(e.target.value) })} onMouseDown={pauseTemporal} onMouseUp={resumeTemporal} className="w-full accent-[var(--pd-c-7c6ef6)]" />
      </PropertySection>

      {/* Children list */}
      {layer.children.length > 0 && (
        <PropertySection id="group-children" title={t('group.children', { count: layer.children.length })} icon="layers">
          <div className="space-y-1">
            {layer.children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--pd-line-subtle)] bg-[var(--pd-c-0f0f13)] px-2 py-1.5"
              >
                <span className="flex w-4 justify-center text-[var(--pd-c-8a86a0)] shrink-0">
                  <Icon name={LAYER_ICON[child.type] ?? 'shape'} size={13} />
                </span>
                <span className="text-xs text-[var(--pd-c-a0a0b0)] flex-1 truncate">{child.name}</span>
                <span className="text-[10px] text-[var(--pd-c-4a4a5a)] shrink-0 uppercase tracking-wide">{child.type}</span>
              </div>
            ))}
          </div>
        </PropertySection>
      )}
    </div>
  )
}
