/**
 * State shared between the pinch gesture and the layer drag handlers.
 *
 * A pinch is a viewport gesture: it moves the camera, not the design. But a
 * two-finger zoom usually begins with one finger already down, and if that
 * finger landed on a layer, Konva has already started dragging it. The pinch
 * then takes the events away — Konva never sees the second touchstart or the
 * final touchend — and what is left is a node that was dragged partway, a
 * `dragend` that reports wherever the finger happened to be when the second
 * one arrived, and Konva's own pointer bookkeeping holding a stale position
 * for the next gesture to compute a delta against.
 *
 * That is the "tap a layer after zooming and it jumps" report. A drag
 * interrupted by a pinch is cancelled rather than committed, which is what
 * every design tool does, and the tap that ends the pinch is swallowed so
 * lifting two fingers cannot select or move anything.
 */

let dragCancelledByPinch = false
let ignoreTapUntil = 0

/** How long after a pinch a tap is still part of that gesture, not a new one. */
const TAP_GRACE_MS = 350

/** Called when a second finger turns a drag into a pinch. */
export function cancelDragForPinch(): void {
  dragCancelledByPinch = true
}

/**
 * Whether the drag that is ending was cancelled by a pinch.
 *
 * Reading it clears it: a `dragend` arrives once, and the next real drag must
 * not inherit the flag.
 */
export function consumeDragCancelledByPinch(): boolean {
  const cancelled = dragCancelledByPinch
  dragCancelledByPinch = false
  return cancelled
}

/** Called when the last finger of a pinch lifts. */
export function startPinchTapGrace(): void {
  ignoreTapUntil = Date.now() + TAP_GRACE_MS
}

/** Whether a tap arriving now is the tail of a pinch rather than a new press. */
export function isPinchTap(): boolean {
  return Date.now() < ignoreTapUntil
}

/** Test hook. */
export function resetPinchGuard(): void {
  dragCancelledByPinch = false
  ignoreTapUntil = 0
}
