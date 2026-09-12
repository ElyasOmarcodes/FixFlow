import { Capacitor, registerPlugin } from '@capacitor/core'
import { isTauri } from '@tauri-apps/api/core'

const NativeFile = registerPlugin<{
  save(options: { filename: string; mimeType: string; data: string }): Promise<{ cancelled: boolean }>
}>('PixelDeckFile')

export function isNativeApp(): boolean {
  return isTauri() || Capacitor.isNativePlatform()
}

export function isSaveCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** Resolve only after native writes complete; cancellation never reports success. */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs'),
    ])
    const extension = filename.split('.').pop() || 'png'
    const path = await save({ defaultPath: filename, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] })
    if (!path) throw new DOMException('Save cancelled', 'AbortError')
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    return
  }
  if (Capacitor.getPlatform() === 'android') {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const result = await NativeFile.save({ filename, mimeType: blob.type || 'application/octet-stream', data })
    if (result.cancelled) throw new DOMException('Save cancelled', 'AbortError')
    return
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
