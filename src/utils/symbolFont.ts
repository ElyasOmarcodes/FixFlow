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

const loaded = new Map<string, Promise<void>>()

/**
 * Fetch one instance of the family.
 *
 * Fixed axis values rather than the variable font: the full variable face is
 * 3.8 MB, a fixed instance is ~320 KB, and the picker only ever shows one
 * combination at a time. Switching weight or fill fetches the next instance,
 * which the browser then caches.
 */
export function loadSymbolFont(style: SymbolStyle, weight: SymbolWeight, filled: boolean): Promise<void> {
  const key = `${style}:${weight}:${filled ? 1 : 0}`
  const existing = loaded.get(key)
  if (existing) return existing

  const family = FAMILY[style].replace(/ /g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${family}:opsz,wght,FILL,GRAD@24,${weight},${filled ? 1 : 0},0&display=swap`

  const promise = new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    // Resolve either way: a blocked or offline font must leave the grid
    // showing names rather than leaving the caller waiting forever.
    link.addEventListener('load', () => {
      // `document.fonts.load` is what actually pulls the file; the stylesheet
      // alone only declares the face.
      const spec = `24px "${FAMILY[style]}"`
      void document.fonts.load(spec, 'home').catch(() => {}).finally(() => resolve())
    })
    link.addEventListener('error', () => resolve())
    document.head.append(link)
  })

  loaded.set(key, promise)
  return promise
}

/** Test hook. */
export function resetSymbolFontCache(): void {
  loaded.clear()
}
