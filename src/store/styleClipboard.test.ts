import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import { STYLE_KEYS } from './helpers'
import type { ChipLayer, IconLayer, LayerType } from '@/types'

function layers() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!.layers
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('style clipboard', () => {
  it('covers every layer type', () => {
    // A type with no entry copies an empty style, so pasting silently does
    // nothing — which is exactly what icon and chip did.
    const types: LayerType[] = ['background', 'phone', 'text', 'image', 'shape', 'emoji', 'brand', 'group', 'chip', 'icon']
    for (const type of types) {
      expect(STYLE_KEYS[type], type).toBeDefined()
      expect(STYLE_KEYS[type]!.length, type).toBeGreaterThan(0)
    }
  })

  it('carries an icon’s look from one layer to another', () => {
    const store = useEditorStore.getState()
    store.addIcon({ name: 'star' })
    const source = layers().at(-1) as IconLayer
    store.updateLayer(source.id, {
      color: '#ff0000', size: 200, strokeWidth: 6,
      background: '#00ff00', backgroundPadding: 40, backgroundRadius: 12,
    } as Partial<IconLayer>)

    store.addIcon({ name: 'heart' })
    const target = layers().at(-1) as IconLayer

    useEditorStore.getState().copyLayerStyle(source.id)
    useEditorStore.getState().pasteLayerStyle(target.id)

    const pasted = layers().find((l) => l.id === target.id) as IconLayer
    expect(pasted.color).toBe('#ff0000')
    expect(pasted.size).toBe(200)
    expect(pasted.background).toBe('#00ff00')
    expect(pasted.backgroundPadding).toBe(40)
    // The glyph is content, not style: it must survive a style paste.
    expect(pasted.icon).toBe('heart')
  })

  it('carries a chip’s look without overwriting its label', () => {
    const store = useEditorStore.getState()
    store.addChip()
    const source = layers().at(-1) as ChipLayer
    store.updateLayer(source.id, {
      text: 'Source', textColor: '#112233', fill: '#445566',
      cornerRadius: 8, paddingX: 50, fontWeight: 800,
    } as Partial<ChipLayer>)

    store.addChip()
    const target = layers().at(-1) as ChipLayer
    store.updateLayer(target.id, { text: 'Target' } as Partial<ChipLayer>)

    useEditorStore.getState().copyLayerStyle(source.id)
    useEditorStore.getState().pasteLayerStyle(target.id)

    const pasted = layers().find((l) => l.id === target.id) as ChipLayer
    expect(pasted.textColor).toBe('#112233')
    expect(pasted.fill).toBe('#445566')
    expect(pasted.cornerRadius).toBe(8)
    expect(pasted.paddingX).toBe(50)
    expect(pasted.fontWeight).toBe(800)
    expect(pasted.text).toBe('Target')
  })

  it('refuses to paste across layer types', () => {
    const store = useEditorStore.getState()
    store.addIcon()
    const icon = layers().at(-1) as IconLayer
    store.addChip()
    const chip = layers().at(-1) as ChipLayer

    useEditorStore.getState().copyLayerStyle(icon.id)
    useEditorStore.getState().pasteLayerStyle(chip.id)

    const after = layers().find((l) => l.id === chip.id) as ChipLayer
    expect(after.type).toBe('chip')
    expect(after.text).toBe(chip.text)
  })
})
