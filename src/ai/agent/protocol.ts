import { jsonObjects } from '@/ai/json'
import { toolCatalogue } from './tools'

/**
 * The wire format between the assistant and the editor.
 *
 * Deliberately *not* the providers' native tool-calling API. Four providers
 * are supported here — OpenAI, OpenRouter, Google's native Gemini endpoint and
 * anything OpenAI-compatible a person points at — and they do not agree on how
 * a tool is declared or how a call comes back, with the custom case being
 * whatever that server happens to implement. A JSON turn works on all four
 * unchanged, and it is the same shape the slide generator already proved out.
 * Native tool-calling can be added later as an optimisation for the providers
 * that have it; it cannot be the only path.
 */

export interface AgentAction {
  tool: string
  args: Record<string, unknown>
}

export interface AgentReply {
  /** What to show the person. Their language, one or two sentences. */
  say: string
  actions: AgentAction[]
  /**
   * `working` — run these and come back for more.
   * `done`    — run these and stop.
   * `ask`     — stop and wait; `say` holds the question.
   */
  status: 'working' | 'done' | 'ask'
}

export function buildAgentSystemPrompt(args: { uiLanguage: string; readOnly: boolean }): string {
  return [
    'You are the design assistant inside FixFlow, an App Store and Play Store screenshot editor.',
    'You work on a real canvas by calling tools. You never describe an edit you could make instead of making it.',
    '',
    'Answer with ONE JSON object and nothing else:',
    '{',
    '  "say": "one or two sentences for the person",',
    '  "actions": [ { "tool": "name", "args": { … } } ],',
    '  "status": "working" | "done" | "ask"',
    '}',
    '',
    '"working" means run these actions and show me the results — use it whenever you need to read before you write, or want to check your own work.',
    '"done" means run these actions and stop. "ask" means you need the person to decide something; put the question in "say" and send no actions.',
    '',
    'Tools:',
    toolCatalogue(),
    '',
    'Rules:',
    '- Coordinates are canvas pixels with 0,0 at the top left of the slide. Read the slide before moving anything: ids and sizes are not guessable.',
    '- Sizes are relative to the canvas. On a 1290-wide slide a headline is about 90px, a body line about 40px. Scale that with the canvas you are given.',
    '- Never invent a layer id. If you do not have one, call read_slide first.',
    '- One idea per slide. Prefer editing what is there over adding more.',
    '- For a whole slide from scratch, prefer design_slide: it measures the copy and owns the geometry, so the device takes the room the words leave. Place layers one by one only to adjust what is already there.',
    '- Anything that throws work away — deleting a slide group — needs the person\'s word first. Use "status": "ask", then call again with "confirm": true once they agree.',
    '- Switching locale or canvas format changes what is being edited, not just what is shown. Say so when you do it.',
    '- Keep text inside the slide: a layer at x=1200 on a 1290-wide canvas is off the edge.',
    '- look_at_slide returns a picture of the slide. Use it to check a layout you just changed, especially overlaps and things falling off the edge — but only when you will act on what you see, since it costs the person a paid image.',
    `- Write "say" in the person's language (${args.uiLanguage}).`,
    ...(args.readOnly
      ? ['- PROPOSAL MODE: the person has turned edits off. Send no actions that change the design; describe what you would do instead.']
      : []),
  ].join('\n')
}

/** What a round of tool results looks like coming back to the model. */
export function formatToolResults(results: { tool: string; result: string }[]): string {
  return [
    'Results:',
    ...results.map((entry) => `${entry.tool}: ${entry.result}`),
    '',
    'Continue. Reply with the same JSON shape. If the work is finished, use "status": "done".',
  ].join('\n')
}

/**
 * Read whatever came back as a turn.
 *
 * Forgiving on names, strict on shape: models reach for `message`, `reply`,
 * `calls` and `tool_calls` about as often as they use the documented keys, and
 * rejecting those costs a whole round-trip to correct something that was
 * perfectly clear.
 */
export function parseAgentReply(raw: string): AgentReply {
  for (const candidate of jsonObjects(raw)) {
    const record = candidate as Record<string, unknown>
    const hasShape = 'say' in record || 'message' in record || 'reply' in record
      || 'actions' in record || 'calls' in record || 'tool_calls' in record || 'status' in record
    if (!hasShape) continue

    const say = firstString(record.say, record.message, record.reply, record.text) ?? ''
    const rawActions = firstArray(record.actions, record.calls, record.tool_calls, record.tools)
    const actions: AgentAction[] = []
    for (const entry of rawActions) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      const tool = firstString(item.tool, item.name, item.action, item.function)
      if (!tool) continue
      const args = (item.args ?? item.arguments ?? item.params ?? item.input ?? {}) as unknown
      actions.push({
        tool,
        // Some models send the arguments as a JSON *string*, the way the
        // OpenAI tool-calling API does. Read that rather than drop the call.
        args: typeof args === 'string' ? parseArgString(args) : (args && typeof args === 'object' ? args as Record<string, unknown> : {}),
      })
    }

    const declared = firstString(record.status, record.state)
    const status: AgentReply['status'] = declared === 'working' || declared === 'ask' || declared === 'done'
      ? declared
      // No status and no actions means the model was answering, not working.
      : actions.length > 0 ? 'working' : 'done'

    if (!say && actions.length === 0) continue
    return { say, actions, status }
  }
  throw new Error('The model did not answer with an action object.')
}

function parseArgString(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

function firstArray(...values: unknown[]): unknown[] {
  for (const value of values) if (Array.isArray(value)) return value
  return []
}

/**
 * The `say` field out of a half-arrived JSON object.
 *
 * A turn is one JSON object, so nothing can be shown until it is complete —
 * which, on a slow connection, is several seconds of a spinner and no idea
 * whether anything is happening. This reads the sentence out of the buffer as
 * it arrives: find the key, take the string that follows, stop at the first
 * unescaped quote or at whatever has turned up so far.
 *
 * Deliberately not a streaming JSON parser. It reads one known string field
 * and is wrong about nothing else, because the authoritative read is still
 * `parseAgentReply` on the finished text.
 */
export function partialSay(buffer: string): string {
  const key = /"(?:say|message|reply)"\s*:\s*"/.exec(buffer)
  if (!key) return ''
  let out = ''
  for (let i = key.index + key[0].length; i < buffer.length; i++) {
    const char = buffer[i]
    if (char === '\\') {
      const next = buffer[i + 1]
      if (next === undefined) break          // the escape itself is still in flight
      if (next === 'u') {
        const code = buffer.slice(i + 2, i + 6)
        if (code.length < 4) break
        out += String.fromCharCode(parseInt(code, 16))
        i += 5
        continue
      }
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next
      i += 1
      continue
    }
    if (char === '"') break
    out += char
  }
  return out
}
