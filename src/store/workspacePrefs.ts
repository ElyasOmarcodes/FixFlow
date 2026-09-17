/**
 * Workspace preferences — how this person likes the editor to behave, as
 * opposed to what their design contains.
 *
 * These live in localStorage rather than in the project document on purpose:
 * a project that travels to another machine (or into the CLI exporter) must
 * not carry someone else's editor settings, and turning a guide on must not
 * mark the project dirty or land in the undo history.
 */

// Still `pixeldeck`: the app was renamed, the data on people's machines was
// not. Renaming a storage key does not migrate it — it reads a different,
// empty one. See src/store/idb-storage.ts.
const SMART_SNAP_KEY = 'pixeldeck.smart-snap'

/**
 * Snapping defaults to on. It is what people expect from an editor of this
 * kind, and it is trivially discoverable to switch off from the toolbar —
 * whereas its absence is invisible and just makes alignment feel imprecise.
 */
export const SMART_SNAP_DEFAULT = true

export function readSmartSnap(): boolean {
  if (typeof window === 'undefined') return SMART_SNAP_DEFAULT
  try {
    const stored = window.localStorage.getItem(SMART_SNAP_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    // Private mode or blocked storage — fall back to the default.
  }
  return SMART_SNAP_DEFAULT
}

export function persistSmartSnap(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SMART_SNAP_KEY, enabled ? 'on' : 'off')
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
}
