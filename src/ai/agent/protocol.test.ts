import { describe, it, expect } from 'vitest'
import { buildAgentSystemPrompt, parseAgentReply } from './protocol'

describe('parseAgentReply', () => {
  it('reads a clean turn', () => {
    const reply = parseAgentReply(JSON.stringify({
      say: 'Making the headline bigger.',
      actions: [{ tool: 'update_layer', args: { id: 'abc', patch: { fontSize: 120 } } }],
      status: 'done',
    }))
    expect(reply.say).toBe('Making the headline bigger.')
    expect(reply.actions).toEqual([{ tool: 'update_layer', args: { id: 'abc', patch: { fontSize: 120 } } }])
    expect(reply.status).toBe('done')
  })

  it('finds the object inside a fence or surrounding prose', () => {
    const reply = parseAgentReply('Sure!\n```json\n{"say":"ok","actions":[],"status":"done"}\n```\nAnything else?')
    expect(reply.say).toBe('ok')
  })

  it('accepts the names models reach for instead of the documented ones', () => {
    const reply = parseAgentReply(JSON.stringify({
      message: 'Reading the slide first.',
      tool_calls: [{ name: 'read_slide', arguments: {} }],
      state: 'working',
    }))
    expect(reply.say).toBe('Reading the slide first.')
    expect(reply.actions[0].tool).toBe('read_slide')
    expect(reply.status).toBe('working')
  })

  it('reads arguments sent as a JSON string, the way tool-calling APIs send them', () => {
    const reply = parseAgentReply(JSON.stringify({
      say: 'ok',
      actions: [{ tool: 'move_layer', args: '{"id":"abc","dx":40}' }],
    }))
    expect(reply.actions[0].args).toEqual({ id: 'abc', dx: 40 })
  })

  it('treats actions with no declared status as more work to come', () => {
    const reply = parseAgentReply(JSON.stringify({ say: 'Looking.', actions: [{ tool: 'read_slide', args: {} }] }))
    expect(reply.status).toBe('working')
  })

  it('treats a bare answer with no actions as finished', () => {
    expect(parseAgentReply(JSON.stringify({ say: 'That slide has three layers.' })).status).toBe('done')
  })

  it('drops an action with no tool name rather than failing the turn', () => {
    const reply = parseAgentReply(JSON.stringify({
      say: 'ok',
      actions: [{ args: { id: 'a' } }, { tool: 'delete_layer', args: { id: 'b' } }],
    }))
    expect(reply.actions).toHaveLength(1)
    expect(reply.actions[0].tool).toBe('delete_layer')
  })

  it('throws when nothing in the reply is a turn', () => {
    expect(() => parseAgentReply('I am afraid I cannot do that.')).toThrow()
    // An object that is clearly some other JSON must not be read as an empty turn.
    expect(() => parseAgentReply('{"temperature": 21}')).toThrow()
  })
})

describe('buildAgentSystemPrompt', () => {
  it('lists the tools, so the model is never guessing names', () => {
    const prompt = buildAgentSystemPrompt({ uiLanguage: 'ps', readOnly: false })
    expect(prompt).toContain('read_slide')
    expect(prompt).toContain('add_layer')
    expect(prompt).toContain('ps')
  })

  it('says edits are off in proposal mode', () => {
    expect(buildAgentSystemPrompt({ uiLanguage: 'en', readOnly: true })).toContain('PROPOSAL MODE')
    expect(buildAgentSystemPrompt({ uiLanguage: 'en', readOnly: false })).not.toContain('PROPOSAL MODE')
  })
})

describe('partialSay', () => {
  it('reads the sentence out of a half-arrived object', async () => {
    const { partialSay } = await import('./protocol')
    expect(partialSay('{"say":"Adding a head')).toBe('Adding a head')
  })

  it('stops at the end of the string, not at the end of the buffer', async () => {
    const { partialSay } = await import('./protocol')
    expect(partialSay('{"say":"Done.","actions":[]}')).toBe('Done.')
  })

  it('is empty until the field turns up', async () => {
    const { partialSay } = await import('./protocol')
    expect(partialSay('{"actions":[{"tool":"read_slide"')).toBe('')
  })

  it('handles the escapes a model actually emits', async () => {
    const { partialSay } = await import('./protocol')
    expect(partialSay('{"say":"Line one\\nLine \\"two\\""}')).toBe('Line one\nLine "two"')
    expect(partialSay('{"say":"\\u067e\\u069a\\u062a\\u0648"}')).toBe('پښتو')
  })

  it('waits rather than guessing when an escape is still in flight', async () => {
    const { partialSay } = await import('./protocol')
    // A lone trailing backslash: whatever it escapes has not arrived yet.
    expect(partialSay('{"say":"half' + '\\')).toBe('half')
    // Half a \uXXXX sequence, likewise.
    expect(partialSay('{"say":"half' + '\\u06')).toBe('half')
    // A complete escaped backslash is a backslash, and is shown.
    expect(partialSay('{"say":"half' + '\\\\')).toBe('half' + '\\')
  })

  it('reads the field names models reach for instead', async () => {
    const { partialSay } = await import('./protocol')
    expect(partialSay('{"message":"Working on it')).toBe('Working on it')
  })
})
