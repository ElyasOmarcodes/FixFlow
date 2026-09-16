import { expect, it } from 'vitest'
import { pngWithDpi } from './pngDensity'
it('writes and replaces density metadata without changing IHDR dimensions or image bytes', async () => {
  const source = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7X8AAAAASUVORK5CYII=', 'base64'))
  const first = await pngWithDpi(new Blob([source]), 300)
  const second = new Uint8Array(await (await pngWithDpi(first, 150)).arrayBuffer())
  expect(second.length).toBe(source.length + 21)
  expect(second.slice(0, 33)).toEqual(source.slice(0, 33))
  expect(new DataView(second.buffer).getUint32(41)).toBe(Math.round(150 / 0.0254))
  expect(second.slice(54)).toEqual(source.slice(33))
})
