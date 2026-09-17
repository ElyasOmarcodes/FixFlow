import { describe, expect, it } from 'vitest'
import { ICON_CATEGORIES, ICON_LIBRARY, getIconGlyph, searchIcons } from './library'

/**
 * These guard the data, not the rendering: a glyph that is off-grid or has a
 * malformed `d` looks fine in a list and wrong at export size, where it is a
 * thousand pixels tall.
 */

/** Every coordinate pair a path command carries. */
function coordinates(d: string): number[] {
  return (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
}

describe('icon library', () => {
  it('ships a substantial, uniquely named set', () => {
    expect(ICON_LIBRARY.length).toBeGreaterThanOrEqual(150)
    const names = ICON_LIBRARY.map((glyph) => glyph.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('names every glyph in kebab case, so ids stay stable and searchable', () => {
    for (const glyph of ICON_LIBRARY) {
      expect(glyph.name, glyph.name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    }
  })

  it('files every glyph under a declared category', () => {
    for (const glyph of ICON_LIBRARY) {
      expect(ICON_CATEGORIES, glyph.name).toContain(glyph.category)
    }
  })

  it('fills every category — an empty tab in the picker is a dead end', () => {
    for (const category of ICON_CATEGORIES) {
      expect(ICON_LIBRARY.filter((glyph) => glyph.category === category).length, category)
        .toBeGreaterThan(0)
    }
  })

  it('starts every path with a move command', () => {
    for (const glyph of ICON_LIBRARY) {
      expect(glyph.d.trimStart()[0], glyph.name).toMatch(/[Mm]/)
    }
  })

  it('uses only SVG path commands', () => {
    for (const glyph of ICON_LIBRARY) {
      const letters = glyph.d.match(/[A-Za-z]/g) ?? []
      for (const letter of letters) {
        expect('MmLlHhVvCcSsQqTtAaZz', `${glyph.name} uses "${letter}"`).toContain(letter)
      }
    }
  })

  it('keeps every glyph on the 24x24 grid', () => {
    for (const glyph of ICON_LIBRARY) {
      const values = coordinates(glyph.d)
      expect(values.length, glyph.name).toBeGreaterThan(1)
      // Relative commands and arc flags make a strict bound wrong, so this only
      // catches the real failure mode: a coordinate off by an order of magnitude.
      for (const value of values) {
        expect(Math.abs(value), `${glyph.name} has ${value}`).toBeLessThanOrEqual(30)
      }
    }
  })

  it('spans the grid rather than collapsing into a dot', () => {
    for (const glyph of ICON_LIBRARY) {
      // Every number in the path, not just absolute move/line pairs: most
      // glyphs draw their body with relative arcs, so counting only M/L would
      // flag perfectly good icons (a rounded envelope has exactly two Ms).
      // Radii and arc flags are in here too, which is fine — the only thing
      // this has to catch is a glyph whose geometry never leaves one corner.
      const values = coordinates(glyph.d)
      expect(Math.max(...values) - Math.min(...values), glyph.name).toBeGreaterThan(4)
    }
  })

  it('looks a glyph up by name', () => {
    expect(getIconGlyph('heart')?.category).toBe('interface')
    expect(getIconGlyph('not-a-real-icon')).toBeUndefined()
  })
})

describe('searchIcons', () => {
  it('returns everything for an empty query', () => {
    expect(searchIcons('')).toHaveLength(ICON_LIBRARY.length)
  })

  it('matches a name', () => {
    expect(searchIcons('heart').map((g) => g.name)).toContain('heart')
  })

  it('matches a keyword the name does not contain', () => {
    expect(searchIcons('checkout').map((g) => g.name)).toContain('credit-card')
    expect(searchIcons('password').map((g) => g.name)).toContain('lock')
  })

  it('treats a hyphen as a space, so "map pin" finds map-pin', () => {
    expect(searchIcons('map pin').map((g) => g.name)).toContain('map-pin')
  })

  it('narrows as terms are added rather than widening', () => {
    const one = searchIcons('cloud')
    const two = searchIcons('cloud sync')
    expect(two.length).toBeLessThanOrEqual(one.length)
    expect(two.map((g) => g.name)).toContain('cloud-sync')
  })

  it('scopes to a category', () => {
    const found = searchIcons('', 'finance')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((glyph) => glyph.category === 'finance')).toBe(true)
  })

  it('returns nothing for a term no glyph carries', () => {
    expect(searchIcons('zzzznotathing')).toHaveLength(0)
  })
})
