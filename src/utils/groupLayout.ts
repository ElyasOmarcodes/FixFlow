import { estimateLayerBox, estimateGroupBox } from '@/components/canvas/GroupNode.geometry'
import type { CanvasFormatId, Layer, LayoutDelta, ProjectSettings, SlideGroup } from '@/types'
import { bakeLayerScale } from '@/store/helpers'
import { CANVAS_FORMAT_PRESETS, getProjectBaseFormat, getFormatScaleFactor, resolveGroupView, applyLayoutDelta } from './canvasFormats'
import { mapLayerTree } from './layerTree'

type Transform = { x: number; y: number; scale: number; rotation: number }
const identity: Transform = { x: 0, y: 0, scale: 1, rotation: 0 }
const keys = ['x', 'y', 'rotation', 'scale', 'width', 'height', 'fontSize', 'letterSpacing', 'cornerRadius', 'strokeWidth', 'logoSize', 'nameFontSize', 'gap', 'model', 'opacity', 'visible', 'shadow', 'blur'] as const
export function transformChild(layer: Layer, parent: Transform, inverse = false): Layer {
  const angle = parent.rotation * Math.PI / 180 * (inverse ? -1 : 1)
  const box = estimateLayerBox(layer)
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const x = inverse ? cx - parent.x : cx * parent.scale
  const y = inverse ? cy - parent.y : cy * parent.scale
  const out = bakeLayerScale(layer, inverse ? 1 / parent.scale : parent.scale)
  return { ...out, x: (x * Math.cos(angle) - y * Math.sin(angle)) / (inverse ? parent.scale : 1) + (inverse ? 0 : parent.x) - (box.w / 2 + box.x - layer.x) * (inverse ? 1 / parent.scale : parent.scale), y: (x * Math.sin(angle) + y * Math.cos(angle)) / (inverse ? parent.scale : 1) + (inverse ? 0 : parent.y) - (box.h / 2 + box.y - layer.y) * (inverse ? 1 / parent.scale : parent.scale), rotation: layer.rotation + (inverse ? -parent.rotation : parent.rotation) }
}
export function groupTransform(layer: Extract<Layer, { type: 'group' }>): Transform {
  const box = estimateGroupBox({ ...layer, x: 0, y: 0 })
  const scale = layer.scale ?? 1, angle = layer.rotation * Math.PI / 180
  const cx = (box.x + box.w / 2) * scale, cy = (box.y + box.h / 2) * scale
  return { x: layer.x + cx - cx * Math.cos(angle) + cy * Math.sin(angle), y: layer.y + cy - cx * Math.sin(angle) - cy * Math.cos(angle), scale, rotation: layer.rotation }
}
function world(layers: Layer[], parent = identity, result = new Map<string, Layer>()) {
  for (const layer of layers) {
    const absolute = transformChild(layer, parent)
    result.set(layer.id, absolute)
    if (absolute.type === 'group') world(layer.type === 'group' ? layer.children : [], groupTransform(absolute), result)
  }
  return result
}
function layout(layer: Layer): Partial<Layer> {
  const record = layer as unknown as Record<string, unknown>
  return Object.fromEntries(keys.filter((key) => record[key] !== undefined).map((key) => [key, record[key]])) as Partial<Layer>
}
/** Reparenting is structural: preserve every existing format and locale's rendered geometry. */
export function preserveGroupLayout(before: SlideGroup, after: SlideGroup, settings: ProjectSettings, ids: Set<string>): SlideGroup {
  const base = getProjectBaseFormat({ settings })
  const formats = [...new Set<CanvasFormatId>([base, ...CANVAS_FORMAT_PRESETS.map((f) => f.id), ...(settings.customFormats ?? []).map((f) => f.id)])]
  const locale = settings.defaultLocale
  const parents = new Map<string, string>()
  for (const layer of after.layers) if (layer.type === 'group') for (const child of layer.children) parents.set(child.id, layer.id)
  let result = after
  const target = (format: CanvasFormatId, language: string) => {
    const oldWorld = world(resolveGroupView(before, settings, language, format).layers)
    const newWorld = world(resolveGroupView(result, settings, language, format).layers)
    const targets = new Map<string, Layer>()
    for (const id of ids) {
      const original = oldWorld.get(id)
      if (!original) continue
      const parentId = parents.get(id)
      const parent = parentId ? newWorld.get(parentId) : undefined
      targets.set(id, parent?.type === 'group' ? transformChild(original, groupTransform(parent), true) : original)
    }
    return targets
  }
  for (const format of formats) {
    const desired = target(format, locale)
    const resolved = new Map<string, Layer>()
    mapLayerTree(resolveGroupView(result, settings, locale, format).layers, (layer) => { resolved.set(layer.id, layer); return layer })
    result = { ...result, layers: mapLayerTree(result.layers, (layer) => {
      const value = desired.get(layer.id)
      if (!value) return layer
      const current = resolved.get(layer.id) as unknown as Record<string, unknown> | undefined
      const patch = Object.fromEntries(Object.entries(layout(value)).filter(([key, item]) => typeof item === 'number' && typeof current?.[key] === 'number' ? Math.abs(item - (current[key] as number)) > 1e-7 : JSON.stringify(item) !== JSON.stringify(current?.[key])))
      if (!Object.keys(patch).length) return layer
      return format === base ? { ...layer, ...patch } as Layer : { ...layer, formatOverrides: { ...layer.formatOverrides, [format]: { ...layer.formatOverrides?.[format], ...patch } } } as Layer
    }) }
  }
  // Recompute locale deltas against the preserved default geometry; base deltas compose with format deltas.
  for (const language of settings.locales ?? []) {
    if (language === locale) continue
    result = { ...result, layers: mapLayerTree(result.layers, (layer) => ids.has(layer.id) ? { ...layer, localeAdjust: { ...layer.localeAdjust, [language]: {} } } : layer) }
    for (const format of formats) {
      const desired = target(format, language)
      const baseline = new Map<string, Layer>()
      mapLayerTree(resolveGroupView(result, settings, locale, format).layers, (layer) => { baseline.set(layer.id, layer); return layer })
      result = { ...result, layers: mapLayerTree(result.layers, (layer) => {
        const want = desired.get(layer.id), initial = baseline.get(layer.id)
        if (!want || !initial) return layer
        const current = format === base ? initial : applyLayoutDelta(initial, layer.localeAdjust?.[language]?.base, getFormatScaleFactor(result, format, base, settings.customFormats))
        const delta: LayoutDelta = { dx: want.x - current.x, dy: want.y - current.y, dRotation: want.rotation - current.rotation }
        for (const [property, key] of [['width', 'mWidth'], ['height', 'mHeight'], ['fontSize', 'mFontSize'], ['scale', 'mScale']] as const) {
          const a = (want as unknown as Record<string, number>)[property], b = (current as unknown as Record<string, number>)[property]
          if (typeof a === 'number' && typeof b === 'number' && b !== 0) delta[key] = a / b
        }
        return { ...layer, localeAdjust: { ...layer.localeAdjust, [language]: { ...layer.localeAdjust?.[language], [format === base ? 'base' : format]: delta } } }
      }) }
    }
  }
  return result
}
