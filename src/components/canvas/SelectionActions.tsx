import { useEditorStore } from '@/store'
import { resolveGroupView } from '@/utils/canvasFormats'
import { findLayerInTree } from '@/utils/layerTree'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { Layer } from '@/types'
export function SelectionActions({ onEdit }: { onEdit: () => void }) {
  const state = useEditorStore()
  const t = useT()
  const group = state.project.slideGroups.find((item) => item.id === state.activeSlideGroupId)
  const layer = group && state.selection?.layerId ? findLayerInTree(resolveGroupView(group, state.project.settings, state.activeLocale, state.activeCanvasFormat).layers, state.selection.layerId) : undefined
  if (!layer || layer.type === 'background' || state.editingTextId) return null
  const resize = (factor: number) => {
    const patch: Record<string, number> = {}
    const values = layer as unknown as Record<string, unknown>
    const keys = layer.type === 'group' || layer.type === 'phone' ? ['scale'] : layer.type === 'text' || layer.type === 'emoji' ? ['fontSize', 'width', 'height'] : ['width', 'height']
    for (const key of keys) if (typeof values[key] === 'number' || key === 'scale') patch[key] = (typeof values[key] === 'number' ? values[key] as number : 1) * factor
    state.updateLayer(layer.id, patch as Partial<Layer>)
  }
  const edit = () => { if (layer.type === 'text') state.startTextEdit(layer.id); else onEdit() }
  return <div className="pd-selection-actions" role="toolbar" aria-label={t('actions.selected')}>
    <button title={t('actions.edit')} aria-label={t('actions.edit')} onClick={edit}><Icon name="settings" size={18} /></button>
    <button title={t('actions.rotate')} aria-label={t('actions.rotate')} disabled={layer.locked} onClick={() => state.updateLayer(layer.id, { rotation: (layer.rotation + 90) % 360 })}><Icon name="rotate-cw" size={18} /></button>
    <button title={t('actions.shrink')} aria-label={t('actions.shrink')} disabled={layer.locked} onClick={() => resize(1 / 1.1)}>−</button>
    <button title={t('actions.grow')} aria-label={t('actions.grow')} disabled={layer.locked} onClick={() => resize(1.1)}>+</button>
    <button title={t('workspace.duplicate')} aria-label={t('workspace.duplicate')} onClick={() => state.duplicateLayer(layer.id)}><Icon name="copy" size={18} /></button>
    {layer.type === 'group' && <button title={t('layerUi.ungroup')} aria-label={t('layerUi.ungroup')} onClick={() => state.dissolveGroup(layer.id)}><Icon name="ungroup" size={18} /></button>}
    <button title={t('workspace.delete')} aria-label={t('workspace.delete')} onClick={() => state.removeLayer(layer.id)}><Icon name="trash" size={18} /></button>
  </div>
}
