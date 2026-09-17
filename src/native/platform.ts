import { Capacitor } from '@capacitor/core'

/**
 * What kind of shell the app is running in.
 *
 * Every native call in this folder goes through these, because the same
 * bundle runs in a browser tab, in a Tauri window and in an Android WebView,
 * and a plugin that is not there must be a no-op rather than a thrown error.
 */

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/** A phone or tablet shell — the one with hardware buttons and haptics. */
export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform()
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Anything but a browser tab. */
export function isNativeShell(): boolean {
  return isNativeMobile() || isTauriDesktop()
}
