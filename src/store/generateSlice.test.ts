import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import { buildSlideLayers, backgroundFillFor, canvasFor, resetSlidePlanIds, type SlidePlan } from '@/utils/slidePlan'
import type { BackgroundLayer } from '@/types'

function group() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

const plan: SlidePlan = {
  backgroundFrom: '#101020',
  backgroundTo: '#2A1A5E',
  textColor: '#FFFFFF',
  accentColor: '#7C6EF6',
  layout: 'text-above-device',
  blocks: [
    { type: 'chip', text: 'New', icon: 'star' },
    { type: 'headline', text: 'Track every habit' },
    { type: 'phone' },
  ],
}

const slide = () => ({
  layers: buildSlideLayers(plan, canvasFor(group())),
  background: backgroundFillFor(plan),
})

beforeEach(() => {
  resetSlidePlanIds()
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('applyGeneratedSlide', () => {
  it('places the slide and repaints the background', () => {
    useEditorStore.getState().applyGeneratedSlide(slide())
    const layers = group().layers
    expect(layers.map((l) => l.type)).toEqual(['background', 'phone', 'chip', 'text'])
    const background = layers[0] as BackgroundLayer
    expect(typeof background.fill === 'object' && background.fill.stops[0].color).toBe('#101020')
  })

  it('keeps the background layer even when replacing, because the editor needs one', () => {
    const store = useEditorStore.getState()
    store.addText()
    store.addChip()
    useEditorStore.getState().applyGeneratedSlide(slide(), { replace: true })
    expect(group().layers.filter((l) => l.type === 'background')).toHaveLength(1)
    // The hand-made layers are gone; only the generated ones remain.
    expect(group().layers.filter((l) => l.type === 'text')).toHaveLength(1)
  })

  it('adds on top of what is there when asked not to replace', () => {
    useEditorStore.getState().addText()
    const before = group().layers.length
    useEditorStore.getState().applyGeneratedSlide(slide(), { replace: false })
    expect(group().layers.length).toBe(before + 3)
  })

  it('is one undo step for the whole slide', () => {
    const before = useEditorStore.temporal.getState().pastStates.length
    useEditorStore.getState().applyGeneratedSlide(slide())
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before + 1)

    useEditorStore.temporal.getState().undo()
    expect(group().layers.map((l) => l.type)).toEqual(['background'])
  })

  it('clears a selection that pointed at a layer it just removed', () => {
    const store = useEditorStore.getState()
    store.addText()
    const textId = group().layers.at(-1)!.id
    useEditorStore.getState().select(textId)
    useEditorStore.getState().applyGeneratedSlide(slide(), { replace: true })
    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
  })

  it('produces layers the editor can already render and edit', () => {
    useEditorStore.getState().applyGeneratedSlide(slide())
    // Every generated layer is a normal layer: it has an id the store can find
    // and the fields its own properties panel reads.
    for (const layer of group().layers) {
      expect(layer.id, layer.type).toBeTruthy()
      expect(typeof layer.x, layer.type).toBe('number')
      expect(typeof layer.opacity, layer.type).toBe('number')
      expect(layer.visible, layer.type).toBe(true)
    }
    const chipId = group().layers.find((l) => l.type === 'chip')!.id
    useEditorStore.getState().updateLayer(chipId, { text: 'Edited' } as never)
    expect((group().layers.find((l) => l.id === chipId) as { text: string }).text).toBe('Edited')
  })
})
