import { useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { canvasSnapLines, computeSnap, type SnapBox } from '@/utils/smartSnap'

/**
 * How close, in *screen* pixels, a layer has to come before it latches. Divided
 * by the zoom at snap time, so the magnet is the same physical size whether
 * the canvas is at 10% or 200% — the alternative snaps from half a slide away
 * when zoomed out and is unusable when zoomed in.
 */
const SNAP_SCREEN_PX = 7

export interface SnapGuides {
  vertical: number[]
  horizontal: number[]
}

const NO_GUIDES: SnapGuides = { vertical: [], horizontal: [] }

interface UseSmartSnapOptions {
  enabled: boolean
  zoom: number
  canvasWidth: number
  canvasHeight: number
  /** Canvas x of each pano slide boundary, so a layer can centre within one slide. */
  slideBoundaries: number[]
}

/**
 * The parent's scale relative to the canvas, used to convert a correction
 * measured in canvas units into the node's own coordinate space. For a
 * top-level layer the parent is the Konva Layer and this is 1; inside a scaled
 * group it is the group's scale.
 */
function parentScaleInCanvasSpace(node: Konva.Node): { x: number; y: number } | null {
  const parent = node.getParent()
  const stage = node.getStage()
  if (!parent || !stage) return null
  // A rotated parent would need the full inverse transform, and a correction
  // applied along the wrong axes is worse than no snapping at all.
  if (parent.getAbsoluteRotation?.() ?? parent.rotation()) return null
  const absolute = parent.getAbsoluteScale()
  const stageScaleX = stage.scaleX() || 1
  const stageScaleY = stage.scaleY() || 1
  const x = absolute.x / stageScaleX
  const y = absolute.y / stageScaleY
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) return null
  return { x, y }
}

export function useSmartSnap({
  enabled,
  zoom,
  canvasWidth,
  canvasHeight,
  slideBoundaries,
}: UseSmartSnapOptions) {
  const [guides, setGuides] = useState<SnapGuides>(NO_GUIDES)
  const bypassRef = useRef(false)

  // A ref rather than state: this is read inside a drag handler and must not
  // re-render the stage mid-drag. `blur` covers alt-tabbing away, which
  // otherwise leaves the bypass stuck on because the keyup never arrives.
  useEffect(() => {
    const sync = (event: KeyboardEvent) => { bypassRef.current = event.altKey }
    const release = () => { bypassRef.current = false }
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', release)
    }
  }, [])

  // Mirrors `guides` so the drag handler can skip a setState when nothing
  // changed. A drag fires this every pointer move; re-rendering the whole
  // stage on each one is what makes dragging feel heavy.
  const lastGuidesRef = useRef<SnapGuides>(NO_GUIDES)

  const publishGuides = useCallback((next: SnapGuides) => {
    const previous = lastGuidesRef.current
    const same =
      previous.vertical.length === next.vertical.length &&
      previous.horizontal.length === next.horizontal.length &&
      previous.vertical.every((line, i) => line === next.vertical[i]) &&
      previous.horizontal.every((line, i) => line === next.horizontal[i])
    if (same) return
    lastGuidesRef.current = next
    setGuides(next)
  }, [])

  const clearGuides = useCallback(() => publishGuides(NO_GUIDES), [publishGuides])

  /**
   * Nudges `node` onto the nearest alignment and returns how far it moved, in
   * canvas units, so a multi-selection drag can carry the rest of the
   * selection by the same amount.
   */
  const snapNode = useCallback((node: Konva.Node, excludeIds: ReadonlySet<string>) => {
    // Alt suspends snapping for as long as it is held, the way every other
    // editor does it: the last few pixels of a nudge are exactly when you need
    // the magnet out of the way, and reaching for the toolbar loses the drag.
    if (!enabled || bypassRef.current) {
      if (lastGuidesRef.current !== NO_GUIDES) publishGuides(NO_GUIDES)
      return { dx: 0, dy: 0 }
    }
    const layer = node.getLayer()
    const parent = node.getParent()
    if (!layer || !parent) return { dx: 0, dy: 0 }

    const scale = parentScaleInCanvasSpace(node)
    if (!scale) return { dx: 0, dy: 0 }

    // Everything is measured against the Konva Layer, which carries no
    // transform of its own — so its coordinate space *is* canvas space,
    // independent of zoom and pan.
    const moving: SnapBox = node.getClientRect({ relativeTo: layer })

    const boxes: SnapBox[] = []
    for (const sibling of parent.getChildren()) {
      if (sibling === node) continue
      if (!sibling.isVisible()) continue
      const id = sibling.id()
      // Layers moving with this drag are not alignment targets — they are part
      // of what is being aligned.
      if (id.startsWith('layer-') && excludeIds.has(id.slice(6))) continue
      boxes.push(sibling.getClientRect({ relativeTo: layer }))
    }

    const lines = canvasSnapLines(canvasWidth, canvasHeight, slideBoundaries)
    const snap = computeSnap(moving, { boxes, ...lines }, SNAP_SCREEN_PX / zoom)

    if (snap.dx !== 0 || snap.dy !== 0) {
      node.x(node.x() + snap.dx / scale.x)
      node.y(node.y() + snap.dy / scale.y)
    }

    publishGuides({ vertical: snap.vertical, horizontal: snap.horizontal })
    return { dx: snap.dx, dy: snap.dy }
  }, [enabled, zoom, canvasWidth, canvasHeight, slideBoundaries, publishGuides])

  return { guides, snapNode, clearGuides }
}
