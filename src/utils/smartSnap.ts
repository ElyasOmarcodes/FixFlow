/**
 * Smart snapping — the alignment behaviour Photoshop, Figma and Sketch all
 * share: while you drag, the object you are moving latches onto the edges and
 * centres of the objects around it, and a guide line shows you why it stopped.
 *
 * Everything here works in *canvas* coordinates and is pure, so the geometry
 * can be tested without a Konva stage. The caller converts the screen-space
 * snap distance into canvas units (divide by zoom) so the magnet feels the
 * same size however far you are zoomed in.
 */

export interface SnapBox {
  x: number
  y: number
  width: number
  height: number
}

/** One axis of the outcome: how far to move, and which lines to draw. */
interface AxisSnap {
  delta: number
  guides: number[]
}

export interface SnapResult {
  /** Correction to add to the moving box's position, in canvas units. */
  dx: number
  dy: number
  /** Canvas x positions of the vertical guides to draw. */
  vertical: number[]
  /** Canvas y positions of the horizontal guides to draw. */
  horizontal: number[]
}

export const EMPTY_SNAP: SnapResult = { dx: 0, dy: 0, vertical: [], horizontal: [] }

/**
 * The three places a box can align from on one axis. Centre is listed first so
 * that when a centre alignment and an edge alignment are equally close, centre
 * wins — matching what every other editor does, and what people expect when
 * they drag something towards the middle of the canvas.
 */
function edgesOf(start: number, size: number): number[] {
  return [start + size / 2, start, start + size]
}

/**
 * Best correction along one axis.
 *
 * Picks the smallest movement that brings any edge of the moving box onto any
 * candidate line. Then — and this is what makes multiple guides appear at once
 * — it reports *every* line the box ends up touching, not just the one that
 * caused the snap. Dragging a box so its left edge and its centre both land on
 * something draws both lines, which is the feedback that tells you the
 * alignment was not a coincidence.
 */
function snapAxis(
  start: number,
  size: number,
  candidates: readonly number[],
  threshold: number,
): AxisSnap {
  if (threshold <= 0 || candidates.length === 0) return { delta: 0, guides: [] }

  const edges = edgesOf(start, size)
  let best: number | null = null

  for (const edge of edges) {
    for (const line of candidates) {
      const delta = line - edge
      if (Math.abs(delta) > threshold) continue
      if (best === null || Math.abs(delta) < Math.abs(best)) best = delta
    }
  }

  if (best === null) return { delta: 0, guides: [] }

  // Which lines the box actually sits on once the correction is applied.
  // Compared with a hairline tolerance rather than ===: the deltas are floats
  // and an exact match would drop guides to rounding.
  const settled = edges.map((edge) => edge + best)
  const guides: number[] = []
  for (const line of candidates) {
    if (settled.some((edge) => Math.abs(edge - line) < 0.01) && !guides.includes(line)) {
      guides.push(line)
    }
  }

  return { delta: best, guides }
}

export interface SnapTargets {
  /** Boxes to align against — every other object on the slide. */
  boxes: readonly SnapBox[]
  /** Extra vertical lines, e.g. the canvas edges/centre and pano slide seams. */
  verticalLines?: readonly number[]
  /** Extra horizontal lines, e.g. the canvas top/middle/bottom. */
  horizontalLines?: readonly number[]
}

/**
 * Snap `moving` against `targets`, within `threshold` canvas units.
 *
 * The two axes are resolved independently: an object can latch horizontally
 * onto one neighbour while staying free vertically, which is what lets you
 * slide something along a guide instead of being trapped at an intersection.
 */
export function computeSnap(
  moving: SnapBox,
  targets: SnapTargets,
  threshold: number,
): SnapResult {
  const vertical: number[] = [...(targets.verticalLines ?? [])]
  const horizontal: number[] = [...(targets.horizontalLines ?? [])]

  for (const box of targets.boxes) {
    vertical.push(...edgesOf(box.x, box.width))
    horizontal.push(...edgesOf(box.y, box.height))
  }

  const x = snapAxis(moving.x, moving.width, vertical, threshold)
  const y = snapAxis(moving.y, moving.height, horizontal, threshold)

  return { dx: x.delta, dy: y.delta, vertical: x.guides, horizontal: y.guides }
}

/**
 * The canvas's own alignment lines: both outer edges and the centre, on each
 * axis, plus a vertical line at every pano slide seam so a layer can be
 * centred within one slide of a multi-slide panorama rather than only within
 * the whole strip.
 */
export function canvasSnapLines(
  width: number,
  height: number,
  slideBoundaries: readonly number[] = [],
): { verticalLines: number[]; horizontalLines: number[] } {
  const verticalLines = [0, width / 2, width]
  for (const boundary of slideBoundaries) {
    if (!verticalLines.includes(boundary)) verticalLines.push(boundary)
  }
  return { verticalLines, horizontalLines: [0, height / 2, height] }
}
