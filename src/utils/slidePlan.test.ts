import { describe, it, expect, beforeEach } from 'vitest'
import { backgroundFillFor, buildSlideLayers, countWrappedLines, fontsUsedBy, resetSlidePlanIds, type SlidePlan } from './slidePlan'
import type { ChipLayer, GroupLayer, IconLayer, PhoneLayer, ShapeLayer, TextLayer } from '@/types'

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

// ─── The editorial, feature-card layout ─────────────────────────────────────

const editorial = (patch: Partial<SlidePlan> = {}): SlidePlan => plan({
  layout: 'feature-cards',
  displayFont: 'serif',
  cardColor: '#FFFFFF',
  backgroundFrom: '#F3E9D8',
  backgroundTo: '#EADFC8',
  textColor: '#123A2E',
  accentColor: '#C08A2E',
  headlineAccent: 'long evenings',
  blocks: [
    { type: 'eyebrow', text: 'What you get' },
    { type: 'headline', text: 'Built for long evenings' },
    { type: 'feature', title: 'A shelf that stays tidy', text: 'Collections, tags and a search that reaches inside your books.', icon: 'book' },
    { type: 'feature', title: 'Highlights worth keeping', text: 'Mark a passage and find it again months later in two taps.', icon: 'bookmark' },
    { type: 'feature', title: 'Reads without signal', text: 'Download a title once and the whole thing is yours offline.', icon: 'download' },
    { type: 'phone' },
  ],
  ...patch,
})

const cardsOf = (layers: ReturnType<typeof buildSlideLayers>) =>
  layers.filter((l) => l.type === 'group') as GroupLayer[]

describe('the feature-card layout', () => {
  it('builds each card as one group, not as five loose layers', () => {
    const cards = cardsOf(buildSlideLayers(editorial(), CANVAS))
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      // plate + tile + glyph + title + description
      expect(card.children.map((c) => c.type)).toEqual(['shape', 'shape', 'icon', 'text', 'text'])
    }
  })

  it('keeps every part of a card inside its own plate, bottom edge included', () => {
    for (const card of cardsOf(buildSlideLayers(editorial(), CANVAS))) {
      const plate = card.children[0] as ShapeLayer
      for (const child of card.children.slice(1)) {
        expect(child.x, child.name).toBeGreaterThanOrEqual(0)
        expect(child.y, child.name).toBeGreaterThanOrEqual(0)
        // The bottom, not just the origin: a description budgeted for one line
        // and wrapped onto two hangs out of the plate, which is the way this
        // layout actually breaks.
        const box = child.type === 'text'
          ? (child as TextLayer).fontSize * (child as TextLayer).lineHeight
            * countWrappedLines((child as TextLayer).text, (child as TextLayer).fontFamily,
              (child as TextLayer).fontSize, (child as TextLayer).fontWeight, (child as TextLayer).width!)
          : child.type === 'shape' ? (child as ShapeLayer).height
          : (child as IconLayer).size
        const right = child.x + (child.type === 'text' ? (child as TextLayer).width! : child.type === 'shape' ? (child as ShapeLayer).width : (child as IconLayer).size)
        expect(child.y + box, `${child.name} bottom`).toBeLessThanOrEqual(plate.height + 0.5)
        expect(right, `${child.name} right`).toBeLessThanOrEqual(plate.width + 0.5)
      }
    }
  })

  it('names every face it will set copy in, so they can be loaded first', () => {
    // Measuring against a font the browser has not fetched gives the
    // fallback's metrics, and the card comes out the wrong height.
    const fonts = fontsUsedBy(editorial())
    expect(fonts).toContain('Fraunces')
    expect(fonts).toContain('Inter')
    expect(fontsUsedBy(editorial({ displayFont: 'sans' }))).toContain('Sora')
  })

  it('grows a card to fit a description that wraps', () => {
    const short = cardsOf(buildSlideLayers(editorial({ blocks: [
      { type: 'feature', title: 'Short', text: 'One line.', icon: 'book' },
    ] }), CANVAS))[0]
    resetSlidePlanIds()
    const long = cardsOf(buildSlideLayers(editorial({ blocks: [
      { type: 'feature', title: 'Short', text: 'A description long enough that it has to wrap onto several lines before it is done saying what it says.', icon: 'book' },
    ] }), CANVAS))[0]
    expect((long.children[0] as ShapeLayer).height)
      .toBeGreaterThan((short.children[0] as ShapeLayer).height)
  })

  it('stacks the cards without overlapping each other', () => {
    const cards = cardsOf(buildSlideLayers(editorial(), CANVAS))
    for (let i = 1; i < cards.length; i++) {
      const previousBottom = cards[i - 1].y + (cards[i - 1].children[0] as ShapeLayer).height
      expect(cards[i].y, `card ${i}`).toBeGreaterThanOrEqual(previousBottom)
    }
  })

  it('crops the device on the bottom edge, but leaves it visible', () => {
    const layers = buildSlideLayers(editorial(), CANVAS)
    const phone = layers.find((l) => l.type === 'phone') as PhoneLayer
    const cards = cardsOf(layers)
    const lastCardBottom = cards.at(-1)!.y + (cards.at(-1)!.children[0] as ShapeLayer).height
    // Below the copy, and starting before the bottom edge so it is actually seen.
    expect(phone.y).toBeGreaterThanOrEqual(lastCardBottom)
    expect(phone.y).toBeLessThan(CANVAS.height)
  })

  it('colours a card’s copy from the plate it sits on, not from the slide', () => {
    // A white card on a slide whose text colour is white would otherwise come
    // back blank — the one failure that makes a generated slide unusable.
    const onLight = cardsOf(buildSlideLayers(editorial({ cardColor: '#FFFFFF', textColor: '#FFFFFF' }), CANVAS))[0]
    resetSlidePlanIds()
    const onDark = cardsOf(buildSlideLayers(editorial({ cardColor: '#14131C', textColor: '#14131C' }), CANVAS))[0]
    expect((onLight.children[3] as TextLayer).fill).toBe('#14131C')
    expect((onDark.children[3] as TextLayer).fill).toBe('#FFFFFF')
  })

  it('paints the headline two-tone when the accent is really in it', () => {
    const headline = buildSlideLayers(editorial(), CANVAS)
      .find((l) => l.name === 'Headline') as TextLayer
    expect(headline.marks).toHaveLength(1)
    expect(headline.text.slice(headline.marks![0].start, headline.marks![0].end)).toBe('long evenings')
    expect(headline.marks![0].fill).toBe('#C08A2E')
  })

  it('leaves the headline one colour when the accent is not in it word for word', () => {
    const headline = buildSlideLayers(editorial({ headlineAccent: 'quiet nights' }), CANVAS)
      .find((l) => l.name === 'Headline') as TextLayer
    expect(headline.marks).toBeUndefined()
  })

  it('sets the copy flush to the margin, the way an editorial page is set', () => {
    const headline = buildSlideLayers(editorial(), CANVAS).find((l) => l.name === 'Headline') as TextLayer
    expect(headline.align).toBe('left')
    const centred = buildSlideLayers(plan(), CANVAS).find((l) => l.name === 'Headline') as TextLayer
    expect(centred.align).toBe('center')
  })

  it('drops the icon tile from a card whose glyph the library does not have', () => {
    const card = cardsOf(buildSlideLayers(editorial({ blocks: [
      { type: 'feature', title: 'Still a card', text: 'With no tile.', icon: 'unicorn' },
    ] }), CANVAS))[0]
    expect(card.children.map((c) => c.type)).toEqual(['shape', 'text', 'text'])
  })
})

describe('Pashto and Persian copy', () => {
  const pashto = (patch: Partial<SlidePlan> = {}) => editorial({
    headlineAccent: undefined,
    blocks: [
      { type: 'eyebrow', text: 'څه ترلاسه کوې' },
      { type: 'headline', text: 'د اوږدو ماښامونو لپاره جوړ شوی' },
      { type: 'feature', title: 'کتابتون چې سم پاتې کیږي', text: 'ټولګې، ټګونه او لټون چې ستاسو کتابونو ته ننوځي.', icon: 'book' },
      { type: 'phone' },
    ],
    ...patch,
  })

  it('sets Arabic-script copy in a face that actually has its letters', () => {
    // A headline in Sora has no Pashto glyphs at all and falls back to whatever
    // the system happens to have — the exact mismatched look this must avoid.
    const layers = buildSlideLayers(pashto(), CANVAS)
    const headline = layers.find((l) => l.name === 'Headline') as TextLayer
    expect(headline.fontFamily).toBe('Noto Naskh Arabic')
    const card = cardsOf(layers)[0]
    expect((card.children[3] as TextLayer).fontFamily).toBe('Vazirmatn')
  })

  it('never tracks out Arabic letters, which would break their joins', () => {
    const layers = buildSlideLayers(pashto(), CANVAS)
    for (const layer of layers) {
      if (layer.type === 'text') expect((layer as TextLayer).letterSpacing, layer.name).toBe(0)
    }
  })

  it('leaves an Arabic eyebrow in its own case, having none to change', () => {
    const eyebrow = buildSlideLayers(pashto(), CANVAS).find((l) => l.name === 'Eyebrow') as TextLayer
    expect(eyebrow.text).toBe('څه ترلاسه کوې')
    const latin = buildSlideLayers(editorial(), CANVAS).find((l) => l.name === 'Eyebrow') as TextLayer
    expect(latin.text).toBe('WHAT YOU GET')
  })

  it('mirrors a card so the tile is on the reading side', () => {
    const pashtoCard = cardsOf(buildSlideLayers(pashto(), CANVAS))[0]
    const plate = pashtoCard.children[0] as ShapeLayer
    const tile = pashtoCard.children[1] as ShapeLayer
    const title = pashtoCard.children[3] as TextLayer
    expect(tile.x).toBeGreaterThan(plate.width / 2)
    expect(title.align).toBe('right')

    resetSlidePlanIds()
    const latinCard = cardsOf(buildSlideLayers(editorial(), CANVAS))[0]
    expect((latinCard.children[1] as ShapeLayer).x).toBeLessThan(plate.width / 2)
    expect((latinCard.children[3] as TextLayer).align).toBe('left')
  })
})
