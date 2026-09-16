import { describe, expect, it } from 'vitest'
import { extractProviderErrorMessage, formatProviderHttpError } from '@/ai/errors'

/**
 * Bodies copied from real provider responses. The point of these tests is that
 * the settings panel shows a sentence a user can act on, not the JSON that
 * carried it.
 */
const GEMINI_LEAKED = JSON.stringify({
  error: { code: 403, message: 'Your API key was reported as leaked. Please use another API key.', status: 'PERMISSION_DENIED' },
})
const GEMINI_INVALID = JSON.stringify({
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [{ reason: 'API_KEY_INVALID' }],
  },
})
const GEMINI_REFERRER = JSON.stringify({
  error: { code: 403, message: 'Requests from referer <empty> are blocked.', status: 'PERMISSION_DENIED' },
})
const OPENAI_BAD_KEY = JSON.stringify({
  error: { message: 'Incorrect API key provided: sk-xxx.', type: 'invalid_request_error', code: 'invalid_api_key' },
})

describe('extractProviderErrorMessage', () => {
  it('reads the message out of a Gemini error envelope', () => {
    expect(extractProviderErrorMessage(GEMINI_LEAKED))
      .toBe('Your API key was reported as leaked. Please use another API key.')
  })

  it('reads the message out of an OpenAI error envelope', () => {
    expect(extractProviderErrorMessage(OPENAI_BAD_KEY)).toBe('Incorrect API key provided: sk-xxx.')
  })

  it('reads an array-wrapped envelope, as Google batch endpoints return', () => {
    expect(extractProviderErrorMessage(`[${GEMINI_LEAKED}]`))
      .toBe('Your API key was reported as leaked. Please use another API key.')
  })

  it('reads a bare {message} body from an OpenAI-compatible server', () => {
    expect(extractProviderErrorMessage('{"message":"model is overloaded"}')).toBe('model is overloaded')
  })

  it('refuses to paste an HTML error page into the UI', () => {
    expect(extractProviderErrorMessage('<html><body>502 Bad Gateway</body></html>')).toBeNull()
  })

  it('passes plain-text bodies through, collapsed and truncated', () => {
    expect(extractProviderErrorMessage('  upstream   timed out \n')).toBe('upstream timed out')
    expect(extractProviderErrorMessage('x'.repeat(500))).toHaveLength(300)
  })

  it('returns null for an empty body', () => {
    expect(extractProviderErrorMessage('   ')).toBeNull()
  })
})

describe('formatProviderHttpError', () => {
  it('names the remedy for a key Google disabled as leaked', () => {
    const message = formatProviderHttpError('Gemini API error', 403, GEMINI_LEAKED, 'google')
    expect(message).toContain('Your API key was reported as leaked')
    expect(message).toContain('create a new one')
  })

  it('distinguishes a referrer-restricted key from a leaked one', () => {
    const message = formatProviderHttpError('Gemini API error', 403, GEMINI_REFERRER, 'google')
    expect(message).toContain('restricted to specific websites')
    expect(message).not.toContain('leaked')
  })

  it('tells the user to re-copy a malformed key', () => {
    const message = formatProviderHttpError('Could not load models', 400, GEMINI_INVALID, 'google')
    expect(message).toContain('API key not valid')
    expect(message).toContain('Re-copy it')
  })

  it('points a 404 at the model list rather than the key', () => {
    const body = JSON.stringify({ error: { message: 'models/gemini-9 is not found', status: 'NOT_FOUND' } })
    const message = formatProviderHttpError('Gemini API error', 404, body, 'google')
    expect(message).toContain('Pick one from the model list')
  })

  it('calls a 429 a quota problem, not a credentials problem', () => {
    const message = formatProviderHttpError('Gemini API error', 429, '{"error":{"message":"Quota exceeded"}}', 'google')
    expect(message).toContain('Rate limit or quota')
  })

  it('marks 5xx as the provider’s fault and temporary', () => {
    expect(formatProviderHttpError('X', 503, '{"error":{"message":"overloaded"}}', 'openrouter'))
      .toContain('temporary')
  })

  it('falls back to the bare status when the body carries nothing', () => {
    expect(formatProviderHttpError('Gemini API error', 500, '', 'google')).toContain('HTTP 500')
  })
})
