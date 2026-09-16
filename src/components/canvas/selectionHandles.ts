import type { Layer } from '@/types'

/**
 * Geometry for the drag handles on the selection box — kept free of React and
 * Konva so the maths can be tested directly.
 */

/** Rotation step, in degrees, used while smart snap is on. */
export const ROTATION_SNAP_DEGREES = 45

/** Below this scale a layer becomes impossible to grab again, so resizing stops. */
export const MIN_RESIZE_FACTOR = 0.05
export const MAX_RESIZE_FACTOR = 20

/**
 * Angle in degrees from a centre point to a pointer, measured clockwise from
 * twelve o'clock — the same convention Konva's `rotation` uses, so the two can
 * be added without a correction term.
 */
export function angleFromCentre(centreX: number, centreY: number, pointerX: number, pointerY: number): number {
  return (Math.atan2(pointerY - centreY, pointerX - centreX) * 180) / Math.PI
}

/** Normalise to [0, 360) so the committed value never drifts off after many turns. */
export function normaliseRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * Where a rotation drag lands. `snap` quantises to 45° — the same toggle that
 * governs positional snapping, because a user who wants alignment help for
 * position wants it for angle too.
 */
export function resolveRotation(
  startRotation: number,
  startAngle: number,
  currentAngle: number,
  snap: boolean,
): number {
  const raw = startRotation + (currentAngle - startAngle)
  if (!snap) return normaliseRotation(raw)
  return normaliseRotation(Math.round(raw / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES)
}

/**
 * Scale factor for a resize drag, from how far the pointer is from the anchor
 * compared with where it started. Distances are used rather than a single axis
 * so the grip behaves the same wherever it is dragged.
 */
export function resolveResizeFactor(startDistance: number, currentDistance: number): number {
  if (startDistance <= 0) return 1
  const factor = currentDistance / startDistance
  return Math.min(MAX_RESIZE_FACTOR, Math.max(MIN_RESIZE_FACTOR, factor))
}

/**
 * Which numeric properties carry a layer's size, by type.
 *
 * Groups and phones are scaled as a unit; text and emoji grow by font size
 * (with their box, so wrapping keeps up); everything else has an explicit
 * width and height. Matching this to the layer type is what keeps a resize
 * from silently doing nothing on a mockup or stretching a headline's box
 * without changing the type size.
 */
export function resizeKeysFor(type: Layer['type']): readonly string[] {
  if (type === 'group' || type === 'phone') return ['scale']
  if (type === 'text' || type === 'emoji') return ['fontSize', 'width', 'height']
  return ['width', 'height']
}

/**
 * Apply a scale factor to a layer's size properties, reading from the values
 * captured when the drag began so a long drag never compounds rounding.
 */
export function scaledSizePatch(
  layer: Layer,
  startValues: Record<string, number>,
  factor: number,
): Record<string, number> {
  const patch: Record<string, number> = {}
  for (const key of resizeKeysFor(layer.type)) {
    const start = startValues[key]
    if (typeof start !== 'number') continue
    patch[key] = start * factor
  }
  return patch
}

/** Snapshot the size properties a resize will touch. */
export function captureSizeValues(layer: Layer): Record<string, number> {
  const values = layer as unknown as Record<string, unknown>
  const captured: Record<string, number> = {}
  for (const key of resizeKeysFor(layer.type)) {
    const value = values[key]
    // `scale` defaults to 1 when a project predates the field.
    if (typeof value === 'number') captured[key] = value
    else if (key === 'scale') captured[key] = 1
  }
  return captured
}
