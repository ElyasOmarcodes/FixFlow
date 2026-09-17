/**
 * What Android's Back gesture dismisses.
 *
 * The editor stacks surfaces — a sheet over a panel, a dialog over the sheet,
 * a popover over the dialog — and Back has to unwind them in the order they
 * were opened. Asking each surface to guess ("am I the frontmost thing?")
 * is how Back ends up closing the panel *behind* the dialog, or minimising
 * the app while a dialog is still up.
 *
 * So every dismissible surface pushes a handler while it is open and pops it
 * when it closes, and Back runs the top one. The stack is a plain module
 * rather than React state because the order must survive re-renders and be
 * readable from the native listener without a component in scope.
 */

export type BackHandler = () => void

interface Entry {
  id: number
  /** Higher wins regardless of order, so a dialog always beats a panel. */
  priority: number
  handler: BackHandler
}

const stack: Entry[] = []
let nextId = 1

/**
 * Register a handler for as long as the surface is open.
 *
 * Priority breaks the tie when two surfaces are open at once but were not
 * opened in the obvious order — a confirmation raised *by* a dialog is on
 * top of it even though React may have mounted them together.
 */
export function pushBackHandler(handler: BackHandler, priority = 0): () => void {
  const entry: Entry = { id: nextId++, priority, handler }
  stack.push(entry)
  return () => {
    const at = stack.indexOf(entry)
    if (at >= 0) stack.splice(at, 1)
  }
}

/**
 * Run the frontmost handler.
 *
 * Returns false when nothing is open, which is the caller's signal to do
 * whatever Back means at the root of the app.
 */
export function handleBack(): boolean {
  if (stack.length === 0) return false
  let top = stack[stack.length - 1]
  for (const entry of stack) {
    // Later wins an equal priority, so the most recently opened is frontmost.
    if (entry.priority >= top.priority) top = entry
  }
  const at = stack.indexOf(top)
  if (at >= 0) stack.splice(at, 1)
  top.handler()
  return true
}

/** How many surfaces are currently dismissible. Used by tests and the shell. */
export function backStackDepth(): number {
  return stack.length
}

/** Test hook: drop everything without running it. */
export function clearBackStack(): void {
  stack.length = 0
}

/** Priorities, named so call sites do not invent numbers. */
export const BACK_PRIORITY = {
  /** Editor state — a selection or an editing mode, under every surface. */
  canvas: 5,
  panel: 10,
  sheet: 20,
  popover: 25,
  modal: 30,
  confirm: 40,
} as const
