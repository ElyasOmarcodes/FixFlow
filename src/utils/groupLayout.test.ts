import { beforeEach, expect, it } from 'vitest'
import { useEditorStore } from '@/store'
import { resolveGroupView } from './canvasFormats'
import { estimateGroupBox } from '@/components/canvas/GroupNode.geometry'
import type { CanvasFormatId, GroupLayer, Layer, ShapeLayer } from '@/types'
const formats: CanvasFormatId[] = ['base', 'android-phone', 'ipad-13']
const active = () => useEditorStore.getState().project.slideGroups[0]
function geometry(layer: Layer, parent?: GroupLayer) {
  const item = layer as ShapeLayer
  if (!parent) return [item.x, item.y, item.width, item.height, item.rotation]
  const box = estimateGroupBox({ ...parent, x: 0, y: 0 }), scale = parent.scale ?? 1
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, angle = parent.rotation * Math.PI / 180
  const x = (item.x + item.width / 2 - cx) * scale, y = (item.y + item.height / 2 - cy) * scale
  return [parent.x + cx * scale + x * Math.cos(angle) - y * Math.sin(angle) - item.width * scale / 2, parent.y + cy * scale + x * Math.sin(angle) + y * Math.cos(angle) - item.height * scale / 2, item.width * scale, item.height * scale, item.rotation + parent.rotation]
}
function snapshot() {
  const settings = useEditorStore.getState().project.settings
  return formats.flatMap((format) => ['en', 'fa'].map((locale) => {
    const resolved = resolveGroupView(active(), settings, locale, format)
    const rows: Record<string, number[]> = {}
    for (const layer of resolved.layers) {
      if (layer.type === 'group') for (const child of layer.children) rows[child.id] = geometry(child, layer)
      else if (layer.type === 'shape') rows[layer.id] = geometry(layer)
    }
    return rows
  }))
}
function same(before: ReturnType<typeof snapshot>) {
  const after = snapshot()
  before.forEach((view, i) => Object.entries(view).forEach(([id, values]) => values.forEach((value, key) => expect(after[i][id][key]).toBeCloseTo(value, 5))))
}
beforeEach(() => {
  const store = useEditorStore.getState()
  store.resetProject(); store.updateSettings({ defaultLocale: 'en', locales: ['en', 'fa'] })
  for (let i = 0; i < 3; i++) store.addShape()
  const layers = active().layers.filter((item) => item.type === 'shape')
  layers.forEach((item, i) => store.updateLayer(item.id, { x: 160 + i * 320, y: 430 + i * 170, width: 180, height: 240, rotation: 5 * i, formatOverrides: { 'android-phone': { x: 70 + i * 220, y: 200 + i * 250, width: 160 + i * 20 } as Partial<ShapeLayer> }, localeAdjust: { fa: { base: { dx: 23, dy: -16 }, 'android-phone': { dx: 12, mWidth: 1.2 } } } }))
})
it('grouping and ungrouping preserve all formats/locales and unrelated layers', () => {
  const before = snapshot(), store = useEditorStore.getState()
  store.createGroup(active().layers.filter((l) => l.type === 'shape').slice(0, 2).map((l) => l.id))
  same(before)
  store.dissolveGroup(active().layers.find((l) => l.type === 'group')!.id)
  same(before)
})
it('ungrouping a rotated and scaled group preserves the rendered child centers and sizes', () => {
  const store = useEditorStore.getState()
  store.createGroup(active().layers.filter((l) => l.type === 'shape').slice(0, 2).map((l) => l.id))
  const id = active().layers.find((l) => l.type === 'group')!.id
  store.updateLayer(id, { rotation: 33, scale: 1.4 })
  const before = snapshot()
  store.dissolveGroup(id)
  same(before)
})
