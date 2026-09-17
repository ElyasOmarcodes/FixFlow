import { useEffect } from 'react'
import { haptic } from './haptics'
import { isNativeMobile } from './platform'

/**
 * Answer every press in the hand.
 *
 * A delegated pointerdown listener rather than a prop on each button: the app
 * has several hundred controls, and a feedback rule that has to be remembered
 * at each one is a rule that will be missed at most of them. The element's
 * role picks the strength, so the vocabulary stays consistent without any
 * component deciding for itself.
 *
 * Fired on pointerdown, not click, because the point is to answer the finger
 * before the screen has finished reacting.
 */
export function usePressFeedback(): void {
  useEffect(() => {
    if (!isNativeMobile()) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      const target = event.target as HTMLElement | null
      const control = target?.closest('button, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], a[href]')
      if (!control || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return

      // Destructive and committing actions get the firmer tap; choosing among
      // options gets the selection tick; everything else the light one.
      const label = `${control.getAttribute('aria-label') ?? ''} ${control.textContent ?? ''}`.toLowerCase()
      if (control.hasAttribute('data-haptic-commit') || /delete|remove|export|publish/.test(label)) {
        haptic('commit')
      } else if (control.matches('[role="tab"], [role="switch"], [aria-pressed], [role="menuitem"]')) {
        haptic('select')
      } else {
        haptic('tap')
      }
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])
}
