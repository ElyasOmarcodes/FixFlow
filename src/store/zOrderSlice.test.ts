import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'

/**
 * `layers` is painted in array order, so a higher index draws in front and the
 * background owns index 0. These tests are written in those terms: "front"
 * means the end of the array, and nothing may ever displace the background.
 */

function layerIds(): string[] {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)!
  return group.layers.map((l) => l.id)
}

function contentIds(): string[] {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)!
  return group.layers.filter((l) => l.type !== 'background').map((l) => l.id)
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
  // Three stacked shapes: a is furthest back, c is in front.
  const store = useEditorStore.getState()
  store.addShape()
  store.addShape()
  store.addShape()
})

describe('z-order', () => {
  it('starts with the background at the bottom and newest layer in front', () => {
    const { project, activeSlideGroupId } = useEditorStore.getState()
    const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)!
    expect(group.layers[0].type).toBe('background')
    expect(group.layers).toHaveLength(4)
  })

  it('brings a layer one step forward', () => {
    const [a, b, c] = contentIds()
    useEditorStore.getState().bringLayerForward(a)
    expect(contentIds()).toEqual([b, a, c])
  })

  it('sends a layer one step backward', () => {
    const [a, b, c] = contentIds()
    useEditorStore.getState().sendLayerBackward(c)
    expect(contentIds()).toEqual([a, c, b])
  })

  it('brings a layer all the way to the front', () => {
    const [a, b, c] = contentIds()
    useEditorStore.getState().bringLayerToFront(a)
    expect(contentIds()).toEqual([b, c, a])
  })

  it('sends a layer all the way to the back, above the background', () => {
    const [a, b, c] = contentIds()
    useEditorStore.getState().sendLayerToBack(c)
    expect(contentIds()).toEqual([c, a, b])
    expect(layerIds()[0]).not.toBe(c)
  })

  it('never pushes a layer past the background', () => {
    const [a] = contentIds()
    const before = layerIds()
    useEditorStore.getState().sendLayerToBack(a)
    useEditorStore.getState().sendLayerBackward(a)
    expect(layerIds()).toEqual(before)
    const { project, activeSlideGroupId } = useEditorStore.getState()
    const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)!
    expect(group.layers[0].type).toBe('background')
  })

  it('leaves the frontmost layer alone when asked to go further forward', () => {
    const [, , c] = contentIds()
    const before = layerIds()
    useEditorStore.getState().bringLayerForward(c)
    useEditorStore.getState().bringLayerToFront(c)
    expect(layerIds()).toEqual(before)
  })

  it('refuses to reorder the background itself', () => {
    const backgroundId = layerIds()[0]
    const before = layerIds()
    const store = useEditorStore.getState()
    store.bringLayerForward(backgroundId)
    store.bringLayerToFront(backgroundId)
    store.sendLayerBackward(backgroundId)
    store.sendLayerToBack(backgroundId)
    expect(layerIds()).toEqual(before)
  })

  it('ignores an unknown layer id', () => {
    const before = layerIds()
    const store = useEditorStore.getState()
    store.bringLayerForward('nope')
    store.sendLayerToBack('nope')
    expect(layerIds()).toEqual(before)
  })
})
