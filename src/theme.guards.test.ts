import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { globSync } from 'node:fs'

/**
 * Guards on the two rules that kept getting broken by hand.
 *
 * Both failures were invisible until someone switched theme or opened a
 * dialog from a mobile sheet, which is exactly the kind of bug a test should
 * catch instead of a user.
 */

/** Chrome files. Canvas nodes paint the user's design, so literals belong there. */
function chromeFiles(): string[] {
  return globSync('src/**/*.tsx').filter((file) => !file.includes(`${path.sep}canvas${path.sep}`))
}

describe('theme tokens', () => {
  it('never hardcodes a translucent-white hairline or fill in the chrome', () => {
    // White at 8% is a visible border over a near-black panel and nothing at
    // all over a white one, so these have to come from a token that inverts.
    const offenders: string[] = []
    for (const file of chromeFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\b(?:border|bg)-(?:\[rgba\(255,\s*255,\s*255[^\]]*\)\]|white\/\d+)/g)) {
        offenders.push(`${file}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never hardcodes a text colour in the chrome', () => {
    // A literal light grey is legible on a near-black panel and almost
    // invisible on a white one — which is what left Help's bold text washed
    // out in light theme. Text colour has to come from a token that inverts.
    const offenders: string[] = []
    for (const file of chromeFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\btext-\[#[0-9a-fA-F]{3,8}\]/g)) {
        offenders.push(`${file}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never hardcodes a dark surface hex in the chrome', () => {
    // Anything this dark is a dark-theme surface; in light theme it is a
    // black hole in the middle of a white panel — which is what the gradient
    // colour block was.
    const offenders: string[] = []
    for (const file of chromeFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\b(?:border|bg)-\[#([0-9a-fA-F]{6})\]/g)) {
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16))
        if (r + g + b < 170) offenders.push(`${file}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('stacking order', () => {
  it('routes every app-level z-index through the scale', () => {
    // A dialog defaulting to z-50 opened *behind* the mobile panels at z-60;
    // other dialogs papered over the same clash with z-[9999]. Small values
    // are left alone: ordering two children inside one component says nothing
    // about where that component sits in the app.
    const LOCAL_MAX = 30
    const offenders: string[] = []
    for (const file of chromeFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const [, value] of source.matchAll(/\bz-(\d+)\b/g)) {
        if (Number(value) > LOCAL_MAX) offenders.push(`${file}: z-${value}`)
      }
      for (const [, value] of source.matchAll(/\bz-\[([^\]]+)\]/g)) {
        if (!value.startsWith('var(--pd-z-')) offenders.push(`${file}: z-[${value}]`)
      }
      for (const [, value] of source.matchAll(/zIndex:\s*([^,\n}]+)/g)) {
        const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
        if (trimmed.startsWith('var(--pd-z-')) continue
        const numeric = Number(trimmed)
        if (Number.isFinite(numeric) && numeric <= LOCAL_MAX) continue
        if (!Number.isFinite(numeric) && !/\d{2,}/.test(trimmed)) continue
        offenders.push(`${file}: zIndex: ${trimmed}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('defines every layer of the scale exactly once', () => {
    const css = readFileSync('src/index.css', 'utf8')
    const defined = [...css.matchAll(/^\s*(--pd-z-[a-z-]+):/gm)].map((m) => m[1])
    expect(new Set(defined).size).toBe(defined.length)
    expect(defined).toContain('--pd-z-modal')
    // A dialog must outrank the sheet it can be opened from.
    const value = (name: string) => Number(css.match(new RegExp(`${name}:\\s*(\\d+)`))![1])
    expect(value('--pd-z-modal')).toBeGreaterThan(value('--pd-z-sheet'))
    expect(value('--pd-z-modal')).toBeGreaterThan(value('--pd-z-more-sheet'))
    expect(value('--pd-z-confirm')).toBeGreaterThan(value('--pd-z-modal'))
    expect(value('--pd-z-splash')).toBeGreaterThan(value('--pd-z-confirm'))
  })
})

describe('switch', () => {
  it('is styled centrally, not per call site', () => {
    // Six style props meant six switches that drifted: one knob stopped short
    // of the track, another was white on white.
    // Read past the comments: the component's own history is described there.
    const component = readFileSync('src/components/ui/ToggleSwitch.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    for (const banned of ['knobClassName', 'checkedClassName', 'uncheckedClassName', 'checkedKnobClassName']) {
      expect(component, banned).not.toContain(banned)
    }
    for (const file of chromeFiles()) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('checkedKnobClassName')
    }
  })
})
