import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { AGENT_TOOLS, runTool } from './tools'
import type { ChipLayer, GroupLayer, Layer, TextLayer } from '@/types'

function group() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((entry) => entry.id === activeSlideGroupId)!
}

function layers(): Layer[] {
  return group().layers
}

/** Add a layer through the tool under test and hand back its id. */
function add(args: Record<string, unknown>): string {
  const before = new Set(layers().map((layer) => layer.id))
  const result = runTool('add_layer', args)
  expect(result.failed, result.result).toBe(false)
  return layers().find((layer) => !before.has(layer.id))!.id
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('the tool catalogue', () => {
  it('documents every tool, because the prompt is generated from it', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.summary, tool.name).toBeTruthy()
      expect(tool.args, tool.name).toBeTruthy()
      expect(tool.name).toMatch(/^[a-z_]+$/)
    }
  })

  it('has no two tools with the same name', () => {
    const names = AGENT_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('failures come back as text, not exceptions', () => {
  it('reports an unknown tool with the list of real ones', () => {
    const result = runTool('make_it_pretty', {})
    expect(result.failed).toBe(true)
    expect(result.result).toContain('add_layer')
  })

  it('reports an unknown layer id and says how to find the real ones', () => {
    const result = runTool('update_layer', { id: 'nope', patch: { x: 10 } })
    expect(result.failed).toBe(true)
    expect(result.result).toContain('read_slide')
  })

  it('reports a glyph that is not in the library', () => {
    expect(runTool('add_layer', { layerType: 'icon', icon: 'unicorn' }).failed).toBe(true)
  })

  it('reports a layer type it cannot build', () => {
    expect(runTool('add_layer', { layerType: 'hologram' }).failed).toBe(true)
  })
})

describe('add_layer', () => {
  it('builds a text layer and sizes it against the canvas, not a fixed guess', () => {
    const id = add({ layerType: 'text', text: 'Built for long evenings' })
    const text = layers().find((layer) => layer.id === id) as TextLayer
    expect(text.type).toBe('text')
    expect(text.fontSize).toBeCloseTo(group().slideWidth * 0.07, 0)
  })

  it('reads numbers sent as strings, which models do constantly', () => {
    const id = add({ layerType: 'text', text: 'Hello', x: '120', fontSize: '64' })
    const text = layers().find((layer) => layer.id === id) as TextLayer
    expect(text.x).toBe(120)
    expect(text.fontSize).toBe(64)
  })

  it('puts a chip together with its glyph', () => {
    const id = add({ layerType: 'chip', text: 'New', icon: 'zap', iconPosition: 'right' })
    const chip = layers().find((layer) => layer.id === id) as ChipLayer
    expect(chip.icon).toBe('zap')
    expect(chip.iconPosition).toBe('right')
  })

  it('fits a phone to the slide rather than trusting a guessed scale', () => {
    const id = add({ layerType: 'phone' })
    const phone = layers().find((layer) => layer.id === id)!
    expect(phone.type).toBe('phone')
    expect(phone.y).toBeGreaterThan(0)
    expect(phone.x).toBeGreaterThanOrEqual(0)
  })
})

describe('update_layer', () => {
  it('applies the keys a layer type owns', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    const result = runTool('update_layer', { id, patch: { text: 'Goodbye', fontSize: 80 } })
    expect(result.failed).toBe(false)
    const text = layers().find((layer) => layer.id === id) as TextLayer
    expect(text.text).toBe('Goodbye')
    expect(text.fontSize).toBe(80)
  })

  it('refuses the structural fields, which would corrupt the layer silently', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    const result = runTool('update_layer', { id, patch: { type: 'shape', localeContent: {}, formatOverrides: {} } })
    expect(result.failed).toBe(true)
    expect(layers().find((layer) => layer.id === id)!.type).toBe('text')
  })

  it('applies the good keys and names the ones it dropped', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    const result = runTool('update_layer', { id, patch: { fontSize: 70, children: [] } })
    expect(result.failed).toBe(false)
    expect(result.result).toContain('children')
    expect((layers().find((layer) => layer.id === id) as TextLayer).fontSize).toBe(70)
  })

  it('reaches a layer inside a group', () => {
    const a = add({ layerType: 'text', text: 'One' })
    const b = add({ layerType: 'text', text: 'Two' })
    runTool('group_layers', { ids: [a, b] })
    const result = runTool('update_layer', { id: a, patch: { text: 'Changed' } })
    expect(result.failed, result.result).toBe(false)
    const groupLayer = layers().find((layer) => layer.type === 'group') as GroupLayer
    expect((groupLayer.children.find((child) => child.id === a) as TextLayer).text).toBe('Changed')
  })
})

describe('move, delete, duplicate and order', () => {
  it('moves by an offset as well as to a point', () => {
    const id = add({ layerType: 'text', text: 'Hello', x: 100, y: 100 })
    runTool('move_layer', { id, dx: 40, dy: -20 })
    const layer = layers().find((entry) => entry.id === id)!
    expect([layer.x, layer.y]).toEqual([140, 80])
  })

  it('will not delete the background, because the editor requires one', () => {
    const background = layers().find((layer) => layer.type === 'background')!
    const result = runTool('delete_layer', { id: background.id })
    expect(result.failed).toBe(true)
    expect(layers().some((layer) => layer.type === 'background')).toBe(true)
  })

  it('deletes a layer and reports which one', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    expect(runTool('delete_layer', { id }).failed).toBe(false)
    expect(layers().some((layer) => layer.id === id)).toBe(false)
  })

  it('duplicates and names the new id, so the next call can address it', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    const result = runTool('duplicate_layer', { id })
    const copy = layers().filter((layer) => layer.type === 'text')
    expect(copy).toHaveLength(2)
    expect(result.result).toContain(copy.find((layer) => layer.id !== id)!.id)
  })

  it('brings a layer to the front', () => {
    const first = add({ layerType: 'text', text: 'One' })
    add({ layerType: 'text', text: 'Two' })
    runTool('reorder_layer', { id: first, to: 'front' })
    expect(layers()[layers().length - 1].id).toBe(first)
  })
})

describe('group_layers', () => {
  it('needs at least two layers to have something to group', () => {
    const id = add({ layerType: 'text', text: 'Alone' })
    expect(runTool('group_layers', { ids: [id] }).failed).toBe(true)
  })

  it('groups, names, and then ungroups again', () => {
    const a = add({ layerType: 'text', text: 'One' })
    const b = add({ layerType: 'icon', icon: 'star' })
    const grouped = runTool('group_layers', { ids: [a, b], name: 'Feature card' })
    expect(grouped.failed, grouped.result).toBe(false)
    const created = layers().find((layer) => layer.type === 'group') as GroupLayer
    expect(created.name).toBe('Feature card')
    expect(created.children).toHaveLength(2)

    expect(runTool('ungroup_layer', { id: created.id }).failed).toBe(false)
    expect(layers().some((layer) => layer.type === 'group')).toBe(false)
  })
})

describe('align_layers', () => {
  it('lines layers up on the left edge of the slide', () => {
    const a = add({ layerType: 'shape', x: 300, width: 200, height: 100 })
    const b = add({ layerType: 'shape', x: 700, width: 200, height: 100 })
    const result = runTool('align_layers', { ids: [a, b], edge: 'left' })
    expect(result.failed, result.result).toBe(false)
    expect(layers().filter((layer) => [a, b].includes(layer.id)).map((layer) => layer.x)).toEqual([0, 0])
  })

  it('centres against the canvas using each layer\'s own width', () => {
    const a = add({ layerType: 'shape', x: 0, width: 200, height: 100 })
    const b = add({ layerType: 'shape', x: 0, width: 600, height: 100 })
    runTool('align_layers', { ids: [a, b], edge: 'centerX' })
    const centre = (id: string) => {
      const layer = layers().find((entry) => entry.id === id) as { x: number; width: number }
      return layer.x + layer.width / 2
    }
    expect(centre(a)).toBeCloseTo(group().slideWidth / 2, 0)
    expect(centre(b)).toBeCloseTo(group().slideWidth / 2, 0)
  })

  it('rejects an edge it does not know', () => {
    const a = add({ layerType: 'shape' })
    expect(runTool('align_layers', { ids: [a], edge: 'sideways' }).failed).toBe(true)
  })
})

describe('reading tools', () => {
  it('describes the slide with ids the write tools accept', () => {
    const id = add({ layerType: 'text', text: 'Readable' })
    const result = runTool('read_slide', {})
    expect(result.result).toContain(id)
    expect(result.result).toContain('Readable')
  })

  it('marks which slide group is being edited', () => {
    const result = runTool('read_project', {})
    expect(result.result).toContain(useEditorStore.getState().activeSlideGroupId)
    expect(result.result).toContain('*')
  })

  it('searches the glyph names', () => {
    expect(runTool('list_icons', { query: 'moon' }).result).toContain('moon')
    expect(runTool('list_icons', { query: 'zzzz' }).result).toContain('No glyph')
  })
})

describe('set_background and select_layers', () => {
  it('repaints the background with a gradient', () => {
    const fill = { type: 'linear', angle: 120, stops: [{ offset: 0, color: '#101020' }, { offset: 1, color: '#2A1A5E' }] }
    expect(runTool('set_background', { fill }).failed).toBe(false)
    const background = layers().find((layer) => layer.type === 'background') as { fill: unknown }
    expect(background.fill).toEqual(fill)
  })

  it('rejects a fill that is neither a colour nor a gradient', () => {
    expect(runTool('set_background', { fill: 42 }).failed).toBe(true)
  })

  it('selects layers so the person can see what is being discussed', () => {
    const a = add({ layerType: 'text', text: 'One' })
    const b = add({ layerType: 'text', text: 'Two' })
    runTool('select_layers', { ids: [a, b] })
    expect(useEditorStore.getState().selectedLayerIds).toEqual([a, b])
    runTool('select_layers', { ids: [] })
    expect(useEditorStore.getState().selection).toBeNull()
  })
})

describe('touched layers', () => {
  it('reports a new layer, so the canvas can flash it', () => {
    const before = new Set(layers().map((layer) => layer.id))
    const result = runTool('add_layer', { layerType: 'text', text: 'Fresh' })
    const created = layers().find((layer) => !before.has(layer.id))!
    expect(result.touched).toContain(created.id)
  })

  it('reports an edited layer', () => {
    const id = add({ layerType: 'text', text: 'Hello' })
    expect(runTool('update_layer', { id, patch: { fontSize: 50 } }).touched).toEqual([id])
  })
})
