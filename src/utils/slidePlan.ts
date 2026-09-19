import type { ChipLayer, IconLayer, Layer, PhoneLayer, SlideGroup, TextLayer } from '@/types'
import { getIconGlyph } from '@/assets/icons/library'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { measureChipText } from '@/utils/chipLayout'

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

export type SlideBlockType = 'chip' | 'headline' | 'subhead' | 'body' | 'icon' | 'phone'

export interface SlideBlock {
  type: SlideBlockType
  /** The words, for the text blocks and the chip's label. */
  text?: string
  /** A name from the bundled icon library, for `chip` and `icon` blocks. */
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
  /** Hex, used for a chip's plate and an icon's tint. */
  accentColor: string
  /** Where the device sits relative to the words. */
  layout: 'text-above-device' | 'text-below-device' | 'text-only'
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
const HEADLINE = 0.082
const SUBHEAD = 0.042
const BODY = 0.033
const CHIP_TEXT = 0.030
const ICON_SIZE = 0.115
/** The device never spans more than this share of the canvas width. */
const MAX_DEVICE_WIDTH = 0.62
/** Below this the mockup reads as an illustration rather than a screen. */
const MIN_DEVICE_SCALE = 0.35
/** Vertical air between blocks, as a fraction of canvas height. */
const GAP_AFTER: Record<SlideBlockType, number> = {
  chip: 0.022,
  headline: 0.018,
  subhead: 0.016,
  body: 0.02,
  icon: 0.022,
  phone: 0,
}

const ORDER: Record<SlideBlockType, number> = {
  chip: 0, icon: 1, headline: 2, subhead: 3, body: 4, phone: 5,
}

function hex(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim()
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback
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
  id: id(name.toLowerCase()),
  name,
  x,
  y,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
})

/**
 * Turn a plan into layers, laid out on the canvas.
 *
 * The words stack from the top (or from under the device, depending on the
 * layout), each measured before the next is placed. The device takes whatever
 * room is left and is centred in it, so the copy never lands on the frame.
 */
export function buildSlideLayers(plan: SlidePlan, canvas: SlideCanvas): Layer[] {
  const { width, height } = canvas
  const margin = width * SIDE_MARGIN
  const contentWidth = width - margin * 2
  const textColor = hex(plan.textColor, '#FFFFFF')
  const accent = hex(plan.accentColor, '#7C6EF6')

  // One of each text role at most, and always in reading order, whatever order
  // the model listed them in. A model that emits two headlines gets one.
  const seen = new Set<SlideBlockType>()
  const blocks = [...plan.blocks]
    .filter((block) => {
      if (block.type === 'phone' && seen.has('phone')) return false
      if (block.type !== 'chip' && block.type !== 'icon' && seen.has(block.type)) return false
      seen.add(block.type)
      return true
    })
    .sort((a, b) => ORDER[a.type] - ORDER[b.type])

  const wantsPhone = plan.layout !== 'text-only' && blocks.some((block) => block.type === 'phone')
  const textBlocks = blocks.filter((block) => block.type !== 'phone')

  const layers: Layer[] = []

  // ── Measure the copy first, so the device can have the rest.
  interface Placed { block: SlideBlock; height: number; gap: number }
  const placed: Placed[] = textBlocks.map((block) => {
    const gap = height * GAP_AFTER[block.type]
    if (block.type === 'icon') return { block, height: width * ICON_SIZE, gap }
    if (block.type === 'chip') return { block, height: width * CHIP_TEXT * 1.25 + width * 0.036, gap }
    const size = width * (block.type === 'headline' ? HEADLINE : block.type === 'subhead' ? SUBHEAD : BODY)
    const family = block.type === 'headline' ? 'Sora' : 'Inter'
    const weight = block.type === 'headline' ? 800 : block.type === 'subhead' ? 600 : 400
    const lineHeight = block.type === 'headline' ? 1.08 : 1.35
    const lines = countWrappedLines(block.text ?? '', family, size, weight, contentWidth)
    return { block, height: size * lineHeight * lines, gap }
  })

  const copyHeight = placed.reduce((total, item) => total + item.height + item.gap, 0)
  const textStartsAtTop = plan.layout !== 'text-below-device'

  // ── The device, sized to whatever the copy left behind.
  let deviceTop = 0
  let deviceHeight = 0
  if (wantsPhone) {
    const available = height - copyHeight - height * TOP_MARGIN * 2
    const spec = getPhoneSpec('iphone-16-pro')
    // Sized to the room the copy left, not to the mockup's natural size. The
    // frames are SVG — a 390×844 drawing on a 1290-wide canvas would sit at a
    // third of the width if it were never scaled up — so the only ceilings
    // that matter are the space below the words and the canvas edges.
    const fit = Math.max(
      MIN_DEVICE_SCALE,
      Math.min(available / spec.frameHeight, (width * MAX_DEVICE_WIDTH) / spec.frameWidth),
    )
    deviceHeight = spec.frameHeight * fit
    deviceTop = textStartsAtTop
      ? height * TOP_MARGIN + copyHeight + (available - deviceHeight) / 2
      : height * TOP_MARGIN + (available - deviceHeight) / 2
    layers.push({
      ...base('Phone', (width - spec.frameWidth * fit) / 2, deviceTop),
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
    } satisfies PhoneLayer)
  }

  // ── The copy.
  let cursor = textStartsAtTop
    ? height * TOP_MARGIN
    : (wantsPhone ? deviceTop + deviceHeight + height * TOP_MARGIN : height * TOP_MARGIN)

  for (const { block, height: blockHeight, gap } of placed) {
    if (block.type === 'chip') {
      const fontSize = width * CHIP_TEXT
      const paddingX = width * 0.028
      const label = block.text?.trim() || 'New'
      const iconName = block.icon && getIconGlyph(block.icon) ? block.icon : undefined
      const iconSize = fontSize
      const iconGap = width * 0.012
      const textWidth = measureChipText(label, 'Inter', fontSize, 700)
      const pillWidth = textWidth + paddingX * 2 + (iconName ? iconSize + iconGap : 0)
      layers.push({
        ...base('Chip', (width - pillWidth) / 2, cursor),
        type: 'chip',
        text: label,
        fontFamily: 'Inter',
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
      } satisfies ChipLayer)
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
    } else {
      const fontSize = width * (block.type === 'headline' ? HEADLINE : block.type === 'subhead' ? SUBHEAD : BODY)
      layers.push({
        ...base(block.type === 'headline' ? 'Headline' : block.type === 'subhead' ? 'Subheading' : 'Body', margin, cursor),
        type: 'text',
        text: block.text?.trim() || '',
        fontFamily: block.type === 'headline' ? 'Sora' : 'Inter',
        fontSize,
        fontWeight: block.type === 'headline' ? 800 : block.type === 'subhead' ? 600 : 400,
        fill: textColor,
        letterSpacing: block.type === 'headline' ? -fontSize * 0.035 : 0,
        lineHeight: block.type === 'headline' ? 1.08 : 1.35,
        align: 'center',
        width: contentWidth,
        // Body copy is the one that carries a paragraph, so it is the one that
        // reads better a shade quieter than the headline above it.
        opacity: block.type === 'body' ? 0.82 : 1,
      } satisfies TextLayer)
    }
    cursor += blockHeight + gap
  }

  return layers
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

/** The canvas a slide group is authored on. */
export function canvasFor(group: SlideGroup): SlideCanvas {
  return { width: group.slideWidth, height: group.slideHeight }
}
