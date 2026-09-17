// @vitest-environment jsdom
// The fetch path parses real SVG markup with DOMParser, so this one file
// needs a DOM; the rest of the suite stays on the faster node environment.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  MATERIAL_SYMBOL_NAMES, fetchMaterialSymbol, parseViewBox, searchMaterialSymbols,
} from './materialSymbols'

const SAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">'
  + '<path d="M480-120 120-480l360-360 360 360-360 360Z"/></svg>'

afterEach(() => { vi.unstubAllGlobals() })

describe('MATERIAL_SYMBOL_NAMES', () => {
  it('has no duplicates', () => {
    expect(new Set(MATERIAL_SYMBOL_NAMES).size).toBe(MATERIAL_SYMBOL_NAMES.length)
  })

  it('uses the endpoint’s own naming — lowercase with underscores', () => {
    for (const name of MATERIAL_SYMBOL_NAMES) expect(name).toMatch(/^[a-z0-9_]+$/)
  })
})

describe('searchMaterialSymbols', () => {
  it('returns everything for an empty query', () => {
    expect(searchMaterialSymbols('')).toHaveLength(MATERIAL_SYMBOL_NAMES.length)
  })

  it('reads underscores as spaces, so a typed phrase finds the symbol', () => {
    expect(searchMaterialSymbols('rocket launch')).toContain('rocket_launch')
    expect(searchMaterialSymbols('rocket_launch')).toContain('rocket_launch')
  })

  it('requires every term to match, not just one', () => {
    expect(searchMaterialSymbols('shopping cart')).toEqual(['shopping_cart'])
  })

  it('returns nothing rather than everything when no symbol matches', () => {
    expect(searchMaterialSymbols('definitely-not-an-icon')).toEqual([])
  })
})

describe('parseViewBox', () => {
  it('reads Material’s own box, whose origin is negative', () => {
    expect(parseViewBox('0 -960 960 960')).toEqual([0, -960, 960, 960])
  })

  it('accepts a comma-separated box', () => {
    expect(parseViewBox('0,0,48,48')).toEqual([0, 0, 48, 48])
  })

  it('falls back to the 24-grid for anything unusable', () => {
    // A malformed box must not produce a zero or NaN scale on the canvas.
    for (const input of [undefined, '', 'not a box', '0 0 0 24', '0 0 24']) {
      expect(parseViewBox(input)).toEqual([0, 0, 24, 24])
    }
  })
})

describe('fetchMaterialSymbol', () => {
  it('keeps the path and the symbol’s own viewBox', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SAMPLE, { status: 200 })))
    const symbol = await fetchMaterialSymbol('diamond')
    expect(symbol.d).toBe('M480-120 120-480l360-360 360 360-360 360Z')
    expect(symbol.viewBox).toBe('0 -960 960 960')
    expect(symbol.filled).toBe(true)
  })

  it('caches, so re-picking a symbol never refetches', async () => {
    const spy = vi.fn(async () => new Response(SAMPLE, { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await fetchMaterialSymbol('cached_once')
    await fetchMaterialSymbol('cached_once')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('concatenates multiple paths into one subpathed `d`', async () => {
    const twoPaths = '<svg viewBox="0 -960 960 960"><path d="M0 0h10"/><path d="M20 20h10"/></svg>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(twoPaths, { status: 200 })))
    const symbol = await fetchMaterialSymbol('two_paths')
    expect(symbol.d).toBe('M0 0h10 M20 20h10')
  })

  it('throws on a non-OK response rather than returning an empty glyph', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(fetchMaterialSymbol('missing_symbol')).rejects.toThrow('404')
  })

  it('throws when the response carries no path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg viewBox="0 0 24 24"></svg>', { status: 200 })))
    await expect(fetchMaterialSymbol('empty_symbol')).rejects.toThrow('no path data')
  })
})
