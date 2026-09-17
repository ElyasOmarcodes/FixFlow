import { useEffect } from 'react'
import { BACK_PRIORITY, pushBackHandler } from './backStack'

/**
 * Register a surface with Android's Back gesture for as long as it is open.
 *
 * Every dismissible thing calls this — modals through ModalShell, the mobile
 * panels and sheets, the start screen — so Back unwinds them in the order a
 * person opened them instead of whichever one happened to check first.
 */
export function useBackDismiss(
  open: boolean,
  onDismiss: () => void,
  priority: number = BACK_PRIORITY.modal,
): void {
  useEffect(() => {
    if (!open) return
    // The handler is read through a ref-like closure on each press, so a
    // surface that re-renders with a new callback still dismisses correctly.
    return pushBackHandler(() => onDismiss(), priority)
  }, [open, onDismiss, priority])
}
