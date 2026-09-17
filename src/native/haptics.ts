import { ImpactStyle } from '@capacitor/haptics'
import { isNativeMobile } from './platform'

/**
 * Touch feedback, for a long press and nothing else.
 *
 * It used to fire on every press in the app, which is wrong: a phone that
 * buzzes each time you touch a button is not more native, it is exhausting,
 * and none of the platforms do it. A long press is different — it is a
 * gesture with no visual start, so the buzz is the only signal that the
 * press was recognised before the menu appears. That is the one case.
 *
 * Fire-and-forget: haptics are a courtesy, and a device with the motor
 * disabled, or a browser with no plugin, must never surface an error or
 * block the gesture it was confirming.
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
