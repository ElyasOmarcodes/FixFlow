import { afterEach, describe, expect, it, vi } from 'vitest'
import { listModels } from './models'

describe('AI model listing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('requires a custom API base URL', async () => {
    await expect(listModels('custom', 'sk-test')).rejects.toThrow(/no custom api base url/i)
  })

  it('loads custom models from the provided base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'custom-model' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(listModels('custom', 'sk-test', 'https://my-proxy.example.com/v1')).resolves.toEqual([
      { id: 'custom-model', name: 'custom-model', description: undefined, contextLength: undefined },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.example.com/v1/models')
  })

  it('surfaces non-network provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key'),
    }))
    await expect(listModels('openai', 'sk-test')).rejects.toThrow('Invalid API key')
  })
})

describe('Gemini live catalogue', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('follows all pages, filters unsupported methods and normalizes model names', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [
        { name: 'models/current-flash', displayName: 'Current Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
      ], nextPageToken: 'page two' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [
        { name: 'models/current-pro', displayName: 'Current Pro', supportedGenerationMethods: ['generateContent'] },
      ] }) })
    vi.stubGlobal('fetch', fetchMock)
    const models = await listModels('google', 'test-key')
    expect(models.map((m) => m.id)).toEqual(['current-flash', 'current-pro'])
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'x-goog-api-key': 'test-key' })
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page+two')
    expect(fetchMock.mock.calls[0][0]).not.toContain('test-key')
  })
  it('does not present retired fallback models as live when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(listModels('google', 'test-key')).rejects.toThrow()
  })
  it('reports quota/permission errors rather than an empty successful catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'API key restricted' }))
    await expect(listModels('google', 'test-key')).rejects.toThrow('API key restricted')
  })
})
