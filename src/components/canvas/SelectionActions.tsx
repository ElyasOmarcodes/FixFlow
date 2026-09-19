import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { resolveGroupView } from '@/utils/canvasFormats'
import { findLayerInTree } from '@/utils/layerTree'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { IconName } from '@/components/ui/Icon'

/**
 * The floating bar under the selected layer.
 *
 * Deliberately narrow in purpose: duplication and stacking order. Everything
 * that changes the layer's *geometry* — delete, lock, resize, rotate — lives on
 * the selection box corners instead, where it is attached to the thing it acts
 * on. Splitting them this way keeps either cluster small enough to read at a
 * glance, and means neither one grows into a second properties panel.
 */
export function SelectionActions() {
  const t = useT()
  const {
    project, activeSlideGroupId, activeLocale, activeCanvasFormat,
    selection, selectedLayerIds, editingTextId, editingGroupId,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    activeLocale: s.activeLocale,
    activeCanvasFormat: s.activeCanvasFormat,
    selection: s.selection,
    selectedLayerIds: s.selectedLayerIds,
    editingTextId: s.editingTextId,
    editingGroupId: s.editingGroupId,
  })))

  const targetIds = selectedLayerIds.length > 0
    ? selectedLayerIds
    : selection?.layerId ? [selection.layerId] : []

  const group = project.slideGroups.find((item) => item.id === activeSlideGroupId)
  const layer = targetIds.length === 1 && group
    ? findLayerInTree(resolveGroupView(group, project.settings, activeLocale, activeCanvasFormat).layers, targetIds[0])
    : undefined

  // Nothing to reorder while typing, and the background owns the bottom of the
  // stack by definition — offering to move it would be a lie.
  if (targetIds.length === 0 || editingTextId) return null
  if (targetIds.length === 1 && (!layer || layer.type === 'background')) return null

  const store = useEditorStore.getState
  // Reordering inside a group edits the group's children, which is a different
  // list from the slide's; only duplication is meaningful there.
  const canReorder = !editingGroupId

  const actions: { key: string; icon: IconName; label: string; run: () => void }[] = [
    {
      key: 'duplicate',
      icon: 'copy',
      label: t('workspace.duplicate'),
      run: () => { for (const id of targetIds) store().duplicateLayer(id) },
    },
    ...(canReorder ? [
      {
        key: 'front',
        icon: 'bring-to-front' as IconName,
        label: t('actions.bringToFront'),
        // Front-most last: applying in order leaves the selection stacked the
        // way it was, rather than reversed.
        run: () => { for (const id of targetIds) store().bringLayerToFront(id) },
      },
      {
        key: 'forward',
        icon: 'arrow-up' as IconName,
        label: t('actions.bringForward'),
        run: () => { for (const id of [...targetIds].reverse()) store().bringLayerForward(id) },
      },
      {
        key: 'backward',
        icon: 'arrow-down' as IconName,
        label: t('actions.sendBackward'),
        run: () => { for (const id of targetIds) store().sendLayerBackward(id) },
      },
      {
        key: 'back',
        icon: 'send-to-back' as IconName,
        label: t('actions.sendToBack'),
        run: () => { for (const id of [...targetIds].reverse()) store().sendLayerToBack(id) },
      },
    ] : []),
    {
      // The shortest path from "this layer is wrong" to asking for it to be
      // fixed: the selection is already the assistant's context, so the button
      // only has to open the panel.
      key: 'ask-ai',
      icon: 'sparkles' as IconName,
      label: t('assistant.ask'),
      run: () => window.dispatchEvent(new CustomEvent('fixflow:assistant')),
    },
  ]

  return (
    <div className="pd-selection-actions" role="toolbar" aria-label={t('actions.selected')}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          title={action.label}
          aria-label={action.label}
          onClick={action.run}
        >
          <Icon name={action.icon} size={18} />
        </button>
      ))}
    </div>
  )
}
