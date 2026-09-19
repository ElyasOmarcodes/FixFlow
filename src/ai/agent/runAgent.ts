import { transportChat } from '@/ai/transport'
import type { AiChatMessage } from '@/ai/client'
import type { AiAuth } from '@/ai/features/translateText'
import { buildAgentSystemPrompt, formatToolResults, parseAgentReply, type AgentAction } from './protocol'
import { findTool, runTool, type AgentToolResult } from './tools'

/**
 * The turn loop.
 *
 * One message from a person is not one request to a model. "Make the headline
 * fit" means: read the slide, find the headline, measure it against the
 * canvas, change it, look again. So a turn runs rounds — the model answers
 * with actions, the actions run, their results go back — until it says it is
 * finished or the round cap stops it.
 *
 * The cap is not a formality. A model that cannot achieve what was asked will
 * otherwise keep trying variations of the same call until the person's credit
 * runs out, and every round is a paid request against their own key.
 */

export const DEFAULT_MAX_ROUNDS = 5

export type AgentEvent =
  | { type: 'say'; text: string }
  | { type: 'tool'; result: AgentToolResult }
  | { type: 'question'; text: string }
  | { type: 'round'; index: number }

export interface AgentRunOptions {
  auth: AiAuth
  /** BCP-47 tag of the interface language, so the reply comes back in it. */
  uiLanguage: string
  /** Earlier turns, oldest first — plain text only, no tool noise. */
  history: { role: 'user' | 'assistant'; content: string }[]
  input: string
  /** A description of the canvas as it stands, from `describeCanvas`. */
  canvas: string
  /** Ids the person has selected, which is usually what "this" means. */
  selectionIds?: string[]
  /** Propose only: read tools still run, writes are refused. */
  readOnly?: boolean
  maxRounds?: number
  signal?: AbortSignal
  onEvent?: (event: AgentEvent) => void
}

export interface AgentRunSummary {
  /** Everything the assistant said, in order. */
  said: string[]
  calls: AgentToolResult[]
  touched: string[]
  rounds: number
  /** True when the cap stopped the run rather than the model finishing. */
  hitRoundCap: boolean
  /** True when the model asked a question and is waiting. */
  waitingForAnswer: boolean
}

class AbortedError extends Error {
  constructor() { super('Stopped.') }
}

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AbortedError()
}

export function isAgentAbort(error: unknown): boolean {
  return error instanceof AbortedError
}

/** The first message of a turn: what is on the canvas, then what was asked. */
function buildOpeningMessage(options: AgentRunOptions): string {
  const lines = ['This is the canvas right now.', '', options.canvas, '']
  if (options.selectionIds?.length) {
    lines.push(`The person has these layers selected: ${options.selectionIds.join(', ')}. "this" almost certainly means them.`, '')
  }
  lines.push('They asked:', options.input)
  return lines.join('\n')
}

export async function runAgentTurn(options: AgentRunOptions): Promise<AgentRunSummary> {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
  const emit = options.onEvent ?? (() => {})
  const summary: AgentRunSummary = { said: [], calls: [], touched: [], rounds: 0, hitRoundCap: false, waitingForAnswer: false }

  const messages: AiChatMessage[] = [
    { role: 'system', content: buildAgentSystemPrompt({ uiLanguage: options.uiLanguage, readOnly: !!options.readOnly }) },
    ...options.history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user', content: buildOpeningMessage(options) },
  ]

  for (let round = 0; round < maxRounds; round++) {
    checkAborted(options.signal)
    summary.rounds = round + 1
    emit({ type: 'round', index: round })

    const raw = await transportChat({ ...options.auth, forceJsonMode: true, maxTokens: 2048, messages })
    checkAborted(options.signal)

    let reply
    try {
      reply = parseAgentReply(raw)
    } catch (firstError) {
      // One repair attempt, the same way the slide generator recovers: the
      // answer is usually right and merely fenced or prefaced.
      const repaired = await transportChat({
        ...options.auth,
        forceJsonMode: true,
        maxTokens: 2048,
        messages: [...messages,
          { role: 'assistant', content: raw.slice(0, 4000) },
          { role: 'user', content: 'Reply again with the JSON object only — no prose, no markdown fence.' }],
      })
      try { reply = parseAgentReply(repaired) } catch { throw firstError }
    }

    if (reply.say) {
      summary.said.push(reply.say)
      emit({ type: reply.status === 'ask' ? 'question' : 'say', text: reply.say })
    }

    const allowed = options.readOnly ? reply.actions.filter(isReadOnly) : reply.actions
    const refused = reply.actions.length - allowed.length

    const results: AgentToolResult[] = []
    for (const action of allowed) {
      checkAborted(options.signal)
      const result = await runTool(action.tool, action.args, { auth: options.auth, uiLanguage: options.uiLanguage })
      results.push(result)
      summary.calls.push(result)
      for (const id of result.touched) if (!summary.touched.includes(id)) summary.touched.push(id)
      emit({ type: 'tool', result })
    }

    if (reply.status === 'ask') { summary.waitingForAnswer = true; return summary }
    if (reply.status === 'done') return summary
    // Nothing ran and nothing was asked: the model is finished but said so in
    // the wrong field. Treating that as another round only burns a request.
    if (results.length === 0 && refused === 0) return summary

    const feedback = refused > 0
      ? [...results, { tool: 'proposal mode', result: `${refused} action(s) were not run because edits are turned off.` }]
      : results
    messages.push({ role: 'assistant', content: raw.slice(0, 4000) })
    messages.push({ role: 'user', content: formatToolResults(feedback) })
  }

  summary.hitRoundCap = true
  return summary
}

function isReadOnly(action: AgentAction): boolean {
  return findTool(action.tool)?.readOnly === true
}
