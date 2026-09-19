import type {
  GroupLayer, IconLayer, Layer, PhoneLayer, ShapeLayer, SlideGroup, TextLayer, TextMark,
} from '@/types'
import { getIconGlyph } from '@/assets/icons/library'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { measureChipText } from '@/utils/chipLayout'
import { DEFAULT_ARABIC_FONT } from '@/utils/fonts'
import { hasJoiningScript, textDirection } from '@/utils/textDirection'
import { prefersDarkInk } from '@/utils/color'

/**
 * A slide, described the way a person would describe one.
 *
 * This is what the AI is asked to produce, and it is deliberately *not* a list
 * of layers with coordinates. A model asked to place a headline on a 1290×2796
 * canvas guesses pixel values, and the guesses collide with the device frame,
 * run off the edge, or stack two captions on the same line. What a model is
 * actually good at is the part a person would struggle with — the words, which
 * glyph says "sync", a palette that holds together — so the plan carries that,
 * and the geometry below is the app's own.
 *
 * The result is that a bad plan still produces a well-built slide: the worst
 * case is wording you disagree with, not a layout you have to repair.
 */

export type SlideBlockType =
  | 'eyebrow' | 'chip' | 'headline' | 'subhead' | 'body' | 'icon' | 'feature' | 'phone'

export interface SlideBlock {
  type: SlideBlockType
  /** The words. On a `feature` this is the description under its title. */
  text?: string
  /** A feature card's bold first line. */
  title?: string
  /** A name from the bundled icon library, for `chip`, `icon` and `feature`. */
  icon?: string
  /** Which side of a chip's label its glyph sits on. */
  iconPosition?: 'left' | 'right'
}

export interface SlidePlan {
  /** Two hex colours; the background is a gradient between them. */
  backgroundFrom: string
  backgroundTo: string
  /** Hex, used for the headline and body copy. */
  textColor: string
  /** Hex, used for a chip's plate, an icon's tint and the headline's accent. */
  accentColor: string
  /**
   * The tail of the headline drawn in `accentColor` instead of `textColor`.
   * Must appear verbatim in the headline; anything else is ignored.
   */
  headlineAccent?: string
  /** A feature card's plate. Defaults to a light card on a dark slide, and back. */
  cardColor?: string
  /** A serif display face is what makes an editorial slide read as one. */
  displayFont?: 'sans' | 'serif'
  layout: 'text-above-device' | 'text-below-device' | 'text-only' | 'feature-cards'
  blocks: SlideBlock[]
}

/** Everything the builder needs to know about the canvas it is filling. */
export interface SlideCanvas {
  width: number
  height: number
}

/**
 * Proportions rather than pixels.
 *
 * A store screenshot is authored at one size and exported at a dozen, and the
 * same plan has to work on a 1290-wide phone canvas and a 2048-wide tablet
 * one. Everything below is a fraction of the canvas, so a generated slide is
 * correct at any format instead of correct at the one it was made on.
 */
const SIDE_MARGIN = 0.085
const TOP_MARGIN = 0.075
/** Type sizes, as a fraction of canvas width. */
const EYEBROW = 0.026
const HEADLINE = 0.082
const SUBHEAD = 0.042
const BODY = 0.033
const CHIP_TEXT = 0.030
const ICON_SIZE = 0.115
/** A feature card's parts, also as a fraction of canvas width. */
const CARD_PADDING = 0.042
const CARD_RADIUS = 0.040
const CARD_TILE = 0.105
const CARD_TILE_RADIUS = 0.028
const CARD_GLYPH = 0.050
const CARD_TITLE = 0.038
const CARD_BODY = 0.027
/** The device never spans more than this share of the canvas width. */
const MAX_DEVICE_WIDTH = 0.62
/** Below this the mockup reads as an illustration rather than a screen. */
const MIN_DEVICE_SCALE = 0.35
/**
 * How much of the device stays on the canvas in the editorial layout, where
 * it is cropped by the bottom edge on purpose. Less than this and the crop
 * reads as a mistake rather than as a frame running off the page.
 */
const DEVICE_PEEK = 0.22

/** Vertical air after each block, as a fraction of canvas height. */
const GAP_AFTER: Record<SlideBlockType, number> = {
  eyebrow: 0.008,
  chip: 0.022,
  headline: 0.018,
  subhead: 0.016,
  body: 0.02,
  icon: 0.022,
  feature: 0.014,
  phone: 0,
}

/** Reading order, whatever order the model listed the blocks in. */
const ORDER: Record<SlideBlockType, number> = {
  eyebrow: 0, chip: 1, icon: 2, headline: 3, subhead: 4, body: 5, feature: 6, phone: 7,
}

/** At most one of each of these; a slide with two headlines has none. */
const SINGLETON: readonly SlideBlockType[] = ['eyebrow', 'headline', 'subhead', 'body', 'phone']

function hex(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim()
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback
}

/**
 * The face to set a piece of copy in.
 *
 * Pashto and Persian are the whole point of this app's localisation, and a
 * Latin display face has no Arabic glyphs at all — a headline set in Sora
 * falls back to whatever the system happens to have, which is exactly the
 * mismatched look a generated slide must not have. Script first, then role.
 */
function familyFor(text: string, role: 'display' | 'body', displayFont: 'sans' | 'serif'): string {
  if (hasJoiningScript(text)) {
    return role === 'display' && displayFont === 'serif' ? 'Noto Naskh Arabic' : DEFAULT_ARABIC_FONT
  }
  if (role === 'body') return 'Inter'
  return displayFont === 'serif' ? 'Fraunces' : 'Sora'
}

/**
 * Letter spacing, which Arabic script cannot have.
 *
 * Arabic letters join, and spacing them apart breaks the joins — the word
 * comes out as disconnected shapes. A tracked-out eyebrow label is a Latin
 * typographic device; in Pashto it is damage.
 */
function trackingFor(text: string, amount: number): number {
  return hasJoiningScript(text) ? 0 : amount
}

/** Eyebrow labels are set in capitals, which only Latin script has. */
function eyebrowCase(text: string): string {
  return hasJoiningScript(text) ? text : text.toUpperCase()
}

/**
 * How many lines a block of copy will take at this size and width.
 *
 * Greedy word wrapping on measured widths, which is what the canvas does too.
 * Reserving the wrong height here is what makes a generated layout overlap: a
 * headline budgeted for one line and rendered on two pushes everything below
 * it down into the device frame. `measureChipText` is used for the
 * measurement because it already falls back to an approximation where there is
 * no canvas — a headless export, or a test.
 */
export function countWrappedLines(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  maxWidth: number,
): number {
  const paragraphs = text.split('\n')
  let lines = 0
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) { lines += 1; continue }
    let current = ''
    lines += 1
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && measureChipText(candidate, fontFamily, fontSize, fontWeight) > maxWidth) {
        lines += 1
        current = word
      } else {
        current = candidate
      }
    }
  }
  return Math.max(1, lines)
}

let counter = 0
function id(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/** Reset the id counter, so a test can assert on stable output. */
export function resetSlidePlanIds(): void {
  counter = 0
}

const base = (name: string, x: number, y: number) => ({
  id: id(name.toLowerCase().replace(/\s+/g, '-')),
  name,
  x,
  y,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
})

/**
 * A feature card: a plate, a tinted tile with a glyph in it, a bold line and a
 * description — assembled as one **group**, so it moves, scales and duplicates
 * as the single object a person thinks it is. Five loose layers would look the
 * same and be miserable to work with.
 *
 * Mirrored for Pashto and Persian: the tile sits on the right and the copy
 * runs right-to-left, because a card whose icon is stranded on the wrong side
 * reads as a Latin layout with Arabic text poured into it.
 */
function buildFeatureCard(args: {
  title: string
  description: string
  icon?: string
  width: number
  canvasWidth: number
  accent: string
  cardFill: string
  displayFont: 'sans' | 'serif'
}): { children: Layer[]; height: number } {
  const { title, description, icon, width, canvasWidth, accent, cardFill } = args
  const pad = canvasWidth * CARD_PADDING
  const tile = canvasWidth * CARD_TILE
  const glyph = canvasWidth * CARD_GLYPH
  const gap = canvasWidth * 0.032
  const titleSize = canvasWidth * CARD_TITLE
  const bodySize = canvasWidth * CARD_BODY

  const rtl = textDirection(title || description) === 'rtl'
  const hasTile = Boolean(icon && getIconGlyph(icon))
  const copyWidth = width - pad * 2 - (hasTile ? tile + gap : 0)

  // A card's copy stays sans even on a serif slide: the display face is the
  // headline's voice, and a serif repeated six times in small sizes is noise.
  const titleFamily = familyFor(title, 'body', 'sans')
  const bodyFamily = familyFor(description, 'body', 'sans')

  // The ink is decided by the plate it sits on, not by the slide's text colour.
  // A white card on a dark slide would otherwise get the slide's white copy and
  // come back blank — the one failure that makes a generated slide unusable.
  const ink = prefersDarkInk(cardFill) ? '#14131C' : '#FFFFFF'
  const titleLines = countWrappedLines(title, titleFamily, titleSize, 700, copyWidth)
  const bodyLines = description
    ? countWrappedLines(description, bodyFamily, bodySize, 400, copyWidth)
    : 0

  const titleHeight = titleSize * 1.25 * titleLines
  const bodyHeight = bodyLines ? bodySize * 1.4 * bodyLines : 0
  const copyGap = bodyLines ? canvasWidth * 0.012 : 0
  const copyHeight = titleHeight + copyGap + bodyHeight
  const height = pad * 2 + Math.max(hasTile ? tile : 0, copyHeight)

  // Both columns are centred against each other, so a one-line card does not
  // leave its tile floating above the words.
  const tileY = pad + Math.max(0, (copyHeight - tile) / 2)
  const copyY = pad + Math.max(0, (hasTile ? tile : 0) - copyHeight) / 2

  const tileX = rtl ? width - pad - tile : pad
  const copyX = rtl ? pad : pad + (hasTile ? tile + gap : 0)

  const children: Layer[] = [
    {
      ...base('Card', 0, 0),
      type: 'shape',
      shapeType: 'rect',
      width,
      height,
      fill: cardFill,
      cornerRadius: canvasWidth * CARD_RADIUS,
    } satisfies ShapeLayer,
  ]

  if (hasTile) {
    children.push({
      ...base('Tile', tileX, tileY),
      type: 'shape',
      shapeType: 'rect',
      width: tile,
      height: tile,
      // The accent at low opacity, so one hex from the model tints the whole
      // card family without it needing to invent a second, matching colour.
      fill: accent,
      opacity: 0.14,
      cornerRadius: canvasWidth * CARD_TILE_RADIUS,
    } satisfies ShapeLayer)
    children.push({
      ...base('Card icon', tileX + (tile - glyph) / 2, tileY + (tile - glyph) / 2),
      type: 'icon',
      icon: icon!,
      size: glyph,
      color: accent,
      strokeWidth: Math.max(2, glyph * 0.075),
      backgroundPadding: 0,
      backgroundRadius: 0,
    } satisfies IconLayer)
  }

  children.push({
    ...base('Card title', copyX, copyY),
    type: 'text',
    text: title,
    fontFamily: titleFamily,
    fontSize: titleSize,
    fontWeight: 700,
    fill: ink,
    letterSpacing: 0,
    lineHeight: 1.25,
    align: rtl ? 'right' : 'left',
    width: copyWidth,
  } satisfies TextLayer)

  if (bodyLines) {
    children.push({
      ...base('Card text', copyX, copyY + titleHeight + copyGap),
      type: 'text',
      text: description,
      fontFamily: bodyFamily,
      fontSize: bodySize,
      fontWeight: 400,
      fill: ink,
      letterSpacing: 0,
      lineHeight: 1.4,
      align: rtl ? 'right' : 'left',
      width: copyWidth,
      opacity: 0.72,
    } satisfies TextLayer)
  }

  return { children, height }
}

/**
 * The two marks that make a two-tone headline.
 *
 * The accent has to be found in the headline rather than described, because a
 * mark is a character range: if the model's accent phrase is not in the
 * headline verbatim there is nothing to colour, and the headline stays one
 * colour rather than getting a mark over the wrong words.
 */
function accentMarks(headline: string, accent: string | undefined, colour: string): TextMark[] | undefined {
  const phrase = accent?.trim()
  if (!phrase) return undefined
  const start = headline.indexOf(phrase)
  if (start < 0) return undefined
  return [{ start, end: start + phrase.length, fill: colour }]
}

/**
 * Turn a plan into layers, laid out on the canvas.
 *
 * The blocks stack from the top, each measured before the next is placed. The
 * device takes whatever room is left and is centred in it — except in the
 * editorial layout, where it is deliberately cropped by the bottom edge.
 */
export function buildSlideLayers(plan: SlidePlan, canvas: SlideCanvas): Layer[] {
  const { width, height } = canvas
  const margin = width * SIDE_MARGIN
  const contentWidth = width - margin * 2
  const textColor = hex(plan.textColor, '#FFFFFF')
  const accent = hex(plan.accentColor, '#7C6EF6')
  const cardFill = hex(plan.cardColor, '#FFFFFF')
  const displayFont = plan.displayFont === 'serif' ? 'serif' : 'sans'

  const seen = new Set<SlideBlockType>()
  const blocks = plan.blocks
    .filter((block) => {
      if (!SINGLETON.includes(block.type)) return true
      if (seen.has(block.type)) return false
      seen.add(block.type)
      return true
    })
    // Stable, so several feature cards keep the order the model wrote them in.
    .map((block, index) => ({ block, index }))
    .sort((a, b) => ORDER[a.block.type] - ORDER[b.block.type] || a.index - b.index)
    .map((entry) => entry.block)

  const editorial = plan.layout === 'feature-cards'
  const wantsPhone = plan.layout !== 'text-only' && blocks.some((block) => block.type === 'phone')
  const textBlocks = blocks.filter((block) => block.type !== 'phone')

  const layers: Layer[] = []

  // ── Measure the copy first, so the device can have the rest.
  interface Placed {
    block: SlideBlock
    height: number
    gap: number
    /** Built here because measuring a card means assembling it. */
    card?: { children: Layer[]; height: number }
  }
  const placed: Placed[] = textBlocks.map((block) => {
    const gap = height * GAP_AFTER[block.type]
    if (block.type === 'icon') return { block, height: width * ICON_SIZE, gap }
    if (block.type === 'chip') return { block, height: width * CHIP_TEXT * 1.25 + width * 0.036, gap }
    if (block.type === 'feature') {
      const card = buildFeatureCard({
        title: block.title?.trim() || block.text?.trim() || '',
        description: block.title?.trim() ? (block.text?.trim() ?? '') : '',
        icon: block.icon,
        width: contentWidth,
        canvasWidth: width,
        accent,
        cardFill,
        displayFont,
      })
      return { block, height: card.height, gap, card }
    }
    if (block.type === 'eyebrow') {
      return { block, height: width * EYEBROW * 1.3, gap }
    }
    const size = width * (block.type === 'headline' ? HEADLINE : block.type === 'subhead' ? SUBHEAD : BODY)
    const family = familyFor(block.text ?? '', block.type === 'headline' ? 'display' : 'body', displayFont)
    const weight = block.type === 'headline' ? 800 : block.type === 'subhead' ? 600 : 400
    const lineHeight = block.type === 'headline' ? 1.12 : 1.35
    const lines = countWrappedLines(block.text ?? '', family, size, weight, contentWidth)
    return { block, height: size * lineHeight * lines, gap }
  })

  const copyHeight = placed.reduce((total, item) => total + item.height + item.gap, 0)
  const textStartsAtTop = plan.layout !== 'text-below-device'

  // ── The device, sized to whatever the copy left behind.
  let deviceTop = 0
  let deviceHeight = 0
  if (wantsPhone) {
    const spec = getPhoneSpec('iphone-16-pro')
    const available = height - copyHeight - height * TOP_MARGIN * 2
    if (editorial) {
      // Cropped by the bottom edge on purpose: the frame is as wide as the
      // layout allows and runs off the page, which is what makes an editorial
      // slide read as a page rather than as a poster with a gap at the bottom.
      const fit = (width * MAX_DEVICE_WIDTH) / spec.frameWidth
      deviceHeight = spec.frameHeight * fit
      deviceTop = Math.min(
        height * TOP_MARGIN + copyHeight + height * 0.02,
        height - deviceHeight * DEVICE_PEEK,
      )
      layers.push(devicePhone(spec, fit, width, deviceTop))
    } else {
      const fit = Math.max(
        MIN_DEVICE_SCALE,
        Math.min(available / spec.frameHeight, (width * MAX_DEVICE_WIDTH) / spec.frameWidth),
      )
      deviceHeight = spec.frameHeight * fit
      deviceTop = textStartsAtTop
        ? height * TOP_MARGIN + copyHeight + (available - deviceHeight) / 2
        : height * TOP_MARGIN + (available - deviceHeight) / 2
      layers.push(devicePhone(spec, fit, width, deviceTop))
    }
  }

  // ── The copy.
  let cursor = textStartsAtTop
    ? height * TOP_MARGIN
    : (wantsPhone ? deviceTop + deviceHeight + height * TOP_MARGIN : height * TOP_MARGIN)

  for (const { block, height: blockHeight, gap, card } of placed) {
    if (block.type === 'feature' && card) {
      layers.push({
        ...base('Feature', margin, cursor),
        type: 'group',
        children: card.children,
        scale: 1,
      } satisfies GroupLayer)
    } else if (block.type === 'chip') {
      const fontSize = width * CHIP_TEXT
      const paddingX = width * 0.028
      const label = block.text?.trim() || 'New'
      const iconName = block.icon && getIconGlyph(block.icon) ? block.icon : undefined
      const iconSize = fontSize
      const iconGap = width * 0.012
      const family = familyFor(label, 'body', displayFont)
      const textWidth = measureChipText(label, family, fontSize, 700)
      const pillWidth = textWidth + paddingX * 2 + (iconName ? iconSize + iconGap : 0)
      layers.push({
        ...base('Chip', (width - pillWidth) / 2, cursor),
        type: 'chip',
        text: label,
        fontFamily: family,
        fontSize,
        fontWeight: 700,
        textColor: '#FFFFFF',
        fill: accent,
        cornerRadius: width * 0.04,
        paddingX,
        paddingY: width * 0.018,
        icon: iconName,
        iconSize,
        iconGap,
        iconPosition: block.iconPosition === 'right' ? 'right' : 'left',
      })
    } else if (block.type === 'icon') {
      const size = width * ICON_SIZE
      const glyph = block.icon && getIconGlyph(block.icon) ? block.icon : 'star'
      layers.push({
        ...base('Icon', (width - size) / 2, cursor),
        type: 'icon',
        icon: glyph,
        size,
        color: accent,
        strokeWidth: Math.max(2, size * 0.055),
        backgroundPadding: 0,
        backgroundRadius: 0,
      } satisfies IconLayer)
    } else if (block.type === 'eyebrow') {
      const text = eyebrowCase(block.text?.trim() || '')
      const fontSize = width * EYEBROW
      layers.push({
        ...base('Eyebrow', margin, cursor),
        type: 'text',
        text,
        fontFamily: familyFor(text, 'body', displayFont),
        fontSize,
        fontWeight: 700,
        fill: accent,
        letterSpacing: trackingFor(text, fontSize * 0.18),
        lineHeight: 1.3,
        align: editorial ? (textDirection(text) === 'rtl' ? 'right' : 'left') : 'center',
        width: contentWidth,
      } satisfies TextLayer)
    } else {
      const text = block.text?.trim() || ''
      const fontSize = width * (block.type === 'headline' ? HEADLINE : block.type === 'subhead' ? SUBHEAD : BODY)
      const family = familyFor(text, block.type === 'headline' ? 'display' : 'body', displayFont)
      const rtl = textDirection(text) === 'rtl'
      layers.push({
        ...base(block.type === 'headline' ? 'Headline' : block.type === 'subhead' ? 'Subheading' : 'Body', margin, cursor),
        type: 'text',
        text,
        fontFamily: family,
        fontSize,
        fontWeight: block.type === 'headline' ? 800 : block.type === 'subhead' ? 600 : 400,
        fill: textColor,
        letterSpacing: block.type === 'headline' ? trackingFor(text, -fontSize * 0.03) : 0,
        lineHeight: block.type === 'headline' ? 1.12 : 1.35,
        // An editorial slide is set flush to the margin; a poster is centred.
        align: editorial ? (rtl ? 'right' : 'left') : 'center',
        width: contentWidth,
        ...(block.type === 'headline'
          ? { marks: accentMarks(text, plan.headlineAccent, accent) }
          : {}),
        // Body copy is the one that carries a paragraph, so it is the one that
        // reads better a shade quieter than the headline above it.
        opacity: block.type === 'body' ? 0.82 : 1,
      } satisfies TextLayer)
    }
    cursor += blockHeight + gap
  }

  return layers
}

function devicePhone(
  spec: ReturnType<typeof getPhoneSpec>,
  fit: number,
  width: number,
  top: number,
): PhoneLayer {
  return {
    ...base('Phone', (width - spec.frameWidth * fit) / 2, top),
    type: 'phone',
    model: 'iphone-16-pro',
    scale: fit,
    screenshotFit: 'cover',
    screenshotOffsetX: 0,
    screenshotOffsetY: 0,
    showStatusBar: true,
    statusBarTheme: 'dark',
    statusBarBg: 'transparent',
    statusBarColor: '#000000',
  }
}

/** The background fill a plan asks for, ready to patch onto the background layer. */
export function backgroundFillFor(plan: SlidePlan) {
  return {
    type: 'linear' as const,
    angle: 160,
    stops: [
      { offset: 0, color: hex(plan.backgroundFrom, '#12101E') },
      { offset: 1, color: hex(plan.backgroundTo, '#1A1240') },
    ],
  }
}

/**
 * Every face a plan will set copy in.
 *
 * Callers must load these *before* building the layers. Card heights and the
 * device's share of the canvas are derived from measured text, and measuring
 * against a font the browser has not fetched yet gives the fallback's metrics
 * — so a card sized before its font arrives comes out too short and its
 * description hangs out of the bottom of the plate.
 */
export function fontsUsedBy(plan: SlidePlan): string[] {
  const display = plan.displayFont === 'serif' ? 'serif' : 'sans'
  const families = new Set<string>()
  for (const block of plan.blocks) {
    for (const text of [block.text, block.title]) {
      if (!text) continue
      families.add(familyFor(text, block.type === 'headline' ? 'display' : 'body', display))
      // A card's title is always set in the body face, whatever the slide's is.
      if (block.type === 'feature') families.add(familyFor(text, 'body', 'sans'))
    }
  }
  return [...families]
}

/** The canvas a slide group is authored on. */
export function canvasFor(group: SlideGroup): SlideCanvas {
  return { width: group.slideWidth, height: group.slideHeight }
}
