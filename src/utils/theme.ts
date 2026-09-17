/**
 * The app's theme, owned by a module rather than by a component.
 *
 * It used to live entirely inside ThemeControl's effect — and ThemeControl is
 * rendered in the desktop toolbar, which is not mounted at all on a phone. So
 * a light phone opened the app dark and stayed dark until the "…" sheet was
 * opened once, which is the first moment the control existed to run its
 * effect. The theme is a property of the app, not of a control that happens
 * to set it.
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

// Still `pixeldeck`: the app was renamed, the data on people's machines was
// not. Renaming a storage key does not migrate it — it reads a different,
// empty one. See src/store/idb-storage.ts.
const KEY = 'pixeldeck.theme'

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'dark' || saved === 'light' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Paint the document, and tell the native shell to repaint its bars to match. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  // The <meta name="theme-color"> is what a mobile browser tints its own
  // chrome with, and what a PWA uses for the task-switcher card.
  const surface = getComputedStyle(root).getPropertyValue('--pd-workspace').trim()
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', surface)
  }
  return resolved
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(KEY, preference)
  } catch {
    // Session-only preference.
  }
}

/**
 * Keep the document in step with the preference and, when it is 'system',
 * with the OS switching under us. Returns an unsubscribe.
 */
export function watchTheme(
  getPreference: () => ThemePreference,
  onApply?: (resolved: ResolvedTheme) => void,
): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => onApply?.(applyTheme(getPreference()))
  apply()
  media.addEventListener('change', apply)
  return () => media.removeEventListener('change', apply)
}
