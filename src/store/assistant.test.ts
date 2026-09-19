import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAssistantStore, clampWidth } from './assistant'
import { idbStorage } from './idb-storage'
import type { AssistantMessage } from './assistant'

/**
 * The transcript is kept per project, in IndexedDB, and deliberately not in the
 * project document. These pin the two things that make that safe: what is
 * stored (never a second copy of the project, never a captured image) and what
 * is restored (never an undo offer for a history that no longer exists).
 */

const store = new Map<string, string>()

vi.mock('./idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn(async (key: string) => { store.delete(key) }),
  },
}))

function message(patch: Partial<AssistantMessage> = {}): AssistantMessage {
  return { id: 'm1', role: 'assistant', text: 'Added a headline.', at: 1, ...patch }
}

/** Put a thread straight into storage, as a previous session would have left it. */
function seed(projectId: string, messages: AssistantMessage[]): void {
  store.set(`pixeldeck-chat:${projectId}`, JSON.stringify(messages))
}

beforeEach(() => {
  store.clear()
  vi.mocked(idbStorage.setItem).mockClear()
  useAssistantStore.setState({ projectId: null, messages: [], busy: false, controller: null, highlight: null })
})

describe('per-project threads', () => {
  it('loads the thread the project was left with', async () => {
    seed('project-a', [message({ text: 'From an earlier session' })])
    await useAssistantStore.getState().bindProject('project-a')
    expect(useAssistantStore.getState().messages.map((entry) => entry.text)).toEqual(['From an earlier session'])
  })

  it('does not show one project\'s conversation in another', async () => {
    seed('project-a', [message({ text: 'Belongs to A' })])
    await useAssistantStore.getState().bindProject('project-b')
    expect(useAssistantStore.getState().messages).toEqual([])
  })

  it('saves the open thread before switching away from it', async () => {
    await useAssistantStore.getState().bindProject('project-a')
    useAssistantStore.setState({ messages: [message({ text: 'Said in A' })] })
    await useAssistantStore.getState().bindProject('project-b')

    const stored = JSON.parse(store.get('pixeldeck-chat:project-a')!) as AssistantMessage[]
    expect(stored[0].text).toBe('Said in A')
  })

  it('never stores a second copy of the project, nor a captured image', async () => {
    await useAssistantStore.getState().bindProject('project-a')
    useAssistantStore.setState({
      messages: [message({
        undoable: true,
        projectAfter: { id: 'huge', name: 'x', settings: {}, slideGroups: [] } as never,
        calls: [{ tool: 'look_at_slide', args: {}, result: 'ok', failed: false, touched: [], image: 'data:image/jpeg;base64,AAAA' }],
      })],
    })
    await useAssistantStore.getState().bindProject('project-b')

    const raw = store.get('pixeldeck-chat:project-a')!
    expect(raw).not.toContain('slideGroups')
    expect(raw).not.toContain('base64')
  })

  it('restores a turn without offering to undo it, because that history is gone', async () => {
    seed('project-a', [message({ undoable: true })])
    await useAssistantStore.getState().bindProject('project-a')
    expect(useAssistantStore.getState().messages[0].undoable).toBe(false)
  })

  it('keeps only the tail of a long conversation', async () => {
    await useAssistantStore.getState().bindProject('project-a')
    useAssistantStore.setState({
      messages: Array.from({ length: 60 }, (_, index) => message({ id: `m${index}`, text: `line ${index}` })),
    })
    await useAssistantStore.getState().bindProject('project-b')

    const stored = JSON.parse(store.get('pixeldeck-chat:project-a')!) as AssistantMessage[]
    expect(stored).toHaveLength(40)
    expect(stored.at(-1)!.text).toBe('line 59')
  })

  it('survives storage being unreadable rather than failing the switch', async () => {
    vi.mocked(idbStorage.getItem).mockRejectedValueOnce(new Error('blocked'))
    await useAssistantStore.getState().bindProject('project-a')
    expect(useAssistantStore.getState().messages).toEqual([])
    expect(useAssistantStore.getState().projectId).toBe('project-a')
  })

  it('ignores a stored thread that is not a list of messages', async () => {
    store.set('pixeldeck-chat:project-a', '{"not":"an array"}')
    await useAssistantStore.getState().bindProject('project-a')
    expect(useAssistantStore.getState().messages).toEqual([])
  })
})

describe('the panel width preference', () => {
  it('stays within what the layout can show', () => {
    expect(clampWidth(10)).toBe(280)
    expect(clampWidth(9000)).toBe(560)
    expect(clampWidth(400)).toBe(400)
  })
})
