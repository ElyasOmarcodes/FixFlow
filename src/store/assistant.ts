import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Project } from '@/types'
import { useEditorStore } from '@/store'
import { useApiKeysStore } from '@/store/apiKeys'
import { useUiLanguageStore } from '@/i18n'
import { describeCanvas } from '@/ai/agent/snapshot'
import { isAgentAbort, runAgentTurn } from '@/ai/agent/runAgent'
import type { AgentToolResult } from '@/ai/agent/tools'

/**
 * The assistant conversation.
 *
 * A separate store, like the asset store, and for the same reason: a
 * conversation is not design data. It must not enter the undo history, must
 * not travel inside an exported project, and must not make the editor store
 * re-render every time a word arrives.
 *
 * The preferences that describe how a person likes the panel — open, how wide,
 * whether edits are allowed — live in `localStorage`, not in the project, for
 * the same reason `smartSnap` does.
 */

const PREFS_KEY = 'pixeldeck.assistant'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  /** The calls this turn made, newest last. */
  calls?: AgentToolResult[]
  /** Layers created or changed, so the canvas can flash them. */
  touched?: string[]
  /** True when this turn changed the design and that change is still the top of the undo stack. */
  undoable?: boolean
  /** The project the turn produced — the guard for "is my undo still the right one". */
  projectAfter?: Project
  reverted?: boolean
  at: number
}

interface AssistantPrefs {
  open: boolean
  width: number
  readOnly: boolean
}

interface AssistantState extends AssistantPrefs {
  messages: AssistantMessage[]
  busy: boolean
  /** Set while a turn is in flight, so it can be stopped. */
  controller: AbortController | null
  /**
   * The layers a turn just touched, and when. The canvas flashes them: a
   * person who asked for one change and got four needs to see where the other
   * three landed, and a list of ids in the transcript is not that.
   */
  highlight: { ids: string[]; at: number } | null

  setOpen: (open: boolean) => void
  setHighlight: (ids: string[]) => void
  toggleOpen: () => void
  setWidth: (width: number) => void
  setReadOnly: (readOnly: boolean) => void
  clear: () => void
  send: (input: string) => Promise<void>
  stop: () => void
  revert: (messageId: string) => void
}

export const MIN_ASSISTANT_WIDTH = 280
export const MAX_ASSISTANT_WIDTH = 560

function readPrefs(): AssistantPrefs {
  const fallback: AssistantPrefs = { open: false, width: 340, readOnly: false }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<AssistantPrefs>
    return {
      open: parsed.open ?? fallback.open,
      width: clampWidth(parsed.width ?? fallback.width),
      readOnly: parsed.readOnly ?? fallback.readOnly,
    }
  } catch {
    return fallback
  }
}

function writePrefs(prefs: AssistantPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
}

function prefsOf(state: AssistantPrefs): AssistantPrefs {
  return { open: state.open, width: state.width, readOnly: state.readOnly }
}

export function clampWidth(width: number): number {
  return Math.min(MAX_ASSISTANT_WIDTH, Math.max(MIN_ASSISTANT_WIDTH, Math.round(width)))
}

/** The last turns, as plain text — the tool traffic is noise to the model on a later turn. */
function historyFor(messages: AssistantMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((message) => message.role !== 'error' && message.text.trim())
    .slice(-8)
    .map((message) => ({ role: message.role === 'user' ? 'user' as const : 'assistant' as const, content: message.text }))
}

export const useAssistantStore = create<AssistantState>()((set, get) => ({
  ...readPrefs(),
  messages: [],
  busy: false,
  controller: null,
  highlight: null,

  // Only the three preference keys are persisted, never the state around them:
  // spreading the store here would write the whole transcript to localStorage
  // on every toggle.
  setOpen: (open) => { set({ open }); writePrefs({ ...prefsOf(get()), open }) },
  toggleOpen: () => get().setOpen(!get().open),
  setWidth: (width) => { const next = clampWidth(width); set({ width: next }); writePrefs({ ...prefsOf(get()), width: next }) },
  setReadOnly: (readOnly) => { set({ readOnly }); writePrefs({ ...prefsOf(get()), readOnly }) },
  clear: () => set({ messages: [], highlight: null }),
  setHighlight: (ids) => set({ highlight: ids.length ? { ids, at: Date.now() } : null }),

  stop: () => { get().controller?.abort() },

  /**
   * Undo one turn.
   *
   * Only while the turn is still the top of the stack: once the person has
   * edited something themselves, pressing undo would take away *their* change,
   * not the assistant's. The guard is the project reference the turn produced,
   * which is exactly what any later edit replaces.
   */
  revert: (messageId) => {
    const message = get().messages.find((entry) => entry.id === messageId)
    if (!message?.undoable || message.reverted) return
    if (useEditorStore.getState().project !== message.projectAfter) return
    useEditorStore.temporal.getState().undo()
    set((state) => ({
      messages: state.messages.map((entry) => (entry.id === messageId ? { ...entry, reverted: true, undoable: false } : entry)),
    }))
  },

  send: async (input) => {
    const text = input.trim()
    if (!text || get().busy) return

    const keys = useApiKeysStore.getState()
    const apiKey = keys.getActiveKey()
    if (!apiKey) {
      set((state) => ({ messages: [...state.messages, errorMessage('needs-key')] }))
      return
    }

    const controller = new AbortController()
    const userMessage: AssistantMessage = { id: nanoid(), role: 'user', text, at: Date.now() }
    const turnId = nanoid()
    const history = historyFor(get().messages)
    set((state) => ({
      busy: true,
      controller,
      messages: [...state.messages, userMessage, { id: turnId, role: 'assistant', text: '', calls: [], at: Date.now() }],
    }))

    const patchTurn = (patch: Partial<AssistantMessage>) => set((state) => ({
      messages: state.messages.map((entry) => (entry.id === turnId ? { ...entry, ...patch } : entry)),
    }))

    const editor = useEditorStore.getState()
    const selectionIds = editor.selectedLayerIds.length
      ? editor.selectedLayerIds
      : editor.selection?.layerId ? [editor.selection.layerId] : []

    editor.beginAgentTurn()
    try {
      const summary = await runAgentTurn({
        auth: {
          provider: keys.provider,
          apiKey,
          model: keys.getActiveModel(),
          baseUrl: keys.getActiveBaseUrl(),
        },
        uiLanguage: useUiLanguageStore.getState().language,
        history,
        input: text,
        canvas: describeCanvas(editor.project, editor.activeSlideGroupId),
        selectionIds,
        readOnly: get().readOnly,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'say' || event.type === 'question') {
            const said = get().messages.find((entry) => entry.id === turnId)?.text ?? ''
            patchTurn({ text: said ? `${said}\n\n${event.text}` : event.text })
          } else if (event.type === 'tool') {
            const calls = get().messages.find((entry) => entry.id === turnId)?.calls ?? []
            patchTurn({ calls: [...calls, event.result] })
          }
        },
      })

      const changed = useEditorStore.getState().endAgentTurn()
      get().setHighlight(summary.touched)
      patchTurn({
        touched: summary.touched,
        undoable: changed,
        projectAfter: changed ? useEditorStore.getState().project : undefined,
        text: (get().messages.find((entry) => entry.id === turnId)?.text ?? '')
          || (summary.hitRoundCap ? 'I stopped after several rounds without finishing.' : ''),
      })
    } catch (error) {
      // Half a change is worse than none: a turn that threw is put back.
      useEditorStore.getState().rollbackAgentTurn()
      const stopped = isAgentAbort(error)
      patchTurn({
        role: stopped ? 'assistant' : 'error',
        text: stopped ? 'Stopped.' : (error instanceof Error ? error.message : String(error)),
      })
    } finally {
      set({ busy: false, controller: null })
    }
  },
}))

/** A sentinel the panel translates — the store must not import the i18n hook. */
function errorMessage(kind: 'needs-key'): AssistantMessage {
  return { id: nanoid(), role: 'error', text: `__${kind}__`, at: Date.now() }
}
