import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import { runTool } from '@/ai/agent/tools'
import type { TextLayer } from '@/types'

function layers() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((group) => group.id === activeSlideGroupId)!.layers
}

const historyDepth = () => useEditorStore.temporal.getState().pastStates.length

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
})

describe('an assistant turn is one undo step', () => {
  it('records a single entry however many layers the turn touched', async () => {
    const store = useEditorStore.getState()
    store.beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'One' })
    await runTool('add_layer', { layerType: 'text', text: 'Two' })
    await runTool('add_layer', { layerType: 'icon', icon: 'star' })
    await runTool('set_background', { fill: '#101020' })
    const changed = useEditorStore.getState().endAgentTurn()

    expect(changed).toBe(true)
    expect(historyDepth()).toBe(1)
    expect(layers().filter((layer) => layer.type === 'text')).toHaveLength(2)
  })

  it('puts the canvas back exactly as it was on one undo', async () => {
    useEditorStore.getState().addText()
    const before = layers().length
    useEditorStore.temporal.getState().clear()

    useEditorStore.getState().beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'From the assistant' })
    await runTool('add_layer', { layerType: 'chip', text: 'New' })
    useEditorStore.getState().endAgentTurn()
    expect(layers().length).toBe(before + 2)

    useEditorStore.temporal.getState().undo()
    expect(layers().length).toBe(before)
    expect(layers().some((layer) => (layer as TextLayer).text === 'From the assistant')).toBe(false)
  })

  it('records nothing when the turn only read', async () => {
    useEditorStore.getState().beginAgentTurn()
    await runTool('read_slide', {})
    await runTool('read_project', {})
    expect(useEditorStore.getState().endAgentTurn()).toBe(false)
    expect(historyDepth()).toBe(0)
  })

  it('rolls a failed turn back without leaving half a change behind', async () => {
    const before = layers().length
    useEditorStore.getState().beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'Half done' })
    await runTool('set_background', { fill: '#FF0000' })
    useEditorStore.getState().rollbackAgentTurn()

    expect(layers().length).toBe(before)
    expect(historyDepth()).toBe(0)
  })

  it('leaves history recording again after the turn, so ordinary edits still undo', async () => {
    useEditorStore.getState().beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'Turn' })
    useEditorStore.getState().endAgentTurn()
    useEditorStore.getState().addText()
    expect(historyDepth()).toBe(2)
  })

  it('resumes history after a rollback too', async () => {
    useEditorStore.getState().beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'Turn' })
    useEditorStore.getState().rollbackAgentTurn()
    useEditorStore.getState().addText()
    expect(historyDepth()).toBe(1)
  })

  it('does not nest: a second begin while one is open is ignored', async () => {
    const store = useEditorStore.getState()
    store.beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'First' })
    store.beginAgentTurn()
    await runTool('add_layer', { layerType: 'text', text: 'Second' })
    useEditorStore.getState().endAgentTurn()

    // Both layers belong to the one turn, and undoing it removes both.
    expect(historyDepth()).toBe(1)
    useEditorStore.temporal.getState().undo()
    expect(layers().some((layer) => layer.type === 'text')).toBe(false)
  })

  it('reports the turn as open while it runs, so the UI can show it', async () => {
    expect(useEditorStore.getState().agentTurnActive).toBe(false)
    useEditorStore.getState().beginAgentTurn()
    expect(useEditorStore.getState().agentTurnActive).toBe(true)
    useEditorStore.getState().endAgentTurn()
    expect(useEditorStore.getState().agentTurnActive).toBe(false)
  })
})
