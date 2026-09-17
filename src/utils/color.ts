/**
 * Colour maths for the picker.
 *
 * Kept apart from the React component so the conversions can be tested
 * directly: a picker that drifts a hue by a degree on every round trip is the
 * kind of bug that only shows up after a user has dragged the handle twenty
 * times, and it is much easier to catch here than on screen.
 *
 * Hex in, hex out. Everything the editor stores is a 6-digit hex string (or a
 * brand token, which never reaches this file), because that is what the
 * exporters — browser and headless alike — can both read without surprises.
 */

export interface Hsv {
  /** Degrees, 0–360. */
  h: number
  /** 0–1. */
  s: number
  /** 0–1. */
  v: number
}

export interface Rgb { r: number; g: number; b: number }

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Coerce anything colour-ish into `#RRGGBB`.
 *
 * Accepts the shorthand and `rgb()`/`rgba()` because those are what a person
 * pastes in from a design tool. Anything else returns the fallback rather
 * than a half-parsed colour: a field that silently turns a typo into black is
 * worse than one that keeps the old value.
 */
export function normalizeHex(value: string, fallback = '#FFFFFF'): string {
  const raw = value.trim()
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  // An 8-digit hex keeps its colour and loses its alpha: layers carry opacity
  // as their own property, so there is nowhere for the fourth channel to go.
  if (/^#[0-9a-f]{8}$/i.test(withHash)) return withHash.slice(0, 7).toUpperCase()
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(raw)
  if (rgb) return rgbToHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) })
  return fallback.toUpperCase()
}

export function hexToRgb(hex: string): Rgb {
  const safe = normalizeHex(hex)
  return {
    r: Number.parseInt(safe.slice(1, 3), 16),
    g: Number.parseInt(safe.slice(3, 5), 16),
    b: Number.parseInt(safe.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const red = clamp(r, 0, 255) / 255
  const green = clamp(g, 0, 255) / 255
  const blue = clamp(b, 0, 255) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6
    else if (max === green) h = (blue - red) / delta + 2
    else h = (red - green) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 1)
  const value = clamp(v, 0, 1)
  const c = value * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = value - c

  let rgb: [number, number, number]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  }
}

export function hexToHsv(hex: string): Hsv {
  return rgbToHsv(hexToRgb(hex))
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv))
}

/**
 * Relative luminance, per WCAG.
 *
 * Used to decide whether a swatch needs a light or a dark tick drawn on it —
 * a white checkmark on `#FFFDE7` is invisible, and a person then cannot tell
 * which swatch they picked.
 */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Whether text or a tick drawn on this colour should be dark. */
export function prefersDarkInk(hex: string): boolean {
  return luminance(hex) > 0.45
}
