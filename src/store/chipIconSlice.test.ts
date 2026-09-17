import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import { getLocalizableLayers } from '@/utils/locale'
import type { ChipLayer, IconLayer } from '@/types'

function lastLayer() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)!
  return group.layers[group.layers.length - 1]
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('addChip', () => {
  it('inserts one chip layer, not a group of parts', () => {
    useEditorStore.getState().addChip()
    const layer = lastLayer()
    expect(layer.type).toBe('chip')
    // The whole point of the layer type: a chip is atomic, so entering it does
    // not drop the user into a group with a rect and a text inside.
    expect(layer).not.toHaveProperty('children')
  })

  it('selects the new chip and points the panel at its content tab', () => {
    useEditorStore.getState().addChip()
    const state = useEditorStore.getState()
    expect(state.selection?.layerId).toBe(lastLayer().id)
    expect(state.pendingContentFocusLayerId).toBe(lastLayer().id)
  })

  it('carries a label that the localization view can find', () => {
    useEditorStore.getState().addChip()
    const chip = lastLayer() as ChipLayer
    const refs = getLocalizableLayers(useEditorStore.getState().project)
    expect(refs.some((ref) => ref.layerId === chip.id && ref.layerType === 'chip')).toBe(true)
  })
})

describe('addIcon', () => {
  it('defaults to a bundled library glyph', () => {
    useEditorStore.getState().addIcon()
    const icon = lastLayer() as IconLayer
    expect(icon.type).toBe('icon')
    expect(icon.icon).toBe('star')
    expect(icon.customPath).toBeUndefined()
  })

  it('takes a named library glyph', () => {
    useEditorStore.getState().addIcon({ name: 'rocket' })
    expect((lastLayer() as IconLayer).icon).toBe('rocket')
  })

  it('stores a fetched symbol’s own geometry, so it never refetches', () => {
    useEditorStore.getState().addIcon({
      name: 'material:rocket_launch',
      path: 'M10 10h5',
      viewBox: '0 -960 960 960',
      filled: true,
    })
    const icon = lastLayer() as IconLayer
    expect(icon.customPath).toBe('M10 10h5')
    expect(icon.customViewBox).toBe('0 -960 960 960')
    expect(icon.customFilled).toBe(true)
  })

  it('names the layer readably rather than by its raw id', () => {
    useEditorStore.getState().addIcon({ name: 'material:rocket_launch', path: 'M0 0h1' })
    expect(lastLayer().name).toBe('rocket launch')
  })

  it('is one undo step', () => {
    useEditorStore.getState().addIcon()
    expect(lastLayer().type).toBe('icon')
    useEditorStore.temporal.getState().undo()
    expect(lastLayer().type).not.toBe('icon')
  })
})
