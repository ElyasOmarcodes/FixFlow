import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { chatStream } from './client'

/**
 * Streaming is an optimisation, not a contract: every provider must still
 * answer. So what is pinned here is the SSE reading (frames straddle chunks,
 * `[DONE]` is not content) and, just as importantly, every way it gives up and
 * falls back to the ordinary request rather than failing the turn.
 */

const options = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user' as const, content: 'hello' }],
}

/** A Response whose body streams these byte chunks, as the network would. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

const originalFetch = globalThis.fetch

beforeEach(() => { globalThis.fetch = vi.fn() as unknown as typeof fetch })
afterEach(() => { globalThis.fetch = originalFetch })

describe('chatStream', () => {
  it('reports the text so far on every frame, and returns the whole answer', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse([
      frame('{"say":"Add'), frame('ing a head'), frame('line."}'), 'data: [DONE]\n\n',
    ]))

    const seen: string[] = []
    const whole = await chatStream(options, (text) => seen.push(text))

    expect(seen).toEqual(['{"say":"Add', '{"say":"Adding a head', '{"say":"Adding a headline."}'])
    expect(whole).toBe('{"say":"Adding a headline."}')
  })

  it('reads a frame that arrives split across two network chunks', async () => {
    const whole = frame('hello world')
    vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse([
      whole.slice(0, 14), whole.slice(14), 'data: [DONE]\n\n',
    ]))

    const seen: string[] = []
    expect(await chatStream(options, (text) => seen.push(text))).toBe('hello world')
    expect(seen).toEqual(['hello world'])
  })

  it('ignores keep-alives and unparseable frames instead of failing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(sseResponse([
      ': keep-alive\n\n', 'data: {not json\n\n', frame('ok'), 'data: [DONE]\n\n',
    ]))
    expect(await chatStream(options, () => {})).toBe('ok')
  })

  it('does not stream a provider that speaks another protocol', async () => {
    // Google's native endpoint: one ordinary request, one delta with all of it.
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'whole answer' }] } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const seen: string[] = []
    const whole = await chatStream({ ...options, provider: 'google', model: 'gemini-2.0-flash' }, (text) => seen.push(text))
    expect(whole).toBe('whole answer')
    expect(seen).toEqual(['whole answer'])
  })

  it('falls back to the ordinary request when a gateway rejects streaming', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('{"error":{"message":"stream not supported"}}', { status: 400 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [{ message: { content: 'plain answer' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))

    const seen: string[] = []
    expect(await chatStream(options, (text) => seen.push(text))).toBe('plain answer')
    expect(seen).toEqual(['plain answer'])
  })

  it('falls back when the streaming request cannot be made at all', async () => {
    vi.mocked(globalThis.fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
    expect(await chatStream(options, () => {})).toBe('recovered')
  })

  it('still reports a real failure rather than hiding it behind a retry', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('{"error":{"message":"Incorrect API key"}}', { status: 401 }))
    await expect(chatStream(options, () => {})).rejects.toThrow(/API key/i)
  })

  it('refuses without a key, the way the ordinary path does', async () => {
    await expect(chatStream({ ...options, apiKey: '  ' }, () => {})).rejects.toThrow(/API key/i)
  })
})
