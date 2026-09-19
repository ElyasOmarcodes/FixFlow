import { describe, it, expect, beforeEach } from 'vitest'
import { backgroundFillFor, buildSlideLayers, countWrappedLines, resetSlidePlanIds, type SlidePlan } from './slidePlan'
import type { ChipLayer, IconLayer, PhoneLayer, TextLayer } from '@/types'

const CANVAS = { width: 1290, height: 2796 }

const plan = (patch: Partial<SlidePlan> = {}): SlidePlan => ({
  backgroundFrom: '#101020',
  backgroundTo: '#2A1A5E',
  textColor: '#FFFFFF',
  accentColor: '#7C6EF6',
  layout: 'text-above-device',
  blocks: [
    { type: 'chip', text: 'New', icon: 'star' },
    { type: 'headline', text: 'Track every habit' },
    { type: 'subhead', text: 'One tap a day is all it takes' },
    { type: 'phone' },
  ],
  ...patch,
})

beforeEach(() => resetSlidePlanIds())

describe('buildSlideLayers', () => {
  it('builds one layer per block, in reading order', () => {
    const layers = buildSlideLayers(plan(), CANVAS)
    expect(layers.map((l) => l.type)).toEqual(['phone', 'chip', 'text', 'text'])
  })

  it('keeps every layer inside the canvas', () => {
    for (const layout of ['text-above-device', 'text-below-device', 'text-only'] as const) {
      const layers = buildSlideLayers(plan({ layout }), CANVAS)
      for (const layer of layers) {
        expect(layer.x, `${layout} ${layer.name} x`).toBeGreaterThanOrEqual(0)
        expect(layer.y, `${layout} ${layer.name} y`).toBeGreaterThanOrEqual(0)
        expect(layer.y, `${layout} ${layer.name} below the fold`).toBeLessThan(CANVAS.height)
      }
    }
  })

  it('never lets the copy land on the device', () => {
    const layers = buildSlideLayers(plan(), CANVAS)
    const phone = layers.find((l) => l.type === 'phone') as PhoneLayer
    const texts = layers.filter((l) => l.type === 'text') as TextLayer[]
    // Text is above the device in this layout, so every line of it ends before
    // the frame begins. This is the assertion that a wrong line-height budget
    // breaks, which is the whole reason the copy is measured before placing.
    for (const text of texts) {
      const bottom = text.y + text.fontSize * text.lineHeight
        * countWrappedLines(text.text, text.fontFamily, text.fontSize, text.fontWeight, text.width!)
      expect(bottom, text.name).toBeLessThanOrEqual(phone.y)
    }
  })

  it('gives the device the room the copy leaves, not the other way round', () => {
    const short = buildSlideLayers(plan({ blocks: [
      { type: 'headline', text: 'Short' }, { type: 'phone' },
    ] }), CANVAS)
    resetSlidePlanIds()
    const long = buildSlideLayers(plan({ blocks: [
      { type: 'headline', text: 'A headline long enough that it has to wrap onto several lines of its own' },
      { type: 'subhead', text: 'And a supporting line underneath it that also runs on for a while' },
      { type: 'body', text: 'Then a paragraph of body copy that keeps going, and going, and going, until there is very little canvas left for anything else to sit in at all.' },
      { type: 'phone' },
    ] }), CANVAS)
    const shortPhone = short.find((l) => l.type === 'phone') as PhoneLayer
    const longPhone = long.find((l) => l.type === 'phone') as PhoneLayer
    // A slide crowded with copy gets a smaller device, rather than a device
    // with the words printed across it.
    expect(longPhone.scale).toBeLessThan(shortPhone.scale)
  })

  it('centres the chip and the icon on the canvas', () => {
    const layers = buildSlideLayers(plan({ blocks: [
      { type: 'chip', text: 'New', icon: 'star' },
      { type: 'icon', icon: 'heart' },
    ] }), CANVAS)
    const icon = layers.find((l) => l.type === 'icon') as IconLayer
    expect(icon.x + icon.size / 2).toBeCloseTo(CANVAS.width / 2, 5)
  })

  it('drops an icon name the bundled library does not have', () => {
    const layers = buildSlideLayers(plan({ blocks: [
      { type: 'chip', text: 'New', icon: 'not-a-real-glyph' },
    ] }), CANVAS)
    expect((layers[0] as ChipLayer).icon).toBeUndefined()
  })

  it('keeps at most one of each text role, whatever order they arrive in', () => {
    const layers = buildSlideLayers(plan({ blocks: [
      { type: 'subhead', text: 'second' },
      { type: 'headline', text: 'first' },
      { type: 'headline', text: 'a duplicate headline' },
    ] }), CANVAS)
    const texts = layers.filter((l) => l.type === 'text') as TextLayer[]
    expect(texts.map((t) => t.text)).toEqual(['first', 'second'])
  })

  it('leaves the device out when the layout asks for text only', () => {
    const layers = buildSlideLayers(plan({ layout: 'text-only' }), CANVAS)
    expect(layers.some((l) => l.type === 'phone')).toBe(false)
  })

  it('scales with the canvas rather than hard-coding phone pixels', () => {
    const phone = buildSlideLayers(plan(), CANVAS)
    resetSlidePlanIds()
    const tablet = buildSlideLayers(plan(), { width: 2048, height: 2732 })
    const headlineOn = (layers: ReturnType<typeof buildSlideLayers>) =>
      (layers.find((l) => l.name === 'Headline') as TextLayer).fontSize
    expect(headlineOn(tablet)).toBeGreaterThan(headlineOn(phone))
  })
})

describe('backgroundFillFor', () => {
  it('falls back when the model sends something that is not a hex colour', () => {
    const fill = backgroundFillFor(plan({ backgroundFrom: 'midnight blue', backgroundTo: '' }))
    expect(fill.stops[0].color).toBe('#12101E')
    expect(fill.stops[1].color).toBe('#1A1240')
  })

  it('uses the colours when they are valid', () => {
    const fill = backgroundFillFor(plan())
    expect(fill.stops.map((s) => s.color)).toEqual(['#101020', '#2A1A5E'])
  })
})

describe('countWrappedLines', () => {
  it('counts a line per paragraph at minimum', () => {
    expect(countWrappedLines('one\ntwo\nthree', 'Inter', 40, 400, 10000)).toBe(3)
    expect(countWrappedLines('', 'Inter', 40, 400, 1000)).toBe(1)
  })

  it('wraps when the words no longer fit', () => {
    const wide = countWrappedLines('one two three four five six', 'Inter', 40, 400, 100000)
    const narrow = countWrappedLines('one two three four five six', 'Inter', 40, 400, 60)
    expect(wide).toBe(1)
    expect(narrow).toBeGreaterThan(wide)
  })
})
