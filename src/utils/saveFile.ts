import { Capacitor, registerPlugin } from '@capacitor/core'
import { isTauri } from '@tauri-apps/api/core'

const NativeFile = registerPlugin<{
  begin(): Promise<{ session: string }>
  append(options: { session: string; data: string }): Promise<void>
  finish(options: { session: string; filename: string; mimeType: string }): Promise<{ cancelled: boolean }>
  cancel(options: { session: string }): Promise<void>
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
    const { session } = await NativeFile.begin()
    try {
      // Bound bridge messages and decoding memory, even for large ZIP archives.
      const chunkSize = 128 * 1024
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob.slice(offset, offset + chunkSize))
        })
        await NativeFile.append({ session, data })
      }
      const result = await NativeFile.finish({ session, filename, mimeType: blob.type || 'application/octet-stream' })
      if (result.cancelled) throw new DOMException('Save cancelled', 'AbortError')
    } catch (error) {
      await NativeFile.cancel({ session }).catch(() => undefined)
      throw error
    }
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
