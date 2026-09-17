import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { collectCanvasTexts } from './translateCanvas'
import type { ChipLayer, GroupLayer, TextLayer } from '@/types'

function activeGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('collectCanvasTexts', () => {
  it('finds text layers, chip labels and both inside a group', () => {
    const store = useEditorStore.getState()
    store.addText()
    const headline = activeGroup().layers.at(-1) as TextLayer
    store.updateLayer(headline.id, { text: 'Track your habits' })

    store.addChip()
    const chip = activeGroup().layers.at(-1) as ChipLayer
    store.updateLayer(chip.id, { text: 'New' } as Partial<ChipLayer>)

    store.addText()
    const nested = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(nested.id, { text: 'Inside a group' })
    store.addText()
    const alsoNested = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(alsoNested.id, { text: 'Also inside' })
    useEditorStore.getState().createGroup([nested.id, alsoNested.id])

    const found = collectCanvasTexts(activeGroup())
    const byId = new Map(found.map((item) => [item.layerId, item]))

    expect(byId.get(headline.id)?.text).toBe('Track your habits')
    expect(byId.get(headline.id)?.type).toBe('text')
    expect(byId.get(chip.id)?.text).toBe('New')
    expect(byId.get(chip.id)?.type).toBe('chip')

    const groupLayer = activeGroup().layers.find((l) => l.type === 'group') as GroupLayer
    expect(byId.get(nested.id)?.parentGroupId).toBe(groupLayer.id)
  })

  it('skips layers with nothing written on them', () => {
    const store = useEditorStore.getState()
    store.addText()
    const empty = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(empty.id, { text: '   ' })

    expect(collectCanvasTexts(activeGroup()).some((item) => item.layerId === empty.id)).toBe(false)
  })
})

describe('applyCanvasTranslations', () => {
  it('rewrites text and chip layers, nested ones included, in one undo step', () => {
    const store = useEditorStore.getState()
    store.addText()
    const headline = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(headline.id, { text: 'Track your habits' })

    store.addChip()
    const chip = activeGroup().layers.at(-1) as ChipLayer
    useEditorStore.getState().updateLayer(chip.id, { text: 'New' } as Partial<ChipLayer>)

    store.addText()
    const nested = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(nested.id, { text: 'Inside a group' })
    store.addText()
    const alsoNested = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(alsoNested.id, { text: 'Also inside' })
    useEditorStore.getState().createGroup([nested.id, alsoNested.id])

    const groupId = activeGroup().id
    const before = useEditorStore.temporal.getState().pastStates.length

    useEditorStore.getState().applyCanvasTranslations([
      { slideGroupId: groupId, layerId: headline.id, text: 'خپل عادتونه وڅاره' },
      { slideGroupId: groupId, layerId: chip.id, text: 'نوی' },
      { slideGroupId: groupId, layerId: nested.id, text: 'د ګروپ دننه' },
    ])

    const find = (id: string) => {
      for (const layer of activeGroup().layers) {
        if (layer.id === id) return layer
        if (layer.type === 'group') {
          const child = (layer as GroupLayer).children.find((c) => c.id === id)
          if (child) return child
        }
      }
      return undefined
    }

    expect((find(headline.id) as TextLayer).text).toBe('خپل عادتونه وڅاره')
    expect((find(chip.id) as ChipLayer).text).toBe('نوی')
    expect((find(nested.id) as TextLayer).text).toBe('د ګروپ دننه')

    // One `set`, so the whole pass costs exactly one history entry.
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before + 1)

    useEditorStore.temporal.getState().undo()
    expect((find(headline.id) as TextLayer).text).toBe('Track your habits')
    expect((find(chip.id) as ChipLayer).text).toBe('New')
  })

  it('writes into the locale’s content rather than over the source language', () => {
    const store = useEditorStore.getState()
    store.addText()
    const headline = activeGroup().layers.at(-1) as TextLayer
    useEditorStore.getState().updateLayer(headline.id, { text: 'Track your habits' })

    useEditorStore.getState().addLocale('ps')
    useEditorStore.getState().setActiveLocale('ps')

    useEditorStore.getState().applyCanvasTranslations([
      { slideGroupId: activeGroup().id, layerId: headline.id, text: 'خپل عادتونه وڅاره' },
    ])

    const layer = activeGroup().layers.find((l) => l.id === headline.id) as TextLayer
    // The base layer still holds the source; the translation is locale content.
    expect(layer.text).toBe('Track your habits')
    expect(layer.localeContent?.ps?.text).toBe('خپل عادتونه وڅاره')
  })
})
