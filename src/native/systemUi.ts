import { isAndroid, isNativeMobile } from './platform'

/**
 * The system bars, kept in step with the app's own theme.
 *
 * A web page in a WebView leaves the status bar whatever colour the shell
 * launched with, so switching to the light theme leaves a black strip across
 * the top and the app stops looking like one piece. Native apps repaint it.
 *
 * Every call is best-effort: the plugin is absent in a browser and on
 * desktop, and a failure here must never interrupt a theme change.
 */

type Appearance = 'dark' | 'light'

let plugin: typeof import('@capacitor/status-bar') | null = null
let loading: Promise<void> | null = null

async function ensurePlugin(): Promise<void> {
  loading ??= import('@capacitor/status-bar').then((module) => { plugin = module }).catch(() => {})
  return loading
}

/**
 * Repaint the system bars for a theme.
 *
 * `background` is the app's own surface colour, so the bar and the chrome
 * under it are the same colour rather than merely both dark.
 */
export function applySystemBars(appearance: Appearance, background: string): void {
  if (!isNativeMobile()) return
  void ensurePlugin().then(async () => {
    if (!plugin) return
    try {
      // Dark chrome needs light glyphs, and the other way round — the plugin's
      // Style names the *content*, not the background, which is the usual
      // place to get this backwards.
      await plugin.StatusBar.setStyle({
        style: appearance === 'dark' ? plugin.Style.Dark : plugin.Style.Light,
      })
      // Android alone lets the colour be set; on iOS it follows the view.
      if (isAndroid()) await plugin.StatusBar.setBackgroundColor({ color: background })
    } catch {
      // An edge-to-edge configuration can refuse the colour; the style still
      // applied, and a mismatched bar is not worth an error.
    }
  })
}

/**
 * Keep the WebView from scrolling itself when the keyboard opens.
 *
 * The editor is a fixed-height app, not a document: letting the WebView pan
 * the whole page under the keyboard slides the toolbar off the top and is the
 * single most web-like thing a Capacitor app does. Resizing the view instead
 * lets the app's own layout react.
 */
export function configureKeyboard(): void {
  if (!isAndroid()) return
  void import('@capacitor/keyboard').then(async ({ Keyboard, KeyboardResize }) => {
    try {
      await Keyboard.setResizeMode({ mode: KeyboardResize.None })
      await Keyboard.setScroll({ isDisabled: true })
    } catch {
      // Older WebViews refuse; the CSS fallbacks still hold the layout.
    }
  }).catch(() => {})
}

/**
 * Publish the keyboard's height as a CSS variable.
 *
 * A bottom sheet has to sit above the keyboard rather than under it, and only
 * the native side knows how tall it is. `--pd-keyboard-h` is 0 everywhere
 * else, so the same CSS works in a browser.
 */
export function trackKeyboardInset(): () => void {
  if (!isNativeMobile()) return () => {}
  let cleanup = () => {}
  void import('@capacitor/keyboard').then(async ({ Keyboard }) => {
    const set = (height: number) => {
      document.documentElement.style.setProperty('--pd-keyboard-h', `${height}px`)
    }
    const show = await Keyboard.addListener('keyboardWillShow', (info) => set(info.keyboardHeight))
    const hide = await Keyboard.addListener('keyboardWillHide', () => set(0))
    cleanup = () => { void show.remove(); void hide.remove(); set(0) }
  }).catch(() => {})
  return () => cleanup()
}
