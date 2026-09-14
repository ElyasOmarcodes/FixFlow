import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(), platform: vi.fn(), native: vi.fn(), save: vi.fn(), write: vi.fn(), androidSave: vi.fn(), begin: vi.fn(), append: vi.fn(), cancel: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }))
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: mocks.write }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.platform, isNativePlatform: mocks.native },
  registerPlugin: () => ({ finish: mocks.androidSave, begin: mocks.begin, append: mocks.append, cancel: mocks.cancel }),
}))
import { saveFile } from './saveFile'

beforeEach(() => { vi.resetAllMocks(); mocks.platform.mockReturnValue('web') })
describe('native export saves', () => {
  it('writes exact binary bytes to the user-selected Windows path', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.save.mockResolvedValue('C:\\Users\\test\\export.zip')
    const bytes = new Uint8Array([0, 255, 80, 75, 128])
    await saveFile(new Blob([bytes], { type: 'application/zip' }), 'export.zip')
    expect(mocks.save).toHaveBeenCalledWith({ defaultPath: 'export.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }] })
    expect(mocks.write).toHaveBeenCalledWith('C:\\Users\\test\\export.zip', bytes)
  })
  it('does not write when the picker is cancelled', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.save.mockResolvedValue(null)
    await expect(saveFile(new Blob(['a']), 'a.png')).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('propagates permission and disk errors instead of reporting success', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.save.mockResolvedValue('C:\\export.png')
    mocks.write.mockRejectedValue(new Error('Access denied'))
    await expect(saveFile(new Blob(['a']), 'a.png')).rejects.toThrow('Access denied')
  })
})


describe('Android chunked exports', () => {
  beforeEach(() => {
    mocks.platform.mockReturnValue('android')
    mocks.begin.mockResolvedValue({ session: 'test-session' })
    mocks.androidSave.mockResolvedValue({ cancelled: false })
    mocks.cancel.mockResolvedValue(undefined)
    vi.stubGlobal('FileReader', class {
      result = ''
      onload = () => {}
      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then((buffer) => {
          this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`
          this.onload()
        })
      }
    })
  })
  it('transfers exact binary data in bounded sequential chunks', async () => {
    const bytes = Uint8Array.from({ length: 400000 }, (_, index) => index % 256)
    await saveFile(new Blob([bytes], { type: 'application/zip' }), 'design.zip')
    const chunks = mocks.append.mock.calls.map(([value]) => {
      expect(value.session).toBe('test-session')
      expect(value.data.length).toBeLessThan(180000)
      return Buffer.from(value.data, 'base64')
    })
    expect(chunks).toHaveLength(4)
    expect(Buffer.concat(chunks).equals(Buffer.from(bytes))).toBe(true)
    expect(mocks.androidSave).toHaveBeenCalledWith({ session: 'test-session', filename: 'design.zip', mimeType: 'application/zip' })
  })
  it('cleans up partial files after a failed transfer', async () => {
    mocks.append.mockRejectedValue(new Error('Disk full'))
    await expect(saveFile(new Blob(['test']), 'a.png')).rejects.toThrow('Disk full')
    expect(mocks.cancel).toHaveBeenCalledWith({ session: 'test-session' })
    expect(mocks.androidSave).not.toHaveBeenCalled()
  })
  it('reports picker cancellation without claiming success', async () => {
    mocks.androidSave.mockResolvedValue({ cancelled: true })
    await expect(saveFile(new Blob(['test']), 'a.png')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
