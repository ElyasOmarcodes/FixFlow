import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore, useUndoRedo } from '@/store'
import { resolveGroupView } from '@/utils/canvasFormats'
import { findLayerInTree } from '@/utils/layerTree'
import { getStage } from '@/utils/stageRegistry'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { IconName } from '@/components/ui/Icon'
import type { Layer } from '@/types'
import {
  angleFromCentre,
  captureSizeValues,
  resolveResizeFactor,
  resolveRotation,
  scaledSizePatch,
} from './selectionHandles'

/**
 * The four corners of the selection box.
 *
 *   top-left      delete      click
 *   top-right     lock        click
 *   bottom-left   resize      drag
 *   bottom-right  rotate      drag (45° steps while smart snap is on)
 *
 * Two of them are drags rather than buttons because that is the gesture the
 * job needs: Konva's own resize anchors are 10px squares, which is fine with a
 * mouse and hopeless with a fingertip, and there is no rotate affordance at
 * all on touch. These sit outside the box so both remain usable.
 */

/** Distance from the box corner to the button's centre, in screen pixels. */
const CORNER_OFFSET = 17

/**
 * Below this the four buttons ring something smaller than themselves and the
 * cluster stops reading as "this layer". They sit *outside* the box, so this is
 * about legibility rather than overlap — which is why it is small enough that
 * an ordinary layer on a phone still gets them.
 */
const MIN_BOX_PX = 26

type Corner = 'tl' | 'tr' | 'bl' | 'br'

interface ScreenBox { x: number; y: number; width: number; height: number }

interface HandleSpec {
  key: string
  icon: IconName
  label: string
  corner: Corner
  danger?: boolean
  /** Click handles act once; drag handles track the pointer. */
  mode: 'click' | 'drag'
  onClick?: () => void
}

interface DragState {
  kind: 'resize' | 'rotate'
  layerId: string
  centreX: number
  centreY: number
  startAngle: number
  startDistance: number
  startRotation: number
  startValues: Record<string, number>
  /** The most recent patch applied, replayed on release to record one undo step. */
  lastPatch: Partial<Layer> | null
}

export function SelectionHandleActions() {
  const t = useT()
  const { pause, resume } = useUndoRedo()
  const {
    project, activeSlideGroupId, activeLocale, activeCanvasFormat,
    selection, selectedLayerIds, editingGroupId, editingTextId,
    zoom, viewportX, viewportY, smartSnap,
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
    smartSnap: s.smartSnap,
  })))

  const [box, setBox] = useState<ScreenBox | null>(null)
  // A stage drag or a transformer resize would drag the buttons along with the
  // pointer; they step aside for the gesture and return where the layer landed.
  const [stageGesture, setStageGesture] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState<'resize' | 'rotate' | null>(null)

  // Joined then split: the ids are what change, whereas a freshly built array
  // changes identity every render and would resubscribe the stage listeners.
  const idKey = (selectedLayerIds.length > 0
    ? selectedLayerIds
    : selection?.layerId ? [selection.layerId] : []).join(',')
  const targetIds = useMemo(() => (idKey ? idKey.split(',') : []), [idKey])
  const primaryId = targetIds.length === 1 ? targetIds[0] : null

  const rawGroup = project.slideGroups.find((item) => item.id === activeSlideGroupId)
  const layer = primaryId && rawGroup
    ? findLayerInTree(resolveGroupView(rawGroup, project.settings, activeLocale, activeCanvasFormat).layers, primaryId)
    : undefined

  // The background spans the whole canvas, so ringing it would strand four
  // buttons in the corners of the viewport, attached to nothing the eye reads
  // as selected.
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
      // The default space is the stage's own, which is exactly this overlay's
      // coordinate system: the Stage sits at 0,0 inside the same container.
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
      // Deferred rather than set inline: this effect runs on every geometry
      // change, and a synchronous setState would cascade a second render.
      const clear = requestAnimationFrame(() => setBox(null))
      return () => cancelAnimationFrame(clear)
    }
    // Measured after paint, when Konva has applied the new attributes; reading
    // in the effect body can catch a node mid-update and misplace the buttons.
    const frame = requestAnimationFrame(measure)
    const stage = getStage()
    if (!stage) return () => cancelAnimationFrame(frame)
    const begin = () => setStageGesture(true)
    const end = () => { setStageGesture(false); measure() }
    stage.on('dragstart.pdhandles transformstart.pdhandles', begin)
    stage.on('dragend.pdhandles transformend.pdhandles', end)
    return () => {
      cancelAnimationFrame(frame)
      stage.off('.pdhandles')
    }
  }, [measure, suppressed, zoom, viewportX, viewportY, project, editingGroupId, activeCanvasFormat, activeLocale])

  // ─ Resize and rotate drags ────────────────────────────────────────────────

  const commitPatch = useCallback((layerId: string, patch: Partial<Layer>) => {
    const state = useEditorStore.getState()
    if (state.editingGroupId) state.updateChildLayer(state.editingGroupId, layerId, patch)
    else state.updateLayer(layerId, patch)
  }, [])

  const beginDrag = useCallback((kind: 'resize' | 'rotate', event: React.PointerEvent) => {
    if (!primaryId || !layer || !box || layer.locked) return
    event.preventDefault()
    event.stopPropagation()
    const container = (event.currentTarget as HTMLElement).parentElement
    const rect = container?.getBoundingClientRect()
    if (!rect) return
    const centreX = rect.left + box.x + box.width / 2
    const centreY = rect.top + box.y + box.height / 2
    dragRef.current = {
      kind,
      layerId: primaryId,
      centreX,
      centreY,
      startAngle: angleFromCentre(centreX, centreY, event.clientX, event.clientY),
      startDistance: Math.hypot(event.clientX - centreX, event.clientY - centreY),
      startRotation: layer.rotation ?? 0,
      startValues: captureSizeValues(layer),
      lastPatch: null,
    }
    setDragging(kind)
    // One undo entry for the whole gesture, not one per pointer move.
    pause()
  }, [box, layer, primaryId, pause])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const target = useEditorStore.getState()
      const currentLayer = layer
      if (!currentLayer) return
      if (drag.kind === 'rotate') {
        const angle = angleFromCentre(drag.centreX, drag.centreY, event.clientX, event.clientY)
        const rotation = resolveRotation(
          drag.startRotation,
          drag.startAngle,
          angle,
          target.smartSnap,
        )
        const patch = { rotation } as Partial<Layer>
        drag.lastPatch = patch
        commitPatch(drag.layerId, patch)
      } else {
        const distance = Math.hypot(event.clientX - drag.centreX, event.clientY - drag.centreY)
        const factor = resolveResizeFactor(drag.startDistance, distance)
        const patch = scaledSizePatch(currentLayer, drag.startValues, factor) as Partial<Layer>
        drag.lastPatch = patch
        commitPatch(drag.layerId, patch)
      }
    }
    const handleUp = () => {
      const drag = dragRef.current
      dragRef.current = null
      setDragging(null)
      if (drag?.lastPatch) {
        // History was paused for the whole gesture, so the live preview left
        // nothing behind to undo. Rewinding to the starting values *while still
        // paused*, resuming, and then reapplying the result records exactly one
        // step whose "before" is where the drag began — instead of a hundred
        // steps, or none at all.
        const startPatch = drag.kind === 'rotate'
          ? ({ rotation: drag.startRotation } as Partial<Layer>)
          : (drag.startValues as Partial<Layer>)
        commitPatch(drag.layerId, startPatch)
        resume()
        commitPatch(drag.layerId, drag.lastPatch)
      } else {
        resume()
      }
      requestAnimationFrame(measure)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [dragging, layer, commitPatch, resume, measure])

  // Keep the buttons pinned to the layer while it is being resized or rotated.
  useEffect(() => {
    if (!dragging) return
    let frame = 0
    const tick = () => { measure(); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [dragging, measure])

  if (suppressed || !box) return null
  if (stageGesture && !dragging) return null
  if (box.width < MIN_BOX_PX || box.height < MIN_BOX_PX) return null

  const store = useEditorStore.getState
  const locked = Boolean(layer?.locked)

  const handles: HandleSpec[] = [
    {
      key: 'delete',
      icon: 'trash',
      label: t('workspace.delete'),
      corner: 'tl',
      danger: true,
      mode: 'click',
      onClick: () => { for (const id of targetIds) store().removeLayer(id) },
    },
    {
      key: 'lock',
      icon: locked ? 'lock' : 'unlock',
      label: locked ? t('props.unlockLayer') : t('props.lockLayer'),
      corner: 'tr',
      mode: 'click',
      onClick: () => { for (const id of targetIds) store().setLayerLocked(id, !locked) },
    },
    {
      key: 'resize',
      icon: 'maximize',
      label: t('actions.resizeDrag'),
      corner: 'bl',
      mode: 'drag',
    },
    {
      key: 'rotate',
      icon: 'rotate-cw',
      label: smartSnap ? t('actions.rotateDragSnap') : t('actions.rotateDrag'),
      corner: 'br',
      mode: 'drag',
    },
  ]

  // Resizing and rotating act on one layer; with several selected only the two
  // unambiguous actions are offered. A locked layer offers neither drag.
  const visible = handles.filter((handle) => {
    if (handle.mode === 'drag') return Boolean(primaryId) && !locked
    return true
  })

  const position = (corner: Corner) => ({
    left: (corner === 'tl' || corner === 'bl' ? box.x : box.x + box.width) - CORNER_OFFSET,
    top: (corner === 'tl' || corner === 'tr' ? box.y : box.y + box.height) - CORNER_OFFSET,
  })

  return (
    <div className="pd-handle-actions" aria-label={t('actions.selected')}>
      {visible.map((handle) => (
        <button
          key={handle.key}
          type="button"
          className={[
            'pd-handle-action',
            handle.danger ? 'pd-handle-action-danger' : '',
            handle.mode === 'drag' ? 'pd-handle-action-drag' : '',
            dragging === handle.key ? 'pd-handle-action-active' : '',
          ].filter(Boolean).join(' ')}
          style={position(handle.corner)}
          title={handle.label}
          aria-label={handle.label}
          onPointerDown={handle.mode === 'drag'
            ? (event) => beginDrag(handle.key as 'resize' | 'rotate', event)
            : (event) => event.stopPropagation()}
          onClick={handle.onClick
            ? (event) => { event.stopPropagation(); handle.onClick?.() }
            : undefined}
        >
          <Icon name={handle.icon} size={13} strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}
