/**
 * The browser behaviours that give a WebView away.
 *
 * Each of these is something a native app simply does not do, and none of
 * them can be turned off from CSS alone.
 */
export function suppressWebGestures(): () => void {
  const cleanups: Array<() => void> = []

  // Long-press on the chrome opens the WebView's own context menu, over the
  // app's. Editable surfaces keep theirs, because there the menu is the
  // clipboard and people expect it.
  const onContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable], .pd-selectable')) return
    event.preventDefault()
  }
  document.addEventListener('contextmenu', onContextMenu)
  cleanups.push(() => document.removeEventListener('contextmenu', onContextMenu))

  // Dropping a file anywhere but a drop target makes the WebView *navigate to
  // it*, throwing away the editor and everything in it.
  const swallow = (event: DragEvent) => {
    if ((event.target as HTMLElement | null)?.closest('[data-drop-target]')) return
    event.preventDefault()
  }
  document.addEventListener('dragover', swallow)
  document.addEventListener('drop', swallow)
  cleanups.push(() => {
    document.removeEventListener('dragover', swallow)
    document.removeEventListener('drop', swallow)
  })

  // Pinch on the chrome zooms the whole page in a WebView, leaving the app at
  // a scale it has no way to reset. The canvas listens for its own pinch, so
  // this only takes the ones that reached the document.
  const onGesture = (event: Event) => event.preventDefault()
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(name, onGesture, { passive: false })
    cleanups.push(() => document.removeEventListener(name, onGesture))
  }

  return () => { for (const cleanup of cleanups) cleanup() }
}
