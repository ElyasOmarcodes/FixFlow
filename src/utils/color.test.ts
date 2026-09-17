import { describe, it, expect } from 'vitest'
import { hexToHsv, hsvToHex, normalizeHex, prefersDarkInk, rgbToHex } from './color'

describe('normalizeHex', () => {
  it('accepts the forms a person actually pastes in', () => {
    expect(normalizeHex('#7c6ef6')).toBe('#7C6EF6')
    expect(normalizeHex('7c6ef6')).toBe('#7C6EF6')
    expect(normalizeHex('#abc')).toBe('#AABBCC')
    expect(normalizeHex('rgb(124, 110, 246)')).toBe('#7C6EF6')
    expect(normalizeHex('rgba(124, 110, 246, 0.5)')).toBe('#7C6EF6')
  })

  it('drops the alpha of an 8-digit hex rather than mangling the colour', () => {
    expect(normalizeHex('#7C6EF680')).toBe('#7C6EF6')
  })

  it('keeps the fallback instead of turning a typo into black', () => {
    expect(normalizeHex('not a colour', '#123456')).toBe('#123456')
    expect(normalizeHex('', '#123456')).toBe('#123456')
  })
})

describe('hsv round trip', () => {
  it('returns the same hex it was given', () => {
    // Greys, primaries and an arbitrary colour: the grey cases are where a
    // naive conversion loses the hue and the handle jumps on the next drag.
    for (const hex of ['#000000', '#FFFFFF', '#808080', '#FF0000', '#00FF00', '#0000FF', '#7C6EF6', '#F9D423']) {
      expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex)
    }
  })

  it('keeps hue and saturation while value goes to zero', () => {
    const hsv = hexToHsv('#7C6EF6')
    expect(hsvToHex({ ...hsv, v: 0 })).toBe('#000000')
    // Coming back up returns the same colour — the picker never forgets where
    // the handle was just because the person dragged it to black.
    expect(hsvToHex({ ...hsv, v: hexToHsv('#7C6EF6').v })).toBe('#7C6EF6')
  })
})

describe('rgbToHex', () => {
  it('clamps rather than wrapping', () => {
    expect(rgbToHex({ r: 300, g: -20, b: 128 })).toBe('#FF0080')
  })
})

describe('prefersDarkInk', () => {
  it('picks the ink a tick on the swatch would actually be readable in', () => {
    expect(prefersDarkInk('#FFFFFF')).toBe(true)
    expect(prefersDarkInk('#FFFDE7')).toBe(true)
    expect(prefersDarkInk('#000000')).toBe(false)
    expect(prefersDarkInk('#7C6EF6')).toBe(false)
  })
})
