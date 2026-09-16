import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { resolveGroupView } from '@/utils/canvasFormats'
import { findLayerInTree } from '@/utils/layerTree'
import { getStage } from '@/utils/stageRegistry'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { IconName } from '@/components/ui/Icon'

/**
 * Actions attached to the corners of the selection box.
 *
 * The four corners are all that is offered on purpose. Konva's resize anchors
 * already occupy the corners and the edge midpoints, so every action button has
 * to sit *outside* the box — and eight buttons ringing a small layer would be a
 * wall of targets that hides the artwork it is meant to act on. Four corners
 * cover the actions people reach for constantly (delete, duplicate, lock,
 * edit); everything else stays in the panels, where there is room to label it.
 */

/** How far outside the box a button's centre sits, in screen pixels. */
const CORNER_OFFSET = 17

/**
 * Below this on-screen size the buttons would cover the layer completely and
 * collide with the resize anchors, so they are not drawn at all. Zooming in
 * brings them back.
 */
const MIN_BOX_PX = 74

interface ScreenBox {
  x: number
  y: number
  width: number
  height: number
}

interface CornerAction {
  key: string
  icon: IconName
  label: string
  /** Placement around the box. */
  corner: 'tl' | 'tr' | 'bl' | 'br'
  danger?: boolean
  run: () => void
}

export function SelectionHandleActions({ onEdit }: { onEdit: () => void }) {
  const t = useT()
  const {
    project, activeSlideGroupId, activeLocale, activeCanvasFormat,
    selection, selectedLayerIds, editingGroupId, editingTextId, zoom, viewportX, viewportY,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    activeLocale: s.activeLocale,
    activeCanvasFormat: s.activeCanvasFormat,
    selection: s.selection,
    selectedLayerIds: s.selectedLayerIds,
    editingGroupId: s.editingGroupId,
    editingTextId: s.editingTextId,
    zoom: s.zoom,
    viewportX: s.viewportX,
    viewportY: s.viewportY,
  })))

  const [box, setBox] = useState<ScreenBox | null>(null)
  // A drag or resize would drag the buttons along with the pointer; they go
  // away for the gesture and come back where the layer ended up.
  const [gesturing, setGesturing] = useState(false)

  // Joined first, then split back: the ids are what actually change, whereas a
  // freshly built array changes identity on every render and would re-subscribe
  // the stage listeners continuously.
  const idKey = (selectedLayerIds.length > 0
    ? selectedLayerIds
    : selection?.layerId ? [selection.layerId] : []).join(',')
  const targetIds = useMemo(() => (idKey ? idKey.split(',') : []), [idKey])
  const primaryId = targetIds.length === 1 ? targetIds[0] : null

  const rawGroup = project.slideGroups.find((item) => item.id === activeSlideGroupId)
  const layer = primaryId && rawGroup
    ? findLayerInTree(resolveGroupView(rawGroup, project.settings, activeLocale, activeCanvasFormat).layers, primaryId)
    : undefined

  // The background fills the canvas, so a ring of buttons around it would sit
  // in the corners of the viewport, detached from anything the user selected.
  const suppressed = targetIds.length === 0
    || Boolean(editingTextId)
    || (Boolean(layer) && layer?.type === 'background')

  const measure = useCallback(() => {
    const stage = getStage()
    if (!stage || targetIds.length === 0) { setBox(null); return }
    let merged: ScreenBox | null = null
    for (const id of targetIds) {
      const node = stage.findOne(`#layer-${id}`)
      if (!node) continue
      // Default space is the stage's own, which is exactly the overlay's
      // coordinate system: the Stage sits at 0,0 inside this container.
      const rect = node.getClientRect({ skipShadow: true })
      if (!merged) {
        merged = { ...rect }
      } else {
        const right = Math.max(merged.x + merged.width, rect.x + rect.width)
        const bottom = Math.max(merged.y + merged.height, rect.y + rect.height)
        merged.x = Math.min(merged.x, rect.x)
        merged.y = Math.min(merged.y, rect.y)
        merged.width = right - merged.x
        merged.height = bottom - merged.y
      }
    }
    setBox(merged)
  }, [targetIds])

  useEffect(() => {
    if (suppressed) {
      // Deferred rather than set inline: this runs on every geometry change,
      // and a synchronous setState here would cascade a second render each time.
      const clear = requestAnimationFrame(() => setBox(null))
      return () => cancelAnimationFrame(clear)
    }
    // Measured after paint, when Konva has applied the new attributes — reading
    // during the effect body can catch the node mid-update and misplace the
    // buttons by a frame.
    const frame = requestAnimationFrame(measure)
    const stage = getStage()
    if (!stage) return () => cancelAnimationFrame(frame)
    const begin = () => setGesturing(true)
    const end = () => { setGesturing(false); measure() }
    stage.on('dragstart.pdhandles transformstart.pdhandles', begin)
    stage.on('dragend.pdhandles transformend.pdhandles', end)
    return () => {
      cancelAnimationFrame(frame)
      stage.off('.pdhandles')
    }
  }, [measure, suppressed, zoom, viewportX, viewportY, project, editingGroupId, activeCanvasFormat, activeLocale])

  if (suppressed || !box || gesturing) return null
  if (box.width < MIN_BOX_PX || box.height < MIN_BOX_PX) return null

  const store = useEditorStore.getState
  const locked = Boolean(layer?.locked)

  const actions: CornerAction[] = [
    {
      key: 'delete',
      icon: 'trash',
      label: t('workspace.delete'),
      corner: 'tl',
      danger: true,
      run: () => { for (const id of targetIds) store().removeLayer(id) },
    },
    {
      key: 'duplicate',
      icon: 'copy',
      label: t('workspace.duplicate'),
      corner: 'tr',
      run: () => { for (const id of targetIds) store().duplicateLayer(id) },
    },
    {
      key: 'lock',
      icon: locked ? 'lock' : 'unlock',
      label: locked ? t('props.unlockLayer') : t('props.lockLayer'),
      corner: 'bl',
      run: () => { for (const id of targetIds) store().setLayerLocked(id, !locked) },
    },
    {
      key: 'edit',
      icon: 'settings',
      label: t('actions.edit'),
      corner: 'br',
      run: () => {
        if (layer?.type === 'text') store().startTextEdit(layer.id)
        else onEdit()
      },
    },
  ]

  // Lock and edit are single-layer notions; a mixed multi-selection gets the
  // two that are unambiguous.
  const visible = primaryId ? actions : actions.filter((a) => a.key === 'delete' || a.key === 'duplicate')

  const position = (corner: CornerAction['corner']) => ({
    left: (corner === 'tl' || corner === 'bl' ? box.x : box.x + box.width) - CORNER_OFFSET,
    top: (corner === 'tl' || corner === 'tr' ? box.y : box.y + box.height) - CORNER_OFFSET,
  })

  return (
    <div className="pd-handle-actions" aria-label={t('actions.selected')}>
      {visible.map((action) => (
        <button
          key={action.key}
          type="button"
          className={`pd-handle-action${action.danger ? ' pd-handle-action-danger' : ''}`}
          style={position(action.corner)}
          title={action.label}
          aria-label={action.label}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); action.run() }}
        >
          <Icon name={action.icon} size={13} strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}
