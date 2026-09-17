import { ImpactStyle } from '@capacitor/haptics'
import { isNativeMobile } from './platform'

/**
 * Touch feedback.
 *
 * The single clearest tell that something is a web page is that pressing a
 * control does nothing you can feel. A native app answers a press in the
 * hand, before the screen has finished changing.
 *
 * Deliberately three levels and no more, so the whole app speaks one
 * vocabulary: a selection tick for choosing among things, a light tap for
 * ordinary buttons, a firmer one for something committed or destructive.
 *
 * Every call is fire-and-forget. Haptics are a courtesy, and a device with
 * the motor disabled, or a browser with no plugin, must never surface an
 * error or block the action it was decorating.
 */

type Feel = 'select' | 'tap' | 'commit'

let plugin: typeof import('@capacitor/haptics').Haptics | null = null
let loading: Promise<void> | null = null

/** Loaded on first use so a browser tab never pulls the plugin in at all. */
async function ensurePlugin(): Promise<void> {
  loading ??= import('@capacitor/haptics').then((module) => { plugin = module.Haptics }).catch(() => {})
  return loading
}

export function haptic(feel: Feel = 'tap'): void {
  if (!isNativeMobile()) return
  void ensurePlugin().then(() => {
    if (!plugin) return
    try {
      if (feel === 'select') return void plugin.selectionChanged()
      return void plugin.impact({ style: feel === 'commit' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {
      // A device with haptics turned off, or a permission we never had.
    }
  })
}
