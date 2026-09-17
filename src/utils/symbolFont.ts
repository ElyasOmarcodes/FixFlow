import type { SymbolStyle, SymbolWeight } from './materialSymbols'

/**
 * The Material Symbols font, loaded once so the whole catalogue can be shown.
 *
 * The picker used to draw each cell as an `<img>` from Google's per-icon SVG
 * endpoint. That is one network request per visible icon, so the grid had to
 * be capped at 120 and a person could not see what they were choosing from —
 * and on a slow connection the cells stayed blank.
 *
 * One font instance is ~320 KB and carries every one of the 4,403 glyphs, so
 * the entire catalogue renders instantly and offline once it has been fetched
 * a single time. Each glyph is its own name as a ligature: the text "rocket"
 * in this family draws the rocket.
 *
 * The font is only for *browsing*. What lands on the canvas is still the
 * chosen icon's path geometry, so an exported PNG does not depend on a font
 * being installed, and the headless exporter needs nothing extra.
 */

const FAMILY: Record<SymbolStyle, string> = {
  outlined: 'Material Symbols Outlined',
  rounded: 'Material Symbols Rounded',
  sharp: 'Material Symbols Sharp',
}

export function symbolFontFamily(style: SymbolStyle): string {
  return FAMILY[style]
}

const loaded = new Map<string, Promise<boolean>>()

/**
 * Fetch one instance of the family. Resolves with whether it can be drawn.
 *
 * Fixed axis values rather than the variable font: the full variable face is
 * 3.8 MB, a fixed instance is ~320 KB, and the picker only ever shows one
 * combination at a time. Switching weight or fill fetches the next instance,
 * which the browser then caches.
 *
 * The resolved boolean is what the caller must trust — not
 * `document.fonts.check`, which answers true when *no* face matches the
 * family, so a blocked stylesheet reads as "nothing left to load" and the
 * grid renders 4,403 icon names as text.
 */
export function loadSymbolFont(style: SymbolStyle, weight: SymbolWeight, filled: boolean): Promise<boolean> {
  const key = `${style}:${weight}:${filled ? 1 : 0}`
  const existing = loaded.get(key)
  if (existing) return existing

  const family = FAMILY[style].replace(/ /g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${family}:opsz,wght,FILL,GRAD@24,${weight},${filled ? 1 : 0},0&display=swap`

  const promise = new Promise<boolean>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    // Resolve either way: a blocked or offline font must leave the grid on
    // the image previews rather than leaving the caller waiting forever.
    link.addEventListener('load', () => {
      // `document.fonts.load` is what actually pulls the file; the stylesheet
      // alone only declares the face. It resolves with the faces it loaded,
      // which is the honest answer to "can this be drawn".
      const spec = `24px "${FAMILY[style]}"`
      document.fonts.load(spec, 'home').then(
        (faces) => resolve(faces.length > 0),
        () => resolve(false),
      )
    })
    link.addEventListener('error', () => resolve(false))
    document.head.append(link)
  })

  loaded.set(key, promise)
  return promise
}

/**
 * Whether the font actually draws this name, rather than spelling it out.
 *
 * Google's published index carries a handful of names the font has no
 * ligature for — `workspace_studio` and `youtube_video` among them. A missing
 * ligature is not a blank cell: the family includes Latin letterforms, so the
 * name is rendered as text, in caps, several times wider than the cell, which
 * looks like the grid has broken.
 *
 * Measuring catches it exactly. A resolved ligature is one glyph on a 24-unit
 * advance; a name drawn letter by letter is far wider. Those few cells fall
 * back to the image endpoint, which does have the artwork.
 */
const ONE_GLYPH_MAX_PX = 30

let measureContext: CanvasRenderingContext2D | null | undefined
const glyphCache = new Map<string, boolean>()

export function symbolRendersAsGlyph(
  style: SymbolStyle,
  weight: SymbolWeight,
  filled: boolean,
  name: string,
): boolean {
  const key = `${style}:${weight}:${filled ? 1 : 0}:${name}`
  const cached = glyphCache.get(key)
  if (cached !== undefined) return cached

  if (measureContext === undefined) {
    measureContext = typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d')
  }
  // No canvas to measure with: assume the glyph is there rather than sending
  // the whole grid to the slow path.
  if (!measureContext) return true

  measureContext.font = `${weight} 24px "${FAMILY[style]}"`
  const rendered = measureContext.measureText(name).width <= ONE_GLYPH_MAX_PX
  glyphCache.set(key, rendered)
  return rendered
}

/** Test hook. */
export function resetSymbolFontCache(): void {
  loaded.clear()
  glyphCache.clear()
}
