import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Author the three editorial templates.
 *
 * They were previously two layouts alternating over seven slides: the same
 * bones, flat single-colour backgrounds, one font at weight 700 for headline
 * and body alike, and no panorama. A store listing is a sequence — the reader
 * swipes through it — so this builds a real arc instead: hero, a panorama that
 * crosses the seam, a feature list, a showcase, a detail slide and a close.
 *
 * Generated rather than hand-written because the three share a layout system
 * and differ only in palette and copy; keeping that in one place is what stops
 * them drifting apart again. Run `node scripts/build-editorial-templates.mjs`
 * after editing, then regenerate the manifest.
 */

const W = 1320
const H = 2868
const M = 96           // page margin
const COL = W - M * 2  // text column

const PHONE_W = 390    // iphone-16-pro frame, before scale
const PHONE_H = 844

/** Left edge that centres a phone of this scale on `centreX`. */
const phoneX = (scale, centreX = W / 2) => Math.round(centreX - (PHONE_W * scale) / 2)

// ─── Layer builders ──────────────────────────────────────────────────────────

const base = (id, name, type, x, y, extra = {}) => ({
  id, name, type, x, y,
  rotation: 0, opacity: 1, visible: true, locked: false,
  ...extra,
})

const background = (id, fill, accents, extra = {}) => ({
  ...base(id, 'Background', 'background', 0, 0, { fill, accents, noise: 0.03, ...extra }),
  locked: true,
})

const text = (id, name, x, y, value, opts) => base(id, name, 'text', x, y, {
  text: value,
  fontFamily: opts.font,
  fontSize: opts.size,
  fontWeight: opts.weight,
  fill: opts.fill,
  letterSpacing: opts.tracking ?? 0,
  lineHeight: opts.leading ?? 1.3,
  align: opts.align ?? 'left',
  width: opts.width ?? COL,
  ...(opts.marks ? { marks: opts.marks } : {}),
})

const shape = (id, name, x, y, width, height, fill, cornerRadius, extra = {}) =>
  base(id, name, 'shape', x, y, { shapeType: 'rect', width, height, fill, cornerRadius, ...extra })

const chip = (id, name, x, y, label, opts) => base(id, name, 'chip', x, y, {
  text: label,
  fontFamily: opts.font,
  fontSize: opts.size ?? 34,
  fontWeight: opts.weight ?? 600,
  textColor: opts.textColor,
  fill: opts.fill,
  cornerRadius: opts.cornerRadius ?? 999,
  paddingX: opts.paddingX ?? 34,
  paddingY: opts.paddingY ?? 20,
  ...(opts.icon ? { icon: opts.icon } : {}),
  iconSize: opts.iconSize ?? 34,
  iconGap: opts.iconGap ?? 14,
  iconPosition: opts.iconPosition ?? 'start',
  ...(opts.iconColor ? { iconColor: opts.iconColor } : {}),
})

const icon = (id, name, x, y, glyph, opts) => base(id, name, 'icon', x, y, {
  icon: glyph,
  size: opts.size,
  color: opts.color,
  strokeWidth: opts.strokeWidth ?? Math.round(opts.size / 16),
  ...(opts.plate ? { background: opts.plate } : {}),
  backgroundPadding: opts.platePadding ?? 0,
  backgroundRadius: opts.plateRadius ?? 0,
})

const phone = (id, x, y, scale, palette, extra = {}) => base(id, 'Replace with your screenshot', 'phone', x, y, {
  model: 'iphone-16-pro',
  scale,
  screenshotFit: 'cover',
  screenshotOffsetX: 0,
  screenshotOffsetY: 0,
  showStatusBar: true,
  statusBarTheme: palette.dark ? 'dark' : 'light',
  statusBarBg: 'transparent',
  shadow: { color: palette.shadow, blur: 90, offsetX: 0, offsetY: 48, opacity: palette.dark ? 0.55 : 0.28 },
  ...extra,
})

const brandMark = (id, x, y, brand, color = '{brand:tplprimary}') => base(id, 'Brand', 'brand', x, y, {
  appName: brand.appName,
  logoSize: 60,
  nameColor: color,
  nameFontSize: 38,
  nameFontFamily: brand.fonts.body,
  nameFontWeight: 700,
  direction: 'row',
  gap: 18,
})

/**
 * A word or phrase inside `value`, painted with the brand's headline gradient.
 *
 * That gradient is a separate pair from the UI accent: an accent chosen to sit
 * quietly behind an icon can land within a shade of the ink, and a marked
 * phrase that close to the body colour reads as a rendering fault rather than
 * as emphasis.
 */
const markPhrase = (value, phrase, palette, weight) => {
  const start = value.indexOf(phrase)
  if (start < 0) throw new Error(`"${phrase}" is not in "${value}"`)
  return [{
    start,
    end: start + phrase.length,
    fill: { type: 'linear', angle: 135, stops: [
      { offset: 0, color: palette.markFrom ?? palette.accent },
      { offset: 1, color: palette.markTo ?? palette.accent2 },
    ] },
    fontWeight: weight,
  }]
}

// ─── Slide builders ──────────────────────────────────────────────────────────

const type = {
  display: (palette, brand, size = 112) => ({
    font: brand.fonts.display, size, weight: brand.displayWeight,
    fill: palette.ink, tracking: brand.displayTracking, leading: 1.06, width: COL,
  }),
  lede: (palette, brand) => ({
    font: brand.fonts.body, size: 42, weight: 400,
    fill: palette.muted, leading: 1.42, width: COL - 60,
  }),
  cardTitle: (palette, brand) => ({
    font: brand.fonts.body, size: 44, weight: 700, fill: palette.ink, leading: 1.2,
  }),
  cardBody: (palette, brand) => ({
    font: brand.fonts.body, size: 30, weight: 400, fill: palette.muted, leading: 1.4,
  }),
  eyebrow: (palette, brand) => ({
    font: brand.fonts.body, size: 26, weight: 700,
    fill: palette.accent, tracking: 4, leading: 1.2,
  }),
}

function heroSlide(brand) {
  const p = brand.palettes.hero
  const copy = brand.copy.hero
  return {
    name: 'Hero',
    numSlides: 1,
    slideWidth: W, slideHeight: H,
    slideNames: ['slide-01'],
    layers: [
      background('l0', p.fill, p.accents),
      brandMark('l1', M, 116, brand),
      text('l2', 'Headline', M, 336, copy.title, {
        ...type.display(p, brand, 116),
        marks: markPhrase(copy.title, copy.mark, p, brand.displayWeight),
      }),
      text('l3', 'Subtitle', M, 336 + copy.titleLines * 124 + 36, copy.lede, type.lede(p, brand)),
      chip('l4', `Chip ${copy.chips[0].label}`, M, 890, copy.chips[0].label, {
        font: brand.fonts.body, fill: p.chipFill, textColor: p.chipText, icon: copy.chips[0].icon,
        iconColor: p.accent,
      }),
      phone('l5', phoneX(2.3), 1060, 2.3, p),
    ],
  }
}

function panoSlide(brand) {
  const p = brand.palettes.pano
  const copy = brand.copy.pano
  const right = W // second slide starts here
  return {
    name: 'Pano',
    numSlides: 2,
    slideWidth: W, slideHeight: H,
    slideNames: ['slide-02', 'slide-03'],
    layers: [
      background('l0', p.fill, p.accents),
      text('l1', 'Eyebrow left', M, 250, copy.eyebrowLeft, type.eyebrow(p, brand)),
      text('l2', 'Headline left', M, 312, copy.left, {
        ...type.display(p, brand, 104),
        marks: markPhrase(copy.left, copy.leftMark, p, brand.displayWeight),
      }),
      text('l3', 'Eyebrow right', right + M, 250, copy.eyebrowRight, type.eyebrow(p, brand)),
      text('l4', 'Headline right', right + M, 312, copy.right, {
        ...type.display(p, brand, 104),
        marks: markPhrase(copy.right, copy.rightMark, p, brand.displayWeight),
      }),
      text('l5', 'Caption left', M, 660, copy.captionLeft, type.lede(p, brand)),
      text('l6', 'Caption right', right + M, 660, copy.captionRight, type.lede(p, brand)),
      // The whole point of a pano: one device, straddling the seam.
      phone('l7', phoneX(2.85, W), 900, 2.85, p),
    ],
  }
}

function featureSlide(brand) {
  const p = brand.palettes.feature
  const copy = brand.copy.features
  const layers = [
    background('l0', p.fill, p.accents),
    text('l1', 'Eyebrow', M, 210, copy.eyebrow, type.eyebrow(p, brand)),
    text('l2', 'Headline', M, 272, copy.title, {
      ...type.display(p, brand, 98),
      marks: markPhrase(copy.title, copy.mark, p, brand.displayWeight),
    }),
  ]

  const cardH = 268
  const gap = 32
  let y = 700
  let n = 3
  for (const item of copy.items) {
    layers.push(shape(`l${n++}`, `Card ${item.title}`, M, y, COL, cardH, p.card, 44))
    // The plate grows outward from the glyph, so the glyph's own position is
    // what is placed here — the padding no longer shifts it.
    layers.push(icon(`l${n++}`, `Icon ${item.icon}`, M + 70, y + 78, item.icon, {
      size: 60, color: p.accent, plate: p.iconPlate, platePadding: 26, plateRadius: 30,
    }))
    layers.push(text(`l${n++}`, item.title, M + 216, y + 62, item.title, {
      ...type.cardTitle(p, brand), width: COL - 260,
    }))
    layers.push(text(`l${n++}`, `${item.title} body`, M + 216, y + 126, item.body, {
      ...type.cardBody(p, brand), width: COL - 260,
    }))
    y += cardH + gap
  }

  layers.push(phone(`l${n}`, phoneX(1.8), y + 52, 1.8, p))
  return { name: 'Features', numSlides: 1, slideWidth: W, slideHeight: H, slideNames: ['slide-04'], layers }
}

function showcaseSlide(brand) {
  const p = brand.palettes.showcase
  const copy = brand.copy.showcase
  const layers = [
    background('l0', p.fill, p.accents),
    text('l1', 'Eyebrow', M, 210, copy.eyebrow, type.eyebrow(p, brand)),
    text('l2', 'Headline', M, 272, copy.title, {
      ...type.display(p, brand, 98),
      marks: markPhrase(copy.title, copy.mark, p, brand.displayWeight),
    }),
    text('l3', 'Lede', M, 548, copy.lede, type.lede(p, brand)),
  ]

  // Three stats across one row, each in its own column of the text grid. They
  // sit above the devices: below, they would land on a phone body and the
  // caption under each number would be unreadable.
  const statColumn = Math.floor(COL / copy.stats.length)
  let n = 4
  copy.stats.forEach((stat, index) => {
    const x = M + index * statColumn
    layers.push(text(`l${n++}`, `Stat ${stat.value}`, x, 712, stat.value, {
      font: brand.fonts.display, size: 62, weight: brand.displayWeight,
      fill: p.accent, tracking: brand.displayTracking, leading: 1.1, width: statColumn - 24,
    }))
    layers.push(text(`l${n++}`, `Stat ${stat.value} label`, x, 794, stat.label, {
      font: brand.fonts.body, size: 26, weight: 500, fill: p.muted, leading: 1.25, width: statColumn - 24,
    }))
  })

  // Two devices, the back one tilted: a flat pair reads as a mistake, an
  // overlapping pair reads as a set.
  layers.push({ ...phone(`l${n++}`, 72, 1090, 1.8, p), rotation: -7, name: 'Replace with your screenshot (back)' })
  layers.push(phone(`l${n}`, 452, 940, 2.15, p))

  return { name: 'Showcase', numSlides: 1, slideWidth: W, slideHeight: H, slideNames: ['slide-05'], layers }
}

function detailSlide(brand) {
  const p = brand.palettes.detail
  const copy = brand.copy.detail
  const layers = [
    background('l0', p.fill, p.accents),
    text('l1', 'Eyebrow', M, 210, copy.eyebrow, type.eyebrow(p, brand)),
    text('l2', 'Headline', M, 272, copy.title, {
      ...type.display(p, brand, 98),
      marks: markPhrase(copy.title, copy.mark, p, brand.displayWeight),
    }),
    text('l3', 'Lede', M, 548, copy.lede, type.lede(p, brand)),
    // The plate frames the device, so it has to be taller than the device is.
    shape('l4', 'Device plate', M, 800, COL, 1500, p.card, 72),
    phone('l5', phoneX(1.65), 855, 1.65, p),
  ]

  let n = 6
  let y = 2380
  for (const line of copy.chips) {
    layers.push(chip(`l${n++}`, `Chip ${line.label}`, M, y, line.label, {
      font: brand.fonts.body, fill: p.chipFill, textColor: p.chipText, icon: line.icon,
      iconColor: p.accent, size: 30, paddingX: 30, paddingY: 18, iconSize: 30,
    }))
    y += 96
  }

  return { name: 'Detail', numSlides: 1, slideWidth: W, slideHeight: H, slideNames: ['slide-06'], layers }
}

function ctaSlide(brand) {
  const p = brand.palettes.cta
  const copy = brand.copy.cta
  return {
    name: 'Close',
    numSlides: 1,
    slideWidth: W, slideHeight: H,
    slideNames: ['slide-07'],
    layers: [
      background('l0', p.fill, p.accents),
      brandMark('l1', M, 150, brand, p.brandColor),
      text('l2', 'Headline', M, 420, copy.title, {
        ...type.display(p, brand, 112),
        marks: markPhrase(copy.title, copy.mark, p, brand.displayWeight),
      }),
      text('l3', 'Lede', M, 820, copy.lede, type.lede(p, brand)),
      chip('l4', 'Chip rating', M, 1000, copy.badge, {
        font: brand.fonts.body, fill: p.chipFill, textColor: p.chipText,
        icon: 'star', iconColor: p.accent,
      }),
      // Cropped by the canvas edge on purpose — the last slide closes on the
      // product, not on another full device shot.
      phone('l5', phoneX(2.5), 1290, 2.5, p),
    ],
  }
}

// ─── Brands ──────────────────────────────────────────────────────────────────

/**
 * A palette per slide rather than one per template: a seven-slide listing that
 * never changes value is what made these read as a slideshow of one idea. The
 * ink/accent pair stays fixed so it still reads as one brand.
 */
function palettes({ ink, muted, accent, accent2, markFrom, markTo, shadow, dark, surfaces, card, chipFill, chipText, iconPlate, brandColor }) {
  const make = ({ fill, accents, ...overrides }) => ({
    ink, muted, accent, accent2, markFrom, markTo, shadow, dark, card, chipFill, chipText, iconPlate, brandColor,
    fill, accents,
    // A surface may invert the ink pair and the accent: the closing slide runs
    // dark under five light ones, and text that read there would vanish here.
    ...overrides,
  })
  return {
    hero: make(surfaces[0]),
    pano: make(surfaces[1]),
    feature: make(surfaces[2]),
    showcase: make(surfaces[3]),
    detail: make(surfaces[4]),
    cta: make(surfaces[5]),
  }
}

const linear = (angle, stops) => ({ type: 'linear', angle, stops: stops.map(([offset, color]) => ({ offset, color })) })
const bubble = (color, cx, cy, rx, ry) => ({ color, cx, cy, rx, ry })

const BRANDS = [
  {
    slug: 'noor-editorial',
    name: 'Noor · Editorial',
    appName: 'Noor',
    category: 'Books & Reference',
    description: 'Warm paper-and-ink reading set: serif hero, a library panorama across two slides, feature cards, a two-device showcase and a gold close. Swap in your own screenshots.',
    fonts: { display: 'Fraunces', body: 'Inter' },
    displayWeight: 700,
    displayTracking: -2,
    primary: '#116149',
    accentColor: '#C98A2E',
    palettes: palettes({
      ink: '#12332C',
      muted: '#5C6B63',
      accent: '#C98A2E',
      accent2: '#E0B25C',
      shadow: '#3A2A12',
      card: '#FFFFFFE6',
      chipFill: '#FFFFFF',
      chipText: '#12332C',
      iconPlate: '#C98A2E1F',
      surfaces: [
        { fill: linear(168, [[0, '#FDFAF3'], [0.55, '#F7EFE0'], [1, '#F0E4CE']]),
          accents: [bubble('rgba(201,138,46,0.18)', 86, 10, 820, 720), bubble('rgba(17,97,73,0.10)', 6, 88, 880, 760)] },
        { fill: linear(112, [[0, '#F7EFE0'], [0.5, '#FDFAF3'], [1, '#EAF1EC']]),
          accents: [bubble('rgba(17,97,73,0.14)', 18, 14, 880, 780), bubble('rgba(201,138,46,0.14)', 84, 86, 840, 740)] },
        { fill: linear(184, [[0, '#F5EFE3'], [1, '#EFE6D5']]),
          accents: [bubble('rgba(201,138,46,0.12)', 50, 4, 900, 620)] },
        { fill: linear(150, [[0, '#EAF1EC'], [0.6, '#F7F3E9'], [1, '#F3E7D0']]),
          accents: [bubble('rgba(17,97,73,0.16)', 12, 20, 860, 760), bubble('rgba(201,138,46,0.16)', 90, 78, 820, 720)] },
        { fill: linear(176, [[0, '#FBF6EC'], [1, '#F1E7D6']]),
          accents: [bubble('rgba(201,138,46,0.10)', 78, 12, 780, 700)] },
        { fill: linear(158, [[0, '#12332C'], [0.55, '#16473A'], [1, '#1E5E44']]),
          accents: [bubble('rgba(201,138,46,0.30)', 84, 14, 880, 760), bubble('rgba(224,178,92,0.18)', 10, 86, 860, 740)],
          ink: '#FDFAF3', muted: 'rgba(253,250,243,0.76)', accent: '#E8C27A', accent2: '#F5DFAF',
          markFrom: '#E8C27A', markTo: '#F5DFAF',
          brandColor: '#F0E4CE', dark: true, chipFill: '#FDFAF3', chipText: '#12332C' },
      ],
    }),
    copy: {
      hero: {
        title: 'A world\nof words.', mark: 'words', titleLines: 2,
        lede: 'Every book you love, in one quiet place — and every note you took beside it.',
        chips: [{ label: 'Free to start', icon: 'star' }],
      },
      pano: {
        eyebrowLeft: 'YOUR LIBRARY', eyebrowRight: 'EVERY DEVICE',
        left: 'Read\nanywhere,', leftMark: 'anywhere,',
        right: 'pick up\nexactly here.', rightMark: 'exactly here.',
        captionLeft: 'Your shelf follows you — phone, tablet, and the web.',
        captionRight: 'Position, bookmarks and highlights sync as you close the app.',
      },
      features: {
        eyebrow: 'WHAT YOU GET', title: 'Built for\nlong evenings.', mark: 'long evenings.',
        items: [
          { icon: 'book', title: 'A shelf that stays tidy', body: 'Collections, tags and a search that reaches inside your books.' },
          { icon: 'bookmark', title: 'Highlights worth keeping', body: 'Mark a passage and find it again months later in two taps.' },
          { icon: 'download', title: 'Reads without signal', body: 'Download a title once and the whole thing is yours offline.' },
        ],
      },
      showcase: {
        eyebrow: 'DAY AND NIGHT', title: 'Kind to\nyour eyes.', mark: 'your eyes.',
        lede: 'Warm paper by day, true black by night, and type you can size to the millimetre.',
        stats: [
          { value: '40k+', label: 'Titles in the catalogue' },
          { value: '4.9', label: 'Average reader rating' },
          { value: '0', label: 'Ads, ever' },
        ],
      },
      detail: {
        eyebrow: 'IN THE MARGINS', title: 'Meaning,\nmade clear.', mark: 'made clear.',
        lede: 'Tap any word for a definition, a translation, or the passage it came from.',
        chips: [
          { label: 'Instant dictionary', icon: 'search' },
          { label: 'Twelve languages', icon: 'globe' },
          { label: 'Notes that export', icon: 'file-text' },
        ],
      },
      cta: {
        title: 'Start your\nlibrary today.', mark: 'library today.',
        lede: 'Free to begin. No account needed until you want your shelf on a second device.',
        badge: '4.9 · 12k ratings',
      },
    },
  },
  {
    slug: 'orbit-studio',
    name: 'Orbit · Studio',
    appName: 'Orbit',
    category: 'Graphics & Design',
    description: 'Midnight studio set: neon-gradient hero, a two-slide canvas panorama, feature cards, a tilted two-device showcase and a violet close. Brand Kit wired.',
    fonts: { display: 'Space Grotesk', body: 'Inter' },
    displayWeight: 700,
    displayTracking: -3,
    primary: '#7C6EF6',
    accentColor: '#22D3EE',
    palettes: palettes({
      ink: '#F4F5FF',
      muted: '#A2A7C9',
      accent: '#8B7BFF',
      accent2: '#22D3EE',
      shadow: '#05060F',
      dark: true,
      card: '#FFFFFF0F',
      chipFill: '#FFFFFF14',
      chipText: '#F4F5FF',
      iconPlate: '#8B7BFF2E',
      surfaces: [
        { fill: linear(162, [[0, '#0A0C1B'], [0.55, '#131735'], [1, '#1B1140']]),
          accents: [bubble('rgba(139,123,255,0.34)', 84, 8, 860, 760), bubble('rgba(34,211,238,0.18)', 8, 86, 900, 780)] },
        { fill: linear(110, [[0, '#101430'], [0.5, '#0A0C1B'], [1, '#17203F']]),
          accents: [bubble('rgba(34,211,238,0.24)', 16, 12, 880, 780), bubble('rgba(139,123,255,0.26)', 86, 84, 860, 760)] },
        { fill: linear(186, [[0, '#0B0E20'], [1, '#131734']]),
          accents: [bubble('rgba(139,123,255,0.18)', 50, 6, 920, 640)] },
        { fill: linear(148, [[0, '#150F33'], [0.6, '#0D1026'], [1, '#0A1A2E']]),
          accents: [bubble('rgba(139,123,255,0.30)', 12, 18, 880, 780), bubble('rgba(34,211,238,0.22)', 90, 80, 840, 740)] },
        { fill: linear(178, [[0, '#0A0C1B'], [1, '#141838']]),
          accents: [bubble('rgba(34,211,238,0.16)', 78, 14, 800, 720)] },
        { fill: linear(155, [[0, '#4C2ED0'], [0.5, '#6D3DE8'], [1, '#22D3EE']]),
          accents: [bubble('rgba(255,255,255,0.22)', 82, 12, 880, 760), bubble('rgba(10,12,27,0.28)', 10, 88, 860, 740)],
          ink: '#FFFFFF', muted: 'rgba(255,255,255,0.84)', accent: '#0A0C1B', accent2: '#1B1140',
          markFrom: '#0A0C1B', markTo: '#231652',
          brandColor: '#FFFFFF', chipFill: '#FFFFFF', chipText: '#12143A' },
      ],
    }),
    copy: {
      hero: {
        title: 'Create\nbeyond limits.', mark: 'beyond limits.', titleLines: 2,
        lede: 'A design studio that fits in your pocket — layers, vectors and export, all of it.',
        chips: [{ label: 'Pro tools, no subscription', icon: 'star' }],
      },
      pano: {
        eyebrowLeft: 'ONE CANVAS', eyebrowRight: 'EVERY SCREEN',
        left: 'Draw it\nonce,', leftMark: 'once,',
        right: 'ship it\neverywhere.', rightMark: 'everywhere.',
        captionLeft: 'An infinite canvas that never asks you to zoom out and guess.',
        captionRight: 'Export every size a store asks for, from one artboard.',
      },
      features: {
        eyebrow: 'IN THE BOX', title: 'Every detail,\nyours.', mark: 'yours.',
        items: [
          { icon: 'layers-stack', title: 'Layers that behave', body: 'Groups, masks and blend modes that survive a round trip.' },
          { icon: 'cloud-sync', title: 'Sync without thinking', body: 'Close it on the phone, open it on the tablet, mid-stroke.' },
          { icon: 'download', title: 'Export anything', body: 'PNG, SVG and PDF at any density, in one pass.' },
        ],
      },
      showcase: {
        eyebrow: 'DRAFT TO DONE', title: 'Fast enough\nto keep up.', mark: 'to keep up.',
        lede: 'Sixty frames a second on a five-year-old phone, with a thousand layers open.',
        stats: [
          { value: '120fps', label: 'On a ProMotion display' },
          { value: '1000+', label: 'Layers per document' },
          { value: '12', label: 'Export presets built in' },
        ],
      },
      detail: {
        eyebrow: 'UNDER THE HOOD', title: 'Precision\nwhen you want it.', mark: 'when you want it.',
        lede: 'Nudge by a tenth of a pixel, snap to anything, and undo all the way back.',
        chips: [
          { label: 'Smart snapping', icon: 'target' },
          { label: 'Unlimited history', icon: 'refresh-cw' },
          { label: 'Colour-managed', icon: 'sliders' },
        ],
      },
      cta: {
        title: 'Your next\nchapter starts here.', mark: 'chapter starts here.',
        lede: 'Download Orbit and open a blank canvas. Everything above is in the free tier.',
        badge: '4.8 · Editors’ Choice',
      },
    },
  },
  {
    slug: 'serein-wellness',
    name: 'Serein · Wellness',
    appName: 'Serein',
    category: 'Health & Fitness',
    description: 'Soft sage-and-sand wellness set: calm hero, a breathing panorama across two slides, habit cards, a progress showcase and a deep-green close.',
    fonts: { display: 'Fraunces', body: 'Plus Jakarta Sans' },
    displayWeight: 600,
    displayTracking: -2,
    primary: '#2F7A68',
    accentColor: '#E08D6E',
    palettes: palettes({
      ink: '#1C3A33',
      muted: '#5F7871',
      accent: '#2F7A68',
      accent2: '#7FC2A9',
      markFrom: '#D9724E',
      markTo: '#EFA98A',
      shadow: '#123027',
      card: '#FFFFFFD9',
      chipFill: '#FFFFFF',
      chipText: '#1C3A33',
      iconPlate: '#2F7A681F',
      surfaces: [
        { fill: linear(170, [[0, '#F7FBF7'], [0.55, '#EAF4EE'], [1, '#DDEDE3']]),
          accents: [bubble('rgba(47,122,104,0.16)', 84, 10, 840, 740), bubble('rgba(224,141,110,0.14)', 8, 86, 880, 760)] },
        { fill: linear(114, [[0, '#EAF4EE'], [0.5, '#FBF8F3'], [1, '#F6E8DF']]),
          accents: [bubble('rgba(47,122,104,0.14)', 18, 14, 880, 780), bubble('rgba(224,141,110,0.16)', 84, 86, 840, 740)] },
        { fill: linear(184, [[0, '#F4F9F5'], [1, '#E7F1EA']]),
          accents: [bubble('rgba(47,122,104,0.10)', 50, 4, 900, 620)] },
        { fill: linear(146, [[0, '#EFF6F1'], [0.6, '#FAF6F0'], [1, '#F2E2D6']]),
          accents: [bubble('rgba(127,194,169,0.24)', 12, 18, 860, 760), bubble('rgba(224,141,110,0.16)', 90, 80, 820, 720)] },
        { fill: linear(176, [[0, '#FAFCFA'], [1, '#E9F2EC']]),
          accents: [bubble('rgba(47,122,104,0.10)', 78, 12, 780, 700)] },
        { fill: linear(158, [[0, '#1C3A33'], [0.55, '#265548'], [1, '#2F7A68']]),
          accents: [bubble('rgba(224,141,110,0.28)', 84, 14, 880, 760), bubble('rgba(127,194,169,0.22)', 10, 86, 860, 740)],
          ink: '#F7FBF7', muted: 'rgba(247,251,247,0.78)', accent: '#F2B79A', accent2: '#FBD9C6',
          markFrom: '#F2B79A', markTo: '#FBD9C6',
          brandColor: '#DDEDE3', dark: true, chipFill: '#F7FBF7', chipText: '#1C3A33' },
      ],
    }),
    copy: {
      hero: {
        title: 'A little\nmore calm.', mark: 'more calm.', titleLines: 2,
        lede: 'Five minutes a day, in the order that suits you. No streak to lose, nothing to keep up with.',
        chips: [{ label: 'No streaks, no guilt', icon: 'heart' }],
      },
      pano: {
        eyebrowLeft: 'ONE BREATH', eyebrowRight: 'THEN THE NEXT',
        left: 'Room to\nbreathe,', leftMark: 'breathe,',
        right: 'every\nsingle day.', rightMark: 'single day.',
        captionLeft: 'Guided sessions from one minute to twenty, whenever you have a gap.',
        captionRight: 'Gentle reminders that go quiet the moment they stop helping.',
      },
      features: {
        eyebrow: 'A GENTLE RHYTHM', title: 'Good days\nstart here.', mark: 'start here.',
        items: [
          { icon: 'heart', title: 'Breathe', body: 'Paced sessions that slow you down without asking you to sit still.' },
          { icon: 'moon-sleep', title: 'Sleep', body: 'Wind-down stories and sounds that fade out on their own.' },
          { icon: 'edit', title: 'Reflect', body: 'A one-line journal. Long enough to notice, short enough to keep.' },
        ],
      },
      showcase: {
        eyebrow: 'OVER TIME', title: 'Notice your\nprogress.', mark: 'progress.',
        lede: 'Quiet charts that show the shape of a month, not a number to beat.',
        stats: [
          { value: '5 min', label: 'The average session' },
          { value: '86%', label: 'Still here after a month' },
          { value: '0', label: 'Notifications by default' },
        ],
      },
      detail: {
        eyebrow: 'YOURS ALONE', title: 'Private\nby default.', mark: 'by default.',
        lede: 'Your journal stays on your device unless you ask for it to be backed up.',
        chips: [
          { label: 'On-device journal', icon: 'lock' },
          { label: 'Export any time', icon: 'download' },
          { label: 'No third-party trackers', icon: 'shield' },
        ],
      },
      cta: {
        title: 'Begin with\nyourself.', mark: 'yourself.',
        lede: 'One minute is enough to start. Serein is free, and the calm parts always will be.',
        badge: '4.9 · 30k ratings',
      },
    },
  },
]

// ─── Emit ────────────────────────────────────────────────────────────────────

const DIR = 'public/templates'

for (const brand of BRANDS) {
  const template = {
    id: `tpl-${brand.slug}`,
    kind: 'fixflow-template',
    schemaVersion: 1,
    name: brand.name,
    description: brand.description,
    category: brand.category,
    author: 'FixFlow',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      defaultSlideWidth: W,
      defaultSlideHeight: H,
      defaultLocale: 'en',
      brandName: brand.appName,
      brandColors: [
        { id: 'tplprimary', name: 'Primary', value: brand.primary },
        { id: 'tplaccent', name: 'Accent', value: brand.accentColor },
      ],
    },
    slideGroups: [
      heroSlide(brand),
      panoSlide(brand),
      featureSlide(brand),
      showcaseSlide(brand),
      detailSlide(brand),
      ctaSlide(brand),
    ],
  }

  const slides = template.slideGroups.reduce((total, group) => total + group.numSlides, 0)
  if (slides !== 7) throw new Error(`${brand.slug} produced ${slides} slides, expected 7`)

  const file = path.join(DIR, `${brand.slug}.template.json`)
  await writeFile(file, `${JSON.stringify(template, null, 2)}\n`)
  console.log(`Wrote ${file} (${slides} slides, ${template.slideGroups.length} groups)`)
}
