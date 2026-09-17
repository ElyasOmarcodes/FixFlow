/**
 * Chip geometry.
 *
 * A chip's box is *derived*, never stored: the pill is exactly as wide as its
 * icon, gap, label and padding require. That is the whole reason chips stopped
 * being a shape-plus-text group — the background could not follow the label, so
 * renaming a chip left the text hanging out of its own pill.
 *
 * Pure and unit-free: the caller supplies a measured label width, so this can
 * be tested without a canvas or a font.
 */

/** The 24x24 grid every library glyph is drawn on. */
export const ICON_GRID = 24

export interface ChipLayoutInput {
  /** Rendered width of the label, in px, at its final font size. */
  textWidth: number
  fontSize: number
  paddingX: number
  paddingY: number
  /** Omit for a label-only chip. */
  iconSize?: number
  iconGap?: number
  iconPosition?: 'start' | 'end'
}

export interface ChipLayout {
  width: number
  height: number
  /** Top-left of the icon's 24x24 box, or null when there is no icon. */
  iconX: number | null
  iconY: number
  /** Scale to apply to a 24x24 glyph so it renders at `iconSize`. */
  iconScale: number
  textX: number
  /** Top of the label's line box. */
  textY: number
  /** Height of the label's line box, used to centre it. */
  textHeight: number
}

/**
 * Line box for a label.
 *
 * 1.25x the font size rather than the font's own metrics: ascender and
 * descender depths vary wildly between the Latin and Arabic-script faces this
 * editor ships, and a chip whose height changed when the language changed
 * would break every localised layout. A fixed ratio keeps the pill the same
 * height in every locale.
 */
export function chipLineHeight(fontSize: number): number {
  return fontSize * 1.25
}

export function layoutChip(input: ChipLayoutInput): ChipLayout {
  const {
    textWidth,
    fontSize,
    paddingX,
    paddingY,
    iconSize = 0,
    iconGap = 0,
    iconPosition = 'start',
  } = input

  const hasIcon = iconSize > 0
  const textHeight = chipLineHeight(fontSize)
  // The pill is as tall as the taller of its two contents.
  const contentHeight = Math.max(textHeight, hasIcon ? iconSize : 0)
  const gap = hasIcon && textWidth > 0 ? iconGap : 0
  const contentWidth = textWidth + (hasIcon ? iconSize + gap : 0)

  const width = contentWidth + paddingX * 2
  const height = contentHeight + paddingY * 2

  // Each piece is centred on the content band, so an icon larger than the text
  // (or the other way round) never sits on the baseline of the other.
  const textY = paddingY + (contentHeight - textHeight) / 2
  const iconY = paddingY + (contentHeight - iconSize) / 2

  let iconX: number | null = null
  let textX: number

  if (!hasIcon) {
    textX = paddingX
  } else if (iconPosition === 'start') {
    iconX = paddingX
    textX = paddingX + iconSize + gap
  } else {
    textX = paddingX
    iconX = paddingX + textWidth + gap
  }

  return {
    width,
    height,
    iconX,
    iconY,
    iconScale: hasIcon ? iconSize / ICON_GRID : 1,
    textX,
    textY,
    textHeight,
  }
}

/**
 * Label width, measured on a shared offscreen canvas.
 *
 * Cached by the full font spec + text: a chip re-measures on every render while
 * it is being typed into, and `measureText` is the slowest thing in that path.
 */
const measureCache = new Map<string, number>()
let measureContext: CanvasRenderingContext2D | null | undefined

export function measureChipText(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
): number {
  if (!text) return 0
  const key = `${fontWeight} ${fontSize}px ${fontFamily}|${text}`
  const cached = measureCache.get(key)
  if (cached !== undefined) return cached

  if (measureContext === undefined) {
    measureContext = typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) {
    // No canvas (tests, headless export before mount): approximate from the
    // font size so layout stays sane rather than collapsing to zero.
    return text.length * fontSize * 0.55
  }

  measureContext.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`
  const width = measureContext.measureText(text).width
  // Bounded so a pathological project cannot grow this without limit.
  if (measureCache.size > 5000) measureCache.clear()
  measureCache.set(key, width)
  return width
}
