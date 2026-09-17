import { describe, expect, it } from 'vitest'
import { ICON_GRID, chipLineHeight, layoutChip } from './chipLayout'

const base = { textWidth: 100, fontSize: 32, paddingX: 24, paddingY: 12 }

describe('layoutChip', () => {
  it('sizes a label-only chip from its padding', () => {
    const chip = layoutChip(base)
    expect(chip.width).toBe(100 + 24 * 2)
    expect(chip.height).toBe(chipLineHeight(32) + 12 * 2)
    expect(chip.iconX).toBeNull()
    expect(chip.textX).toBe(24)
  })

  it('adds the icon and gap to the width', () => {
    const chip = layoutChip({ ...base, iconSize: 28, iconGap: 10 })
    expect(chip.width).toBe(100 + 28 + 10 + 24 * 2)
  })

  it('puts a start icon before the label', () => {
    const chip = layoutChip({ ...base, iconSize: 28, iconGap: 10, iconPosition: 'start' })
    expect(chip.iconX).toBe(24)
    expect(chip.textX).toBe(24 + 28 + 10)
  })

  it('puts an end icon after the label', () => {
    const chip = layoutChip({ ...base, iconSize: 28, iconGap: 10, iconPosition: 'end' })
    expect(chip.textX).toBe(24)
    expect(chip.iconX).toBe(24 + 100 + 10)
  })

  it('drops the gap when there is no label to separate from', () => {
    const chip = layoutChip({ ...base, textWidth: 0, iconSize: 28, iconGap: 10 })
    expect(chip.width).toBe(28 + 24 * 2)
  })

  it('grows the pill when the icon is taller than the text', () => {
    const short = layoutChip({ ...base, fontSize: 16, iconSize: 48, iconGap: 8 })
    expect(short.height).toBe(48 + 12 * 2)
  })

  it('centres both pieces on the content band', () => {
    const chip = layoutChip({ ...base, fontSize: 16, iconSize: 48, iconGap: 8 })
    const textCentre = chip.textY + chip.textHeight / 2
    const iconCentre = chip.iconY + 48 / 2
    expect(textCentre).toBeCloseTo(iconCentre, 6)
  })

  it('scales a 24-grid glyph to the requested icon size', () => {
    expect(layoutChip({ ...base, iconSize: 48 }).iconScale).toBe(48 / ICON_GRID)
    expect(layoutChip(base).iconScale).toBe(1)
  })

  it('keeps the pill height independent of the label, so locales match', () => {
    const latin = layoutChip({ ...base, textWidth: 100 })
    const pashto = layoutChip({ ...base, textWidth: 260 })
    expect(pashto.height).toBe(latin.height)
    expect(pashto.width).toBeGreaterThan(latin.width)
  })

  it('treats a zero icon size as no icon at all', () => {
    const chip = layoutChip({ ...base, iconSize: 0, iconGap: 10 })
    expect(chip.iconX).toBeNull()
    expect(chip.width).toBe(100 + 24 * 2)
  })
})
