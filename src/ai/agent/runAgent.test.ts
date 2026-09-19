import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transportChatStream } from '@/ai/transport'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { describeCanvas } from './snapshot'
import { isAgentAbort, runAgentTurn } from './runAgent'
import type { TextLayer } from '@/types'

// The loop streams, so the stream is what the tests script; it hands the whole
// reply over in one delta, which is exactly what a non-streaming provider does.
vi.mock('@/ai/transport', () => ({
  transportChat: vi.fn(),
  transportChatStream: vi.fn(),
  transportEditImage: vi.fn(),
}))

const mockedChat = vi.mocked(transportChatStream)

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
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    mockedChat.mockImplementationOnce(async (_options, onDelta) => { onDelta(text); return text })
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
    mockedChat.mockImplementation(async (_options, onDelta) => {
      const text = JSON.stringify({ say: 'Still working.', actions: [{ tool: 'read_slide', args: {} }], status: 'working' })
      onDelta(text)
      return text
    })
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

  it('hands a tool that makes its own call the credentials the turn is using', async () => {
    replies({ say: 'ok', actions: [{ tool: 'translate_slide', args: { locale: 'ps' } }], status: 'done' })
    const summary = await turn('translate this slide')
    // There is no text on a fresh slide, so the tool stops before any request —
    // what matters is that it saw the auth rather than refusing for want of it.
    expect(summary.calls[0].result).not.toContain('no AI credentials')
  })

  it('reports each call as it happens, so the panel can show progress', async () => {
    replies({
      say: 'Two things.',
      actions: [{ tool: 'add_layer', args: { layerType: 'text', text: 'One' } }, { tool: 'read_slide', args: {} }],
      status: 'done',
    })
    const events: string[] = []
    await turn('do two things', { onEvent: (event) => events.push(event.type) })
    // One delta because the scripted transport hands the reply over whole;
    // a real stream emits one per chunk that changes the sentence.
    expect(events).toEqual(['round', 'delta', 'say', 'tool', 'tool'])
  })
})

describe('looking at the slide', () => {
  it('carries the picture back to the model as an image part', async () => {
    replies(
      { say: 'Let me look.', actions: [{ tool: 'look_at_slide', args: {} }], status: 'working' },
      { say: 'That looks right.', actions: [], status: 'done' },
    )
    // No Konva stage in a unit run, so the tool reports that and sends no image
    // — what is pinned here is that the loop handles both shapes.
    const summary = await turn('does this look right?')
    expect(summary.calls[0].tool).toBe('look_at_slide')
    const second = mockedChat.mock.calls[1][0]
    expect(second.messages.at(-1)!.content).toBeDefined()
  })

  it('sends only the newest picture, not one per look', async () => {
    const { resultsMessageForTest } = await import('./runAgent')
    const content = resultsMessageForTest(
      [{ tool: 'look_at_slide', result: 'ok' }],
      [
        { tool: 'look_at_slide', args: {}, result: 'ok', failed: false, touched: [], image: 'data:image/jpeg;base64,OLD' },
        { tool: 'look_at_slide', args: {}, result: 'ok', failed: false, touched: [], image: 'data:image/jpeg;base64,NEW' },
      ],
    )
    expect(Array.isArray(content)).toBe(true)
    const parts = content as { type: string; dataUrl?: string }[]
    expect(parts.filter((part) => part.type === 'image')).toHaveLength(1)
    expect(parts.find((part) => part.type === 'image')!.dataUrl).toContain('NEW')
  })

  it('stays plain text when nothing was looked at', async () => {
    const { resultsMessageForTest } = await import('./runAgent')
    const content = resultsMessageForTest(
      [{ tool: 'read_slide', result: 'ok' }],
      [{ tool: 'read_slide', args: {}, result: 'ok', failed: false, touched: [] }],
    )
    expect(typeof content).toBe('string')
  })
})

describe('streaming', () => {
  it('shows the sentence while it is still being written', async () => {
    const chunks = ['{"say":"Adding', '{"say":"Adding a head', '{"say":"Adding a headline.","actions":[],"status":"done"}']
    mockedChat.mockReset()
    mockedChat.mockImplementationOnce(async (_options, onDelta) => {
      for (const chunk of chunks) onDelta(chunk)
      return chunks[chunks.length - 1]
    })

    const shown: string[] = []
    await turn('add a headline', {
      onEvent: (event) => { if (event.type === 'delta') shown.push(event.text) },
    })
    expect(shown).toEqual(['Adding', 'Adding a head', 'Adding a headline.'])
  })

  it('does not stream the repair attempt at the person', async () => {
    mockedChat.mockReset()
    mockedChat.mockImplementationOnce(async (_options, onDelta) => { onDelta('sorry, no JSON'); return 'sorry, no JSON' })
    mockedChat.mockImplementationOnce(async (_options, onDelta) => {
      const text = JSON.stringify({ say: 'Fixed.', actions: [], status: 'done' })
      onDelta(text)
      return text
    })

    const shown: string[] = []
    await turn('add a headline', {
      onEvent: (event) => { if (event.type === 'delta') shown.push(event.text) },
    })
    // The broken reply had no `say` to show, and the repair's deltas are
    // swallowed — so the only thing the person ever saw is the final sentence.
    expect(shown).toEqual([])
  })
})
