/** Set PNG pHYs metadata without resampling or changing pixel dimensions. */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.length < 33 || bytes[0] !== 137 || bytes[1] !== 80) throw new Error('Invalid PNG')
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([112, 72, 89, 115], 4)
  const density = Math.round(Math.min(1200, Math.max(1, dpi)) / 0.0254)
  view.setUint32(8, density); view.setUint32(12, density); chunk[16] = 1
  let crc = 0xffffffff
  for (const byte of chunk.slice(4, 17)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0)
  const parts: BlobPart[] = [bytes.slice(0, 33), chunk]
  for (let offset = 33; offset + 12 <= bytes.length;) {
    const length = new DataView(bytes.buffer).getUint32(offset) + 12
    if (offset + length > bytes.length) throw new Error('Invalid PNG chunk')
    if (!(bytes[offset + 4] === 112 && bytes[offset + 5] === 72 && bytes[offset + 6] === 89 && bytes[offset + 7] === 115)) parts.push(bytes.slice(offset, offset + length))
    offset += length
  }
  return new Blob(parts, { type: 'image/png' })
}
