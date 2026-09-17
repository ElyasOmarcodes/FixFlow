import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { ICON_LIBRARY } from '@/assets/icons/library'
import type { Layer, Template } from '@/types'

/**
 * Guards on the templates shipped in public/templates.
 *
 * These are data, so nothing else typechecks them: a renamed icon or a mark
 * offset shifted by an edited headline produces a template that loads happily
 * and renders wrong. The store screenshot is the product here, so it is worth
 * failing the build over.
 */

const DIR = 'public/templates'
const files = readdirSync(DIR).filter((name) => name.endsWith('.template.json')).sort()
const LIBRARY = new Set(ICON_LIBRARY.map((glyph) => glyph.name))

const templates = files.map((file) => ({
  file,
  template: JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as Template,
}))

/** Every layer, including the ones nested inside groups. */
function flatten(layers: Layer[]): Layer[] {
  return layers.flatMap((layer) => (layer.type === 'group' ? [layer, ...flatten(layer.children)] : [layer]))
}

describe('bundled templates', () => {
  it('ships the gallery the manifest lists', () => {
    const manifest = JSON.parse(readFileSync(path.join(DIR, 'index.json'), 'utf8')) as {
      templates: { slug: string; file: string; slides: number }[]
    }
    expect(manifest.templates.map((entry) => `${entry.slug}.template.json`).sort()).toEqual(files)

    for (const entry of manifest.templates) {
      const found = templates.find((item) => item.file === `${entry.slug}.template.json`)!
      const slides = found.template.slideGroups.reduce((total, group) => total + (group.numSlides ?? 1), 0)
      // A stale slide count is what the manifest generator exists to prevent.
      expect(slides, entry.slug).toBe(entry.slides)
    }
  })

  it.each(templates)('$file names a canvas size on every slide group', ({ template }) => {
    expect(template.slideGroups.length).toBeGreaterThan(0)
    for (const group of template.slideGroups) {
      expect(group.slideWidth).toBeGreaterThan(0)
      expect(group.slideHeight).toBeGreaterThan(0)
      expect(group.numSlides).toBeGreaterThanOrEqual(1)
      expect(group.slideNames).toHaveLength(group.numSlides)
    }
  })

  it.each(templates)('$file draws every icon from the bundled library', ({ template }) => {
    for (const group of template.slideGroups) {
      for (const layer of flatten(group.layers)) {
        if (layer.type === 'icon' && !layer.customPath) {
          expect(LIBRARY, layer.icon).toContain(layer.icon)
        }
        // A chip's glyph is stroked inline with its label, so it can only come
        // from the bundled library — there is no custom-path escape hatch.
        if (layer.type === 'chip' && layer.icon) {
          expect(LIBRARY, layer.icon).toContain(layer.icon)
        }
      }
    }
  })

  it.each(templates)('$file keeps every text mark inside its own text', ({ template }) => {
    for (const group of template.slideGroups) {
      for (const layer of flatten(group.layers)) {
        if (layer.type !== 'text' || !layer.marks) continue
        for (const mark of layer.marks) {
          expect(mark.start, layer.name).toBeGreaterThanOrEqual(0)
          expect(mark.end, layer.name).toBeGreaterThan(mark.start)
          expect(mark.end, layer.name).toBeLessThanOrEqual(layer.text.length)
        }
      }
    }
  })

  it.each(templates)('$file starts every layer inside the canvas', ({ template }) => {
    for (const group of template.slideGroups) {
      const width = group.slideWidth * group.numSlides
      for (const layer of group.layers) {
        // Devices are allowed to bleed off the bottom edge — that is the house
        // style — so this checks the origin, not the full bounding box.
        expect(layer.x, `${group.name}/${layer.name}`).toBeGreaterThanOrEqual(0)
        expect(layer.x, `${group.name}/${layer.name}`).toBeLessThan(width)
        expect(layer.y, `${group.name}/${layer.name}`).toBeGreaterThanOrEqual(0)
        expect(layer.y, `${group.name}/${layer.name}`).toBeLessThan(group.slideHeight)
      }
    }
  })

  it.each(templates)('$file locks exactly one background per slide group', ({ template }) => {
    for (const group of template.slideGroups) {
      const backgrounds = group.layers.filter((layer) => layer.type === 'background')
      expect(backgrounds, group.name).toHaveLength(1)
      expect(backgrounds[0].locked, group.name).toBe(true)
      // The background is painted first, so it has to be first in the array.
      expect(group.layers[0].type, group.name).toBe('background')
    }
  })

  it.each(templates)('$file gives every layer in a slide group a unique id', ({ template }) => {
    for (const group of template.slideGroups) {
      const ids = flatten(group.layers).map((layer) => layer.id)
      expect(new Set(ids).size, group.name).toBe(ids.length)
    }
  })
})
