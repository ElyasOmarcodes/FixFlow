import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Regenerate public/templates/index.json from the template files themselves.
 *
 * The manifest used to be hand-maintained, which meant a template could be
 * edited and its listed slide count quietly go stale. Everything here is read
 * from the file it describes, so the two cannot drift.
 *
 * `preview` is a CSS background built from the first slide's own fill and
 * accent bubbles. The gallery has no rendered thumbnails — producing one means
 * running Konva — and a wall of identical placeholder icons tells the user
 * nothing about which template is which. The real fill does.
 */

const DIR = 'public/templates'

function cssFill(fill) {
  if (typeof fill === 'string') return fill
  const stops = (fill?.stops ?? [])
    .map((stop) => `${stop.color} ${Math.round((stop.offset ?? 0) * 100)}%`)
    .join(', ')
  if (!stops) return '#18181f'
  // Konva measures a linear gradient's angle from the x-axis; CSS measures it
  // from "up" and turns the other way, hence the +90.
  if (fill.type === 'linear') return `linear-gradient(${Math.round((fill.angle ?? 0) + 90)}deg, ${stops})`
  return `radial-gradient(circle at 50% 40%, ${stops})`
}

/** Accents are ellipses placed in percentages, which is exactly what a CSS radial gradient takes. */
function cssAccents(accents, width, height) {
  return (accents ?? []).slice(0, 3).map((accent) => {
    const rx = Math.round((accent.rx / width) * 100)
    const ry = Math.round((accent.ry / height) * 100)
    return `radial-gradient(${rx}% ${ry}% at ${accent.cx}% ${accent.cy}%, ${accent.color}, transparent 70%)`
  })
}

const files = (await readdir(DIR)).filter((name) => name.endsWith('.template.json')).sort()
const templates = []

for (const file of files) {
  const template = JSON.parse(await readFile(path.join(DIR, file), 'utf8'))
  const groups = template.slideGroups ?? []
  const first = groups[0]
  const background = first?.layers?.find((layer) => layer.type === 'background')
  const slides = groups.reduce((total, group) => total + (group.numSlides ?? 1), 0)

  templates.push({
    slug: file.replace('.template.json', ''),
    name: template.name,
    description: template.description ?? '',
    ...(template.category ? { category: template.category } : {}),
    file: `/templates/${file}`,
    slides,
    ...(first ? { previewSize: `${first.slideWidth}×${first.slideHeight}` } : {}),
    ...(background
      ? {
          preview: [
            ...cssAccents(background.accents, first.slideWidth, first.slideHeight),
            cssFill(background.fill),
          ].join(', '),
        }
      : {}),
  })
}

// Keep the authored order of the existing manifest where it still applies, so
// regenerating does not silently reshuffle the gallery.
const previous = JSON.parse(await readFile(path.join(DIR, 'index.json'), 'utf8'))
const order = new Map((previous.templates ?? []).map((entry, index) => [entry.slug, index]))
templates.sort((a, b) => (order.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.slug) ?? Number.MAX_SAFE_INTEGER))

await writeFile(path.join(DIR, 'index.json'), `${JSON.stringify({ schemaVersion: 1, templates }, null, 2)}\n`)
console.log(`Wrote ${templates.length} templates to ${DIR}/index.json`)
