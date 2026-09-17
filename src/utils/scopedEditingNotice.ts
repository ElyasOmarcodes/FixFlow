import { useSyncExternalStore } from 'react'

/**
 * Whether the "edits are scoped to this format / locale" warning has been
 * shown before.
 *
 * It used to appear every single time a format other than Base was selected —
 * a yellow frame around the whole canvas plus a banner under the toolbar —
 * which is a lot of chrome to re-teach something you learned the first time.
 * It is a fact about the person, not about the project, so it lives in
 * localStorage and never travels inside an exported design.
 */

export type ScopedNoticeKind = 'format' | 'locale'

// Still `pixeldeck`: the app was renamed, the data on people's machines was
// not. Renaming a storage key does not migrate it — it reads a different,
// empty one. See src/store/idb-storage.ts.
const KEY = 'pixeldeck:scoped-notice-seen'

/** Kinds already shown. Read once; storage can throw in a private window. */
function readSeen(): Set<ScopedNoticeKind> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? (parsed as ScopedNoticeKind[]) : [])
  } catch {
    // Unreadable storage means "not seen": showing the notice once more is
    // recoverable, silently hiding it forever is not.
    return new Set()
  }
}

let seen = typeof window === 'undefined' ? new Set<ScopedNoticeKind>() : readSeen()
const listeners = new Set<() => void>()

/** A stable snapshot, so useSyncExternalStore does not loop on a fresh Set. */
let snapshot = [...seen].sort().join(',')

function emit(): void {
  snapshot = [...seen].sort().join(',')
  for (const listener of listeners) listener()
}

export function markScopedNoticeSeen(kind: ScopedNoticeKind): void {
  if (seen.has(kind)) return
  seen = new Set(seen).add(kind)
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    // Not persisted; it will simply be shown again next launch.
  }
  emit()
}

/** Test and settings hook: show the notices again from scratch. */
export function resetScopedNoticesSeen(): void {
  seen = new Set()
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The kinds already shown, as a comma-joined snapshot React can compare. */
export function useScopedNoticesSeen(): { has: (kind: ScopedNoticeKind) => boolean } {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => '')
  const set = new Set(value ? value.split(',') : [])
  return { has: (kind) => set.has(kind) }
}
