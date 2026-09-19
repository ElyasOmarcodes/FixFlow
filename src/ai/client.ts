import { aiFetch } from './http'
import { formatProviderHttpError } from '@/ai/errors'
import { buildOpenAiCompatibleHeaders } from '@/ai/headers'
import { getDefaultModel, getProviderConfig } from '@/ai/providers'
import type { AiProvider } from '@/ai/providers'

/** A multimodal content part: plain text or an image as a data URL. */
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string }

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AiContentPart[]
}

/** Split a data URL into media type + base64 payload. */
function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Image must be a base64 data URL (data:image/…;base64,…).')
  return { mediaType: match[1], data: match[2] }
}

function asDataUrl(value: unknown, fallbackMediaType = 'image/png'): string | null {
  if (typeof value !== 'string' || !value) return null
  if (value.startsWith('data:image/')) return value
  // Accept raw base64 only when it comes from a known structured field
  // (inline_data.data, b64_json) — callers pass fallbackMediaType in that case.
  // Never treat arbitrary strings as images.
  if (fallbackMediaType !== 'image/png' && /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 100) {
    return `data:${fallbackMediaType};base64,${value.replace(/\s/g, '')}`
  }
  return null
}

function extractGeneratedImageDataUrl(data: unknown): string {
  const direct = findImageDataUrl(data)
  if (direct) return direct
  throw new Error('The selected model did not return an image. Choose an image-generation model or try another provider.')
}

/**
 * For chat-based image paths:
 * 1. Try to find an image in the response.
 * 2. If no image, check whether the model returned a JSON {error} object.
 * 3. Otherwise throw a generic error.
 */
function extractImageOrThrowModelError(data: unknown): string {
  const imageUrl = findImageDataUrl(data)
  if (imageUrl) return imageUrl

  // Try to surface a model-reported error from the JSON contract
  const text = extractTextFromChatResponse(data)
  if (text) {
    const trimmed = text.trim()
    // Strip optional markdown fences
    const jsonStr = trimmed.startsWith('```') ? trimmed.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim() : trimmed
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>
      if (typeof parsed.error === 'string' && parsed.error) {
        throw new Error(parsed.error.slice(0, 300))
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        // Not JSON — fall through to generic error
      } else {
        throw e
      }
    }
  }

  throw new Error('The selected model did not return an image. Try an image-generation model (e.g. gpt-image-1, flux, Imagen).')
}

/** Extract the first text string from an OpenAI-compatible chat completion response. */
function extractTextFromChatResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const choices = record.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const msg = (choices[0] as Record<string, unknown>)?.message
  if (!msg || typeof msg !== 'object') return null
  const content = (msg as Record<string, unknown>).content
  return typeof content === 'string' ? content : null
}

function findImageDataUrl(value: unknown): string | null {
  const direct = asDataUrl(value)
  if (direct) return direct
  if (!value || typeof value !== 'object') return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageDataUrl(item)
      if (found) return found
    }
    return null
  }

  const record = value as Record<string, unknown>
  const url = asDataUrl(record.url) ?? asDataUrl(record.b64_json, 'image/png') ?? asDataUrl(record.data, 'image/png')
  if (url) return url

  const inlineData = record.inlineData ?? record.inline_data
  if (inlineData && typeof inlineData === 'object') {
    const inline = inlineData as Record<string, unknown>
    const mediaType = typeof inline.mimeType === 'string'
      ? inline.mimeType
      : typeof inline.mime_type === 'string' ? inline.mime_type : 'image/png'
    const dataUrl = asDataUrl(inline.data, mediaType)
    if (dataUrl) return dataUrl
  }

  const imageUrl = record.image_url
  if (imageUrl && typeof imageUrl === 'object') {
    const dataUrl = asDataUrl((imageUrl as Record<string, unknown>).url)
    if (dataUrl) return dataUrl
  }

  for (const nested of Object.values(record)) {
    const found = findImageDataUrl(nested)
    if (found) return found
  }
  return null
}

export interface AiChatOptions {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
  messages: AiChatMessage[]
  maxTokens?: number
  /** Request provider-level JSON mode when it is known to be compatible. */
  forceJsonMode?: boolean
  /** Abort the request after this many milliseconds. Defaults to 60 seconds. */
  timeoutMs?: number
  /** Retries after the initial attempt for network, timeout, 429, and 5xx errors. */
  retries?: number
  /** Abort a streaming request when the person presses stop. */
  signal?: AbortSignal
}

export interface AiImageEditOptions {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
  prompt: string
  imageDataUrl: string
  /** Abort the request after this many milliseconds. Defaults to 60 seconds. */
  timeoutMs?: number
  /** Retries after the initial attempt for network, timeout, 429, and 5xx errors. */
  retries?: number
}

export const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000
export const DEFAULT_AI_MAX_RETRIES = 2
const AI_RETRY_BASE_DELAY_MS = 250

export type AiClientErrorKind = 'network' | 'timeout' | 'http' | 'parse'

/** Consistent error shape for provider transport and response failures. */
export class AiClientError extends Error {
  readonly kind: AiClientErrorKind
  readonly status?: number

  constructor(kind: AiClientErrorKind, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = 'AiClientError'
    this.kind = kind
    this.status = options?.status
  }
}

interface AiRequestSettings {
  timeoutMs?: number
  retries?: number
  /**
   * When false, timeouts and mid-flight network failures are NOT retried.
   * Use for non-idempotent endpoints (image generation): a timed-out request may
   * still complete server-side, and an automatic retry would duplicate the work
   * and the charge. HTTP 429/5xx responses are still retried — the server
   * answered, so no duplicate generation is in flight.
   */
  retryOnTransportErrors?: boolean
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function networkErrorMessage(provider: AiProvider, action: string, error: unknown): string {
  const cause = error instanceof Error && error.message ? error.message : 'Network request failed'
  const hint = 'Check your network connection and that the base URL is correct and allows direct browser requests (CORS). If this provider blocks browser CORS, use a different provider or a self-hosted proxy.'
  return `Could not ${action} for ${provider}. ${hint} (${cause})`
}

async function requestJsonWithRetry(
  provider: AiProvider,
  action: string,
  url: string,
  init: RequestInit,
  settings: AiRequestSettings,
  httpErrorLabel = `${provider} API error`,
): Promise<unknown> {
  const timeoutMs = normalizeNonNegativeInteger(settings.timeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS)
  const retries = normalizeNonNegativeInteger(settings.retries, DEFAULT_AI_MAX_RETRIES)
  const retryOnTransportErrors = settings.retryOnTransportErrors ?? true

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await aiFetch(url, { ...init, signal: controller.signal })
      if (response.ok) {
        try {
          return await response.json()
        } catch (error) {
          throw new AiClientError('parse', `${provider} returned invalid JSON while trying to ${action}.`, { cause: error })
        }
      } else {
        const body = await response.text()
        const httpError = new AiClientError(
          'http',
          formatProviderHttpError(httpErrorLabel, response.status, body, provider),
          { status: response.status },
        )
        const transient = response.status === 429 || response.status >= 500
        if (!transient || attempt === retries) throw httpError
      }
    } catch (error) {
      if (error instanceof AiClientError) throw error

      const timedOut = controller.signal.aborted
      const normalized = timedOut
        ? new AiClientError('timeout', `Timed out while trying to ${action} for ${provider} after ${timeoutMs}ms.`, { cause: error })
        : new AiClientError('network', networkErrorMessage(provider, action, error), { cause: error })
      const transient = retryOnTransportErrors && (timedOut || error instanceof TypeError)
      if (!transient || attempt === retries) throw normalized
    } finally {
      clearTimeout(timeoutId)
    }

    await wait(AI_RETRY_BASE_DELAY_MS * (attempt + 1))
  }

  throw new AiClientError('network', `Could not ${action} for ${provider}.`)
}

export async function chat(options: AiChatOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  const baseUrl = resolveBaseUrl(options.provider, options.baseUrl)
  if (!baseUrl) throw new Error('No custom API base URL configured. Open AI Settings in the toolbar.')
  const model = options.model?.trim() || getDefaultModel(options.provider)
  if (options.provider === 'google') return chatWithGemini(options, apiKey, model)
  return chatWithOpenAiCompatible(
    baseUrl,
    apiKey,
    model,
    options.messages,
    options.maxTokens,
    options.provider,
    options.forceJsonMode,
    options,
  )
}


/**
 * The same request, delivered as it is written.
 *
 * A turn is one JSON object, so nothing can be *parsed* until it is complete —
 * but the sentence inside it can be shown while it arrives, which is the
 * difference between a spinner and a reply on a slow connection.
 *
 * Streaming is attempted only where it is known to work: the OpenAI-compatible
 * Chat Completions SSE shape. Google's native endpoint speaks a different
 * protocol and an arbitrary custom server may speak none, so both fall back to
 * the ordinary request and report the whole answer in one delta. The caller
 * cannot tell the difference except in how often `onDelta` fires.
 */
export async function chatStream(
  options: AiChatOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  const baseUrl = resolveBaseUrl(options.provider, options.baseUrl)
  if (!baseUrl) throw new Error('No custom API base URL configured. Open AI Settings in the toolbar.')
  const model = options.model?.trim() || getDefaultModel(options.provider)

  const streamable = options.provider === 'openai' || options.provider === 'openrouter'
  if (!streamable) {
    const whole = await chat(options)
    onDelta(whole)
    return whole
  }

  const headers = buildOpenAiCompatibleHeaders(options.provider, apiKey, { contentType: true })
  const isOpenAiOModel = options.provider === 'openai' && /^o\d/i.test(model)
  const body: Record<string, unknown> = {
    model,
    stream: true,
    messages: options.messages.map((message) => ({
      role: message.role,
      content: typeof message.content === 'string'
        ? message.content
        : message.content.map((part) => (part.type === 'text'
          ? { type: 'text' as const, text: part.text }
          : { type: 'image_url' as const, image_url: { url: part.dataUrl } })),
    })),
    ...(options.maxTokens
      ? isOpenAiOModel ? { max_completion_tokens: options.maxTokens } : { max_tokens: options.maxTokens }
      : {}),
    ...(options.forceJsonMode ? { response_format: { type: 'json_object' } } : {}),
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    // A proxy that refuses a streaming request is not a failed turn: the
    // ordinary path still works, so take it rather than showing an error.
    const whole = await chat(options)
    onDelta(whole)
    return whole
  }

  if (!response.ok || !response.body) {
    const detail = response.ok ? '' : await response.text()
    if (!response.ok && (response.status === 400 || response.status === 404)) {
      // Some gateways reject `stream` outright; others do not implement it.
      const whole = await chat(options)
      onDelta(whole)
      return whole
    }
    throw new AiClientError('http', formatProviderHttpError(`${options.provider} API error`, response.status, detail, options.provider), { status: response.status })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE frames are separated by a blank line; a frame can straddle chunks.
      let cut = buffer.indexOf('\n\n')
      while (cut !== -1) {
        const frame = buffer.slice(0, cut)
        buffer = buffer.slice(cut + 2)
        const delta = deltaFromFrame(frame)
        if (delta) { text += delta; onDelta(text) }
        cut = buffer.indexOf('\n\n')
      }
    }
  } finally {
    await reader.cancel().catch(() => { /* already closed */ })
  }

  if (!text.trim()) throw new Error(`${options.provider} returned empty content.`)
  return text.trim()
}

/** The text a single `data:` frame carries, if any. */
function deltaFromFrame(frame: string): string {
  let out = ''
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
      const piece = parsed.choices?.[0]?.delta?.content
      if (typeof piece === 'string') out += piece
    } catch {
      // A partial or non-JSON frame; the next one carries the rest.
    }
  }
  return out
}

export async function editImage(options: AiImageEditOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  const baseUrl = resolveBaseUrl(options.provider, options.baseUrl)
  if (!baseUrl) throw new Error('No custom API base URL configured. Open AI Settings in the toolbar.')
  const model = options.model?.trim() || getDefaultModel(options.provider)

  if (options.provider === 'google') return editImageWithGemini(options, apiKey, model)
  if (options.provider === 'openai') {
    return editImageWithOpenAi(baseUrl, apiKey, model, options.prompt, options.imageDataUrl, options)
  }
  // Other compatible providers attempt image editing via chat completions.
  // The model itself signals unsupported via the JSON error contract in the prompt.
  return editImageWithOpenAiCompatibleImageChat(options.provider, baseUrl, apiKey, model, options.prompt, options.imageDataUrl, options)
}

/**
 * Soft hint for the UI: returns true when the selected provider+model is
 * known to support image generation. Used to show/hide warnings — NOT a
 * hard gate. The actual capability is determined at call time.
 */
/** Resolve the effective base URL for a provider, stripping trailing slashes. */
function resolveBaseUrl(provider: AiProvider, baseUrlOverride?: string): string | undefined {
  const raw = provider === 'custom' ? baseUrlOverride?.trim() : getProviderConfig(provider).baseUrl
  return raw ? raw.replace(/\/+$/, '') : undefined
}

export function supportsImageEditing(provider: AiProvider, model: string): boolean {
  if (provider === 'openai') return model.toLowerCase().startsWith('gpt-image')
  if (provider === 'google') return model.toLowerCase().includes('image')
  // OpenRouter and custom providers are optimistic; runtime decides.
  return true
}

async function chatWithOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens: number | undefined,
  provider: AiProvider,
  forceJsonMode = false,
  requestSettings: AiRequestSettings = {},
): Promise<string> {
  const headers = buildOpenAiCompatibleHeaders(provider, apiKey, { contentType: true })

  // Map multimodal parts to the OpenAI content schema; strings pass through.
  const apiMessages = messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === 'string'
        ? m.content
        : m.content.map((part) =>
            part.type === 'text'
              ? { type: 'text' as const, text: part.text }
              : { type: 'image_url' as const, image_url: { url: part.dataUrl } },
          ),
  }))

  // OpenAI o-series reasoning models (o1, o3, o4-mini, …) require
  // `max_completion_tokens` instead of `max_tokens` — sending `max_tokens`
  // causes a 400 error. All other OpenAI-compatible models use `max_tokens`.
  const isOpenAiOModel = provider === 'openai' && /^o\d/i.test(model)
  const body: Record<string, unknown> = {
    model,
    messages: apiMessages,
    ...(maxTokens
      ? isOpenAiOModel
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }
      : {}),
  }

  // OpenAI, OpenRouter, and Google's OpenAI-compat endpoint all support Chat
  // Completions JSON mode. Do not send this to `custom` endpoints: unknown
  // OpenAI-compatible servers/routed models can reject `response_format`, so
  // those stay prompt-only and rely on the parser/retry machinery.
  // o-series models support json_object mode too.
  if (forceJsonMode && (provider === 'openai' || provider === 'openrouter' || provider === 'google')) {
    body.response_format = { type: 'json_object' }
  }

  // Reasoning models consume their entire token budget on internal chain-of-thought
  // before generating any output, causing finish_reason=length on JSON tasks.
  // Disable reasoning for providers/models where it is known to be the default.
  //
  // OpenRouter — DeepSeek R1 variants use a different disable key
  if (provider === 'openrouter') {
    const m = model.toLowerCase()
    if (m.includes('deepseek') && (m.includes('r1') || m.includes('reasoner'))) {
      body.reasoning = { enabled: false }
    }
  }

  const data = await requestJsonWithRetry(provider, 'call chat completions', `${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, requestSettings)
  const dataRecord = data && typeof data === 'object' ? data as Record<string, unknown> : null
  const choices = Array.isArray(dataRecord?.choices) ? dataRecord.choices : []
  const choice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : null
  const message = choice?.message && typeof choice.message === 'object' ? choice.message as Record<string, unknown> : null
  const content = message?.content
  const finishReason = choice?.finish_reason
  if (typeof content !== 'string') throw new Error(`${provider} returned an empty response.`)
  if (!content.trim()) {
    console.error(`[FixFlow] ${provider} returned empty content. finish_reason=${finishReason}`, data)
    throw new Error(`${provider} returned empty content (finish_reason: ${finishReason ?? 'unknown'}).`)
  }
  return content.trim()
}

async function editImageWithOpenAi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
  requestSettings: AiRequestSettings,
): Promise<string> {
  const { mediaType, data } = splitDataUrl(imageDataUrl)
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
  const extension = mediaType.split('/')[1] || 'png'
  const form = new FormData()
  form.set('model', model)
  form.set('prompt', prompt)
  form.set('image', new Blob([bytes], { type: mediaType }), `source.${extension}`)

  const dataJson = await requestJsonWithRetry('openai', 'edit image', `${baseUrl}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  }, { ...requestSettings, retryOnTransportErrors: false }, 'OpenAI image API error')
  return extractGeneratedImageDataUrl(dataJson)
}

async function editImageWithOpenAiCompatibleImageChat(
  provider: AiProvider,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
  requestSettings: AiRequestSettings,
): Promise<string> {
  const headers = buildOpenAiCompatibleHeaders(provider, apiKey, { contentType: true })

  const userContent = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]

  const dataJson = await requestJsonWithRetry(provider, 'generate image', `${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      // modalities is an OpenRouter extension; other OpenAI-compatible endpoints reject it.
      ...(provider === 'openrouter' ? { modalities: ['image', 'text'] } : {}),
      messages: [{ role: 'user', content: userContent }],
    }),
  }, { ...requestSettings, retryOnTransportErrors: false }, `${getProviderConfig(provider).shortLabel} image API error`)
  return extractImageOrThrowModelError(dataJson)
}

async function chatWithGemini(options: AiChatOptions, apiKey: string, model: string): Promise<string> {
  if (!model) throw new Error('Load the Gemini model list and select a model in AI Settings first.')
  const parts = (content: AiChatMessage['content']) => typeof content === 'string'
    ? [{ text: content }]
    : content.map((part) => part.type === 'text' ? { text: part.text } : { inlineData: (() => {
      const image = splitDataUrl(part.dataUrl)
      return { mimeType: image.mediaType, data: image.data }
    })() })
  const system = options.messages.filter((message) => message.role === 'system').flatMap((message) => parts(message.content))
  const body = {
    ...(system.length ? { systemInstruction: { parts: system } } : {}),
    contents: options.messages.filter((message) => message.role !== 'system').map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user', parts: parts(message.content),
    })),
    generationConfig: {
      ...(options.maxTokens ? { maxOutputTokens: Math.max(options.maxTokens, 2048) } : {}),
      ...(options.forceJsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }
  const data = await requestJsonWithRetry('google', 'generate content',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body),
    }, options, 'Gemini API error') as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
      promptFeedback?: { blockReason?: string }
    }
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? '').join('').trim()
  if (!text) throw new AiClientError('parse', `Gemini returned no text (${data.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'empty response'}). Try a text model or a different prompt.`)
  if (candidate?.finishReason === 'MAX_TOKENS') throw new AiClientError('parse', 'Gemini output was truncated. Translate fewer layers at once or select another model.')
  return text
}


async function editImageWithGemini(options: AiImageEditOptions, apiKey: string, model: string): Promise<string> {
  if (!model) throw new Error('Select a Gemini image model in AI Settings first.')
  const image = splitDataUrl(options.imageDataUrl)
  const data = await requestJsonWithRetry('google', 'edit image',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: options.prompt }, { inlineData: { mimeType: image.mediaType, data: image.data } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }, { ...options, retryOnTransportErrors: false }, 'Gemini image API error') as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; thought?: boolean }[] } }[]
    }
  const result = data.candidates?.[0]?.content?.parts?.find((part) => !part.thought && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data)?.inlineData
  if (!result?.data) throw new Error('Gemini returned no image. Select an image-generation model from the model list and try again.')
  return `data:${result.mimeType};base64,${result.data}`
}
