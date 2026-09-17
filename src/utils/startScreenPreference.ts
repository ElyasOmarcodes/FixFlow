/**
 * Whether the start screen opens on launch.
 *
 * A workspace preference, not project data: it describes how this person likes
 * to start, so it lives in localStorage rather than travelling inside an
 * exported project. Storage can throw (private windows, blocked site data), and
 * a thrown preference read must never stop the app from starting — every access
 * falls back to showing the screen, which is the recoverable direction.
 */

const KEY = 'pixeldeck:start-screen'

export function shouldShowStartScreenOnLaunch(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setShowStartScreenOnLaunch(show: boolean): void {
  try {
    window.localStorage.setItem(KEY, show ? 'on' : 'off')
  } catch {
    // Nothing to do: the preference simply does not persist this session.
  }
}
