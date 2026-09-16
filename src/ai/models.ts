import { aiFetch } from './http'
import { getProviderConfig } from '@/ai/providers'
import { formatAiNetworkError, formatProviderHttpError } from '@/ai/errors'
import { buildOpenAiCompatibleHeaders } from '@/ai/headers'
import type { AiModel, AiProvider } from '@/ai/providers'

interface RemoteModel {
  supportedGenerationMethods?: string[]
  id?: string
  name?: string
  display_name?: string
  displayName?: string
  description?: string
  context_length?: number
  contextLength?: number
  max_input_tokens?: number
  inputTokenLimit?: number
}

export async function listModels(provider: AiProvider, apiKey: string, baseUrlOverride?: string): Promise<AiModel[]> {
  const config = getProviderConfig(provider)
  const key = apiKey.trim()
  if (!key) throw new Error('Add an API key before loading models.')
  if (provider === 'google') return listGoogleModels(key)
  const customBaseUrl = baseUrlOverride?.trim()
  if (provider === 'custom' && !customBaseUrl) throw new Error('No custom API base URL configured.')
  const modelsUrl = provider === 'custom' ? `${customBaseUrl!.replace(/\/+$/, '')}/models` : config.modelsUrl
  if (!modelsUrl) throw new Error(`${config.label} does not expose a model list endpoint.`)

  let res: Response
  try {
    res = await aiFetch(modelsUrl, {
      headers: buildOpenAiCompatibleHeaders(provider, key),
    })
  } catch (error) {
    const fallbackModels = getFallbackModels(provider)
    if (fallbackModels.length) return fallbackModels
    throw formatAiNetworkError(provider, 'load models', error)
  }
  if (!res.ok) throw new Error(await readErrorMessage(res, provider))

  const data = await res.json()
  const remoteModels = getRemoteModels(data)
  const models = remoteModels
    .map((model) => normalizeModel(model))
    .filter((model: AiModel | null): model is AiModel => Boolean(model))

  if (!models.length) throw new Error('The provider returned no compatible models.')
  return sortModels(dedupeModels(models))
}

function getFallbackModels(provider: AiProvider): AiModel[] {
  const models = FALLBACK_MODELS[provider] ?? []
  return sortModels(dedupeModels(models))
}

const FALLBACK_MODELS: Partial<Record<AiProvider, AiModel[]>> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    { id: 'gpt-4o', name: 'gpt-4o' },
    { id: 'gpt-image-1', name: 'gpt-image-1' },
  ],

}

async function readErrorMessage(res: Response, provider: AiProvider): Promise<string> {
  const fallback = `Could not load models (${res.status} ${res.statusText}).`
  try {
    const text = await res.text()
    if (!text.trim()) return fallback
    // Surface the provider's own sentence plus what to do about it, rather
    // than pasting the raw JSON body into the settings panel.
    return formatProviderHttpError('', res.status, text, provider)
  } catch {
    return fallback
  }
}

function getRemoteModels(data: unknown): RemoteModel[] {
  if (!data || typeof data !== 'object') return []
  const record = data as { data?: unknown; models?: unknown }
  if (Array.isArray(record.data)) return record.data as RemoteModel[]
  if (Array.isArray(record.models)) return record.models as RemoteModel[]
  if (Array.isArray(data)) return data as RemoteModel[]
  return []
}

function normalizeModel(model: RemoteModel): AiModel | null {
  const rawId = model.id ?? model.name
  if (!rawId) return null
  const id = rawId.replace(/^models\//, '')
  return {
    id,
    name: model.display_name || model.displayName || model.name || model.id || id,
    description: model.description,
    contextLength: model.context_length ?? model.contextLength ?? model.max_input_tokens ?? model.inputTokenLimit,
  }
}

function dedupeModels(models: AiModel[]): AiModel[] {
  return [...new Map(models.map((model) => [model.id, model])).values()]
}

function sortModels(models: AiModel[]): AiModel[] {
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

export function searchModels(models: AiModel[], query: string): AiModel[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return models
  return models.filter(
    (model) =>
      model.id.toLowerCase().includes(normalized) ||
      model.name.toLowerCase().includes(normalized) ||
      model.description?.toLowerCase().includes(normalized),
  )
}

/** Discover the current catalogue; never claim stale fallback IDs are active. */
async function listGoogleModels(key: string): Promise<AiModel[]> {
  const models: AiModel[] = []
  const seen = new Set<string>()
  let token = ''
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('pageSize', '1000')
    if (token) url.searchParams.set('pageToken', token)
    let response: Response
    try {
      response = await aiFetch(url.toString(), {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(20000),
      })
    } catch (error) {
      throw formatAiNetworkError('google', 'load models', error)
    }
    if (!response.ok) throw new Error(await readErrorMessage(response, 'google'))
    const data = await response.json() as { models?: RemoteModel[]; nextPageToken?: string }
    for (const model of data.models ?? []) {
      if (!model.supportedGenerationMethods?.includes('generateContent')) continue
      const normalized = normalizeModel(model)
      if (normalized) models.push(normalized)
    }
    token = data.nextPageToken ?? ''
    if (token && seen.has(token)) throw new Error('The provider repeated a model page. Please retry.')
    seen.add(token)
  } while (token)
  if (!models.length) throw new Error('Google returned no models supporting content generation for this key.')
  return sortModels(dedupeModels(models))
}
