// @vitest-environment jsdom
// The fetch path parses real SVG markup with DOMParser, so this one file
// needs a DOM; the rest of the suite stays on the faster node environment.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MATERIAL_SYMBOL_NAMES } from '@/assets/icons/materialSymbolNames'
import {
  DEFAULT_VARIANT, SYMBOL_STYLES, SYMBOL_WEIGHTS,
  fetchMaterialSymbol, loadSymbolNames, parseViewBox, searchMaterialSymbols,
  symbolUrl, variantSegment,
} from './materialSymbols'

const SAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">'
  + '<path d="M480-120 120-480l360-360 360 360-360 360Z"/></svg>'

afterEach(() => { vi.unstubAllGlobals() })

describe('the bundled catalogue', () => {
  it('covers the whole of fonts.google.com/icons, not a hand-picked subset', () => {
    // The point of the generator: a search box over 159 names looked broken.
    expect(MATERIAL_SYMBOL_NAMES.length).toBeGreaterThan(4000)
  })

  it('has no duplicates and uses the endpoint’s own naming', () => {
    expect(new Set(MATERIAL_SYMBOL_NAMES).size).toBe(MATERIAL_SYMBOL_NAMES.length)
    for (const name of MATERIAL_SYMBOL_NAMES) expect(name).toMatch(/^[a-z0-9_]+$/)
  })

  it('is sorted, so a regeneration diffs to just the new icons', () => {
    expect([...MATERIAL_SYMBOL_NAMES]).toEqual([...MATERIAL_SYMBOL_NAMES].sort())
  })

  it('loads lazily and caches the module', async () => {
    const first = await loadSymbolNames()
    expect(await loadSymbolNames()).toBe(first)
    expect(first.length).toBe(MATERIAL_SYMBOL_NAMES.length)
  })
})

describe('variants', () => {
  it('names weight 400 unfilled "default"', () => {
    expect(variantSegment(DEFAULT_VARIANT)).toBe('default')
  })

  it('composes weight before fill, which is the order the endpoint expects', () => {
    expect(variantSegment({ style: 'outlined', filled: true, weight: 400 })).toBe('fill1')
    expect(variantSegment({ style: 'sharp', filled: false, weight: 700 })).toBe('wght700')
    expect(variantSegment({ style: 'rounded', filled: true, weight: 200 })).toBe('wght200fill1')
  })

  it('builds a URL per style', () => {
    for (const style of SYMBOL_STYLES) {
      expect(symbolUrl('rocket_launch', { style, filled: false, weight: 400 }))
        .toBe(`https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${style}/rocket_launch/default/24px.svg`)
    }
  })

  it('offers the three styles and seven weights Google draws', () => {
    expect(SYMBOL_STYLES).toEqual(['outlined', 'rounded', 'sharp'])
    expect(SYMBOL_WEIGHTS).toEqual([100, 200, 300, 400, 500, 600, 700])
  })
})

describe('searchMaterialSymbols', () => {
  const names = ['car', 'car_rental', 'scorecard', 'rocket_launch', 'shopping_cart']

  it('returns everything, capped, for an empty query', () => {
    expect(searchMaterialSymbols('', names)).toEqual(names)
    expect(searchMaterialSymbols('', names, 2)).toHaveLength(2)
  })

  it('ranks an exact name, then a word start, then a match inside a word', () => {
    // 'cart' begins a word, so shopping_cart outranks scorecard, where 'car'
    // is buried mid-word; the shorter of two equal scores wins.
    expect(searchMaterialSymbols('car', names))
      .toEqual(['car', 'car_rental', 'shopping_cart', 'scorecard'])
  })

  it('reads underscores as spaces, so a typed phrase finds the symbol', () => {
    expect(searchMaterialSymbols('rocket launch', names)).toEqual(['rocket_launch'])
    expect(searchMaterialSymbols('rocket_launch', names)).toEqual(['rocket_launch'])
  })

  it('requires every term to match, not just one', () => {
    expect(searchMaterialSymbols('shopping cart', names)).toEqual(['shopping_cart'])
  })

  it('returns nothing rather than everything when no symbol matches', () => {
    expect(searchMaterialSymbols('definitely-not-an-icon', names)).toEqual([])
  })

  it('searches the real catalogue', () => {
    const hits = searchMaterialSymbols('rocket', MATERIAL_SYMBOL_NAMES)
    expect(hits).toContain('rocket_launch')
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

  it('requests the chosen variant', async () => {
    const spy = vi.fn(async (url: string) => { void url; return new Response(SAMPLE, { status: 200 }) })
    vi.stubGlobal('fetch', spy)
    await fetchMaterialSymbol('variant_probe', { style: 'rounded', filled: true, weight: 700 })
    expect(spy.mock.calls[0][0]).toContain('materialsymbolsrounded/variant_probe/wght700fill1/')
  })

  it('caches per variant, so switching style refetches but re-picking does not', async () => {
    const spy = vi.fn(async () => new Response(SAMPLE, { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await fetchMaterialSymbol('cache_probe', { style: 'outlined', filled: false, weight: 400 })
    await fetchMaterialSymbol('cache_probe', { style: 'outlined', filled: false, weight: 400 })
    expect(spy).toHaveBeenCalledTimes(1)
    await fetchMaterialSymbol('cache_probe', { style: 'sharp', filled: false, weight: 400 })
    expect(spy).toHaveBeenCalledTimes(2)
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
