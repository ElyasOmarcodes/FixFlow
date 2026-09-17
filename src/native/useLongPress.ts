import { useCallback, useEffect, useRef } from 'react'
import { haptic } from './haptics'

/**
 * A long press, driven by pointer events rather than by the browser's
 * `contextmenu`.
 *
 * `contextmenu` looked like the obvious way to get a long press for free, and
 * it is not: whether a touch long-press fires it at all depends on the element
 * (a `<button>` behaves differently from a `<div>`), on `user-select`, and on
 * the browser. It also cannot be felt — a gesture with no visual start needs
 * the buzz to say the press was recognised, before the menu appears.
 *
 * So the timing is measured here. Right-click still works, because on a
 * desktop that is what a long press means.
 */

/** Long enough not to fire on a slow tap, short enough not to feel stuck. */
const HOLD_MS = 450

/** A press that travels this far is a scroll or a drag, not a hold. */
const SLOP_PX = 10

export interface LongPressPoint {
  clientX: number
  clientY: number
}

export function useLongPress(onLongPress: (point: LongPressPoint) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef<LongPressPoint | null>(null)
  // Set when the hold fires, so the click it would otherwise turn into is
  // swallowed — without this, holding a slide opens its menu *and* selects it.
  const fired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    origin.current = null
  }, [])

  // Unmounting mid-hold must not leave a timer that fires into a dead
  // component. The id is read at teardown through a local, not the ref.
  useEffect(() => () => {
    const pending = timer.current
    if (pending) clearTimeout(pending)
  }, [])

  return {
    // The handlers are a fresh object each render, so each closes over the
    // current callback — no ref needed to keep it up to date.
    onPointerDown: (event: React.PointerEvent) => {
      // Only a primary touch or pen hold; a mouse gets the context menu below.
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      fired.current = false
      origin.current = { clientX: event.clientX, clientY: event.clientY }
      const point = origin.current
      timer.current = setTimeout(() => {
        timer.current = null
        fired.current = true
        haptic('select')
        onLongPress(point)
      }, HOLD_MS)
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = origin.current
      if (!start || !timer.current) return
      const travelled = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY)
      if (travelled > SLOP_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (!fired.current) return
      fired.current = false
      event.preventDefault()
      event.stopPropagation()
    },
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onLongPress({ clientX: event.clientX, clientY: event.clientY })
    },
  }
}
