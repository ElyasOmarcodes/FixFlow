import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import { getLocalizableLayers } from '@/utils/locale'
import { migrateProject } from '@/store/helpers'
import type { ChipLayer, IconLayer, Project } from '@/types'

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

describe('chip icon side', () => {
  it('defaults a new chip to a left-hand glyph', () => {
    useEditorStore.getState().addChip()
    expect((lastLayer() as ChipLayer).iconPosition).toBe('left')
  })

  it('migrates a project that stored start/end', () => {
    // 'start'/'end' read as writing-direction-relative but always meant
    // physically left/right, because the design canvas is pinned LTR.
    useEditorStore.getState().addChip()
    const { project } = useEditorStore.getState()
    const group = project.slideGroups.find((g) => g.id === useEditorStore.getState().activeSlideGroupId)!
    const legacy = {
      ...project,
      settings: { ...project.settings, schemaVersion: 3 },
      slideGroups: project.slideGroups.map((g) => g.id !== group.id ? g : {
        ...g,
        layers: g.layers.map((layer) => layer.type !== 'chip'
          ? layer
          : ({ ...layer, iconPosition: 'end' } as unknown as typeof layer)),
      }),
    } as Project

    const migrated = migrateProject(JSON.parse(JSON.stringify(legacy)) as Project)
    const chip = migrated.slideGroups
      .flatMap((g) => g.layers)
      .find((layer) => layer.type === 'chip') as ChipLayer
    expect(chip.iconPosition).toBe('right')
  })
})

describe('icon backing plate', () => {
  it('leaves the glyph where it is when a plate is added', () => {
    // The plate grows outward from the glyph. It used to be the other way
    // round — the layer origin was the plate's corner and the glyph was inset
    // by the padding — so switching a plate on appeared to move and resize
    // the icon.
    useEditorStore.getState().addIcon()
    const before = lastLayer() as IconLayer
    useEditorStore.getState().updateLayer(before.id, {
      background: '#ffffff',
      backgroundPadding: 40,
    } as Partial<IconLayer>)
    const after = lastLayer() as IconLayer
    expect({ x: after.x, y: after.y, size: after.size, rotation: after.rotation })
      .toEqual({ x: before.x, y: before.y, size: before.size, rotation: before.rotation })
  })

  it('leaves everything alone when only the corner radius changes', () => {
    useEditorStore.getState().addIcon()
    const id = lastLayer().id
    useEditorStore.getState().updateLayer(id, { background: '#ffffff', backgroundPadding: 30 } as Partial<IconLayer>)
    const before = lastLayer() as IconLayer
    useEditorStore.getState().updateLayer(id, { backgroundRadius: 120 } as Partial<IconLayer>)
    const after = lastLayer() as IconLayer
    expect({ x: after.x, y: after.y, size: after.size, rotation: after.rotation, pad: after.backgroundPadding })
      .toEqual({ x: before.x, y: before.y, size: before.size, rotation: before.rotation, pad: before.backgroundPadding })
  })

  it('migrates a plated icon so it lands where it was drawn', () => {
    useEditorStore.getState().addIcon()
    const { project } = useEditorStore.getState()
    const legacy = {
      ...project,
      settings: { ...project.settings, schemaVersion: 4 },
      slideGroups: project.slideGroups.map((group) => ({
        ...group,
        layers: group.layers.map((layer) => layer.type !== 'icon'
          ? layer
          : ({ ...layer, x: 100, y: 200, background: '#fff', backgroundPadding: 30 } as typeof layer)),
      })),
    } as Project

    const migrated = migrateProject(JSON.parse(JSON.stringify(legacy)) as Project)
    const icon = migrated.slideGroups.flatMap((g) => g.layers).find((l) => l.type === 'icon') as IconLayer
    // Old origin was the plate corner, so the glyph was at 130,230 — which is
    // where the new origin has to be for the design to look unchanged.
    expect({ x: icon.x, y: icon.y }).toEqual({ x: 130, y: 230 })
  })

  it('leaves an unplated icon\u2019s position alone', () => {
    useEditorStore.getState().addIcon()
    const { project } = useEditorStore.getState()
    const legacy = { ...project, settings: { ...project.settings, schemaVersion: 4 } } as Project
    const before = legacy.slideGroups.flatMap((g) => g.layers).find((l) => l.type === 'icon') as IconLayer
    const migrated = migrateProject(JSON.parse(JSON.stringify(legacy)) as Project)
    const icon = migrated.slideGroups.flatMap((g) => g.layers).find((l) => l.type === 'icon') as IconLayer
    expect({ x: icon.x, y: icon.y }).toEqual({ x: before.x, y: before.y })
  })
})
