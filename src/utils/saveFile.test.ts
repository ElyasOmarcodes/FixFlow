import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(), platform: vi.fn(), native: vi.fn(), save: vi.fn(), write: vi.fn(), androidSave: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }))
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: mocks.write }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.platform, isNativePlatform: mocks.native },
  registerPlugin: () => ({ save: mocks.androidSave }),
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
