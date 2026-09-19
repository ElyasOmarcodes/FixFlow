import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transportChat } from '@/ai/transport'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { describeCanvas } from './snapshot'
import { isAgentAbort, runAgentTurn } from './runAgent'
import type { TextLayer } from '@/types'

vi.mock('@/ai/transport', () => ({ transportChat: vi.fn(), transportEditImage: vi.fn() }))

const mockedChat = vi.mocked(transportChat)

const auth = { provider: 'openai' as const, apiKey: 'test-key' }

function turn(input: string, extra: Partial<Parameters<typeof runAgentTurn>[0]> = {}) {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return runAgentTurn({
    auth,
    uiLanguage: 'en',
    history: [],
    input,
    canvas: describeCanvas(project, activeSlideGroupId),
    ...extra,
  })
}

function layers() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((group) => group.id === activeSlideGroupId)!.layers
}

/** Queue one model reply per round. */
function replies(...bodies: unknown[]): void {
  mockedChat.mockReset()
  for (const body of bodies) {
    mockedChat.mockResolvedValueOnce(typeof body === 'string' ? body : JSON.stringify(body))
  }
}

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.temporal.getState().clear()
  mockedChat.mockReset()
})

describe('runAgentTurn', () => {
  it('runs the actions and stops when the model says it is done', async () => {
    replies({ say: 'Added a headline.', actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'Built for evenings' } }], status: 'done' })
    const summary = await turn('add a headline')

    expect(summary.rounds).toBe(1)
    expect(summary.said).toEqual(['Added a headline.'])
    expect((layers().find((layer) => layer.type === 'text') as TextLayer).text).toBe('Built for evenings')
    expect(summary.touched).toHaveLength(1)
  })

  it('keeps going while the model asks for another round, feeding it the results', async () => {
    replies(
      { say: 'Reading first.', actions: [{ tool: 'read_slide', args: {} }], status: 'working' },
      { say: 'Now adding it.', actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'Second round' } }], status: 'done' },
    )
    const summary = await turn('put a headline on this')

    expect(summary.rounds).toBe(2)
    expect(summary.calls.map((call) => call.tool)).toEqual(['read_slide', 'add_layer'])
    // The second request must have carried the first round's results.
    const secondCall = mockedChat.mock.calls[1][0]
    const lastMessage = secondCall.messages[secondCall.messages.length - 1]
    expect(String(lastMessage.content)).toContain('read_slide:')
  })

  it('stops at the round cap instead of spending the person\'s credit forever', async () => {
    mockedChat.mockResolvedValue(JSON.stringify({ say: 'Still working.', actions: [{ tool: 'read_slide', args: {} }], status: 'working' }))
    const summary = await turn('do something impossible', { maxRounds: 3 })

    expect(summary.rounds).toBe(3)
    expect(summary.hitRoundCap).toBe(true)
    expect(mockedChat).toHaveBeenCalledTimes(3)
  })

  it('stops and waits when the model asks a question', async () => {
    replies({ say: 'Which slide did you mean?', actions: [], status: 'ask' })
    const summary = await turn('change the headline')

    expect(summary.waitingForAnswer).toBe(true)
    expect(summary.calls).toHaveLength(0)
  })

  it('carries a failed call back to the model rather than ending the turn', async () => {
    replies(
      { say: 'Editing it.', actions: [{ tool: 'update_layer', args: { id: 'ghost', patch: { x: 1 } } }], status: 'working' },
      { say: 'Adding instead.', actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'Recovered' } }], status: 'done' },
    )
    const summary = await turn('move the headline')

    expect(summary.calls[0].failed).toBe(true)
    expect(summary.calls[1].failed).toBe(false)
    expect(layers().some((layer) => layer.type === 'text')).toBe(true)
  })

  it('repairs one unparseable reply before giving up', async () => {
    replies(
      'Sure, I can help with that!',
      { say: 'Done.', actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'Repaired' } }], status: 'done' },
    )
    const summary = await turn('add a headline')
    expect(summary.calls).toHaveLength(1)
    expect(mockedChat).toHaveBeenCalledTimes(2)
  })

  it('gives up when even the repair is not a turn', async () => {
    replies('nope', 'still nope')
    await expect(turn('add a headline')).rejects.toThrow()
  })

  it('refuses write tools in proposal mode but still reads', async () => {
    replies({
      say: 'Here is what I would do.',
      actions: [{ tool: 'read_slide', args: {} }, { tool: 'add_layer', args: { layerType: 'text', text: 'Nope' } }],
      status: 'done',
    })
    const summary = await turn('what would you change?', { readOnly: true })

    expect(summary.calls.map((call) => call.tool)).toEqual(['read_slide'])
    expect(layers().some((layer) => layer.type === 'text')).toBe(false)
  })

  it('tells the model what is selected, because "this" means the selection', async () => {
    replies({ say: 'ok', actions: [], status: 'done' })
    await turn('make this bigger', { selectionIds: ['layer-7'] })
    const message = mockedChat.mock.calls[0][0].messages.at(-1)!
    expect(String(message.content)).toContain('layer-7')
  })

  it('stops between calls when the run is aborted', async () => {
    const controller = new AbortController()
    mockedChat.mockImplementation(async () => {
      controller.abort()
      return JSON.stringify({ say: 'ok', actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'Too late' } }], status: 'done' })
    })
    await turn('add a headline', { signal: controller.signal }).then(
      () => { throw new Error('expected the run to abort') },
      (error) => { expect(isAgentAbort(error)).toBe(true) },
    )
    expect(layers().some((layer) => layer.type === 'text')).toBe(false)
  })

  it('reports each call as it happens, so the panel can show progress', async () => {
    replies({
      say: 'Two things.',
      actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'One' } }, { tool: 'read_slide', args: {} }],
      status: 'done',
    })
    const events: string[] = []
    await turn('do two things', { onEvent: (event) => events.push(event.type) })
    expect(events).toEqual(['round', 'say', 'tool', 'tool'])
  })
})
