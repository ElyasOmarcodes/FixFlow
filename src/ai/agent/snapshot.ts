import type { ChipLayer, IconLayer, ImageLayer, Layer, PhoneLayer, Project, ShapeLayer, SlideGroup, TextLayer } from '@/types'

/**
 * What the agent is looking at.
 *
 * The model cannot be handed the project document: a single slide group with
 * three feature cards serialises to several thousand tokens of ids, locale
 * mirrors, format overrides and gradient stops, most of which it must never
 * write anyway. This builds the short form — one line per layer, carrying the
 * id it needs to address the layer and the handful of properties that decide
 * what the design looks like.
 *
 * Positions are rounded: a model asked to nudge a headline does not benefit
 * from `x: 183.42718`, and the extra digits are pure token cost.
 */

const MAX_TEXT = 90

function round(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT)}…` : flat
}

/** A fill is either a colour or a gradient; the model only ever needs to read which. */
function describeFill(fill: unknown): string {
  if (typeof fill === 'string') return fill
  if (fill && typeof fill === 'object' && 'stops' in fill) {
    const gradient = fill as { type?: string; stops?: { color?: string }[] }
    const colours = (gradient.stops ?? []).map((stop) => stop.color ?? '?').join('→')
    return `${gradient.type ?? 'linear'} ${colours}`
  }
  return ''
}

function describeLayer(layer: Layer, depth: number): string {
  const indent = '  '.repeat(depth)
  const parts: string[] = [`${indent}- ${layer.id} ${layer.type}`]
  const at = `at ${round(layer.x)},${round(layer.y)}`

  switch (layer.type) {
    case 'text': {
      const text = layer as TextLayer
      parts.push(`"${clip(text.text)}"`, at, `size ${round(text.fontSize)}`, `weight ${text.fontWeight}`,
        `font ${text.fontFamily}`, `fill ${describeFill(text.fill)}`)
      if (text.width) parts.push(`width ${round(text.width)}`)
      if (text.align !== 'left') parts.push(`align ${text.align}`)
      break
    }
    case 'chip': {
      const chip = layer as ChipLayer
      parts.push(`"${clip(chip.text)}"`, at, `size ${round(chip.fontSize)}`, `fill ${describeFill(chip.fill)}`)
      if (chip.icon) parts.push(`icon ${chip.icon} (${chip.iconPosition})`)
      break
    }
    case 'icon': {
      const icon = layer as IconLayer
      parts.push(`glyph ${icon.icon}`, at, `size ${round(icon.size)}`, `colour ${icon.color}`)
      if (icon.background) parts.push(`plate ${describeFill(icon.background)}`)
      break
    }
    case 'shape': {
      const shape = layer as ShapeLayer
      parts.push(shape.shapeType, at, `${round(shape.width)}×${round(shape.height)}`,
        `fill ${describeFill(shape.fill)}`, `radius ${round(shape.cornerRadius)}`)
      break
    }
    case 'phone': {
      const phone = layer as PhoneLayer
      parts.push(phone.model, at, `scale ${phone.scale.toFixed(2)}`)
      parts.push(phone.screenshotPath || phone.screenshotDataUrl ? 'has screenshot' : 'no screenshot')
      break
    }
    case 'image': {
      const image = layer as ImageLayer
      parts.push(at, `${round(image.width)}×${round(image.height)}`)
      break
    }
    case 'background':
      parts.push(`fill ${describeFill((layer as { fill?: unknown }).fill)}`)
      break
    case 'group':
      parts.push(`"${layer.name}"`, at, `${(layer as { children: Layer[] }).children.length} children`)
      break
    default:
      parts.push(at)
  }

  if (layer.visible === false) parts.push('HIDDEN')
  if (layer.locked) parts.push('LOCKED')
  if (layer.rotation) parts.push(`rotated ${round(layer.rotation)}°`)

  const line = parts.join(' ')
  if (layer.type !== 'group') return line
  // A group's children are addressed by their own ids, so they have to be
  // listed — an agent told "there is a card" but not what is in it can only
  // delete and rebuild it.
  const children = (layer as { children: Layer[] }).children
    .map((child) => describeLayer(child, depth + 1))
    .join('\n')
  return children ? `${line}\n${children}` : line
}

/** One slide group, layer by layer, in paint order (first line = bottom). */
export function describeSlideGroup(group: SlideGroup): string {
  const canvas = `canvas ${group.slideWidth}×${group.slideHeight}${group.numSlides > 1 ? ` × ${group.numSlides} slides (panorama, total width ${group.slideWidth * group.numSlides})` : ''}`
  const layers = group.layers.map((layer) => describeLayer(layer, 0)).join('\n')
  return [`Slide group "${group.name}" (${group.id})`, canvas, 'Layers, bottom to top:', layers || '- (empty)'].join('\n')
}

/** The whole document at a glance: settings, and one line per slide group. */
export function describeProject(project: Project, activeSlideGroupId: string): string {
  const { settings } = project
  const groups = project.slideGroups.map((group) => {
    const marker = group.id === activeSlideGroupId ? '* ' : '  '
    return `${marker}${group.id} "${group.name}" ${group.slideWidth}×${group.slideHeight}${group.numSlides > 1 ? ` ×${group.numSlides}` : ''} ${group.layers.length} layers`
  }).join('\n')
  const brand = settings.brandColors?.length
    ? settings.brandColors.map((colour) => `${colour.name}=${colour.value}`).join(', ')
    : 'none'
  return [
    `Project "${project.name}"`,
    `Brand: ${settings.brandName || 'unnamed'} · brand colours: ${brand}`,
    `Locales: ${(settings.locales ?? [settings.defaultLocale]).join(', ')} (default ${settings.defaultLocale})`,
    'Slide groups (* = the one being edited):',
    groups,
  ].join('\n')
}

/** Both halves, which is what a turn opens with. */
export function describeCanvas(project: Project, activeSlideGroupId: string): string {
  const group = project.slideGroups.find((item) => item.id === activeSlideGroupId)
  return [
    describeProject(project, activeSlideGroupId),
    '',
    group ? describeSlideGroup(group) : 'No slide group is active.',
  ].join('\n')
}
