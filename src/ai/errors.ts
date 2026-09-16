import type { AiProvider } from '@/ai/providers'

export function formatAiNetworkError(provider: AiProvider, action: string, error: unknown): Error {
  const cause = error instanceof Error && error.message ? error.message : 'Network request failed'
  const hint = 'Check your network connection and that the base URL is correct and allows direct browser requests (CORS). If this provider blocks browser CORS, use a different provider or a self-hosted proxy.'
  return new Error(`Could not ${action} for ${provider}. ${hint} (${cause})`)
}

/**
 * Pulls the human sentence out of a provider's error body.
 *
 * OpenAI, OpenRouter and Google all answer failures with JSON, and all three
 * put the useful part somewhere different:
 *
 *   OpenAI / OpenRouter  {"error": {"message": "…", "code": "…"}}
 *   Google               {"error": {"message": "…", "status": "PERMISSION_DENIED"}}
 *   Google (batch)       [{"error": {…}}]
 *
 * Without this the UI shows the raw body, so the one line that says what is
 * actually wrong ("Your API key was reported as leaked") arrives buried in
 * braces and quotes. Non-JSON bodies (an HTML error page from a proxy, say)
 * fall through and are returned trimmed and truncated.
 */
export function extractProviderErrorMessage(body: string): string | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // An HTML error page or a plain-text proxy message. Keep it short: these
    // can be kilobytes of markup and the UI shows the string verbatim.
    if (trimmed.startsWith('<')) return null
    return truncate(trimmed)
  }

  const root = Array.isArray(parsed) ? parsed[0] : parsed
  if (!root || typeof root !== 'object') return null
  const record = root as Record<string, unknown>

  const error = record.error
  if (typeof error === 'string' && error.trim()) return truncate(error)
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
    const message = errorRecord.message
    if (typeof message === 'string' && message.trim()) return truncate(message)
  }

  // Some OpenAI-compatible servers answer {"message": "…"} with no wrapper.
  const message = record.message
  if (typeof message === 'string' && message.trim()) return truncate(message)

  const detail = record.detail
  if (typeof detail === 'string' && detail.trim()) return truncate(detail)

  return null
}

/** Google's machine-readable reason, when it ships one — e.g. PERMISSION_DENIED. */
function providerErrorStatus(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body.trim())
    const root = Array.isArray(parsed) ? parsed[0] : parsed
    const error = (root as Record<string, unknown> | null)?.error
    const status = (error as Record<string, unknown> | null)?.status
    return typeof status === 'string' ? status : null
  } catch {
    return null
  }
}

/**
 * What the user should actually do about an HTTP status. The provider's own
 * sentence says what went wrong; this says what to change. Both are shown.
 */
function remedyForStatus(status: number, provider: AiProvider, body: string): string | null {
  const reason = providerErrorStatus(body) ?? ''
  const text = body.toLowerCase()

  if (status === 400 && text.includes('api_key_invalid')) {
    return 'The key was not accepted. Re-copy it from the provider — a truncated or whitespace-padded key fails this way.'
  }
  if (status === 401) {
    return 'The key was rejected. Check that it is current and belongs to the provider selected above.'
  }
  if (status === 403) {
    if (text.includes('leaked')) {
      return 'Google has disabled this key because it was published somewhere public. Delete it in AI Studio and create a new one — no amount of retrying will revive it.'
    }
    if (text.includes('referer') || text.includes('referrer')) {
      return `This key is restricted to specific websites, and ${provider} is rejecting the browser's origin. Remove the HTTP-referrer restriction on the key, or add this app's origin to it.`
    }
    if (reason === 'PERMISSION_DENIED') {
      return 'The key is valid but not allowed to call this API. Enable the Generative Language API for its project, or use a key created in AI Studio.'
    }
    return 'The provider refused the request for this key.'
  }
  if (status === 404) {
    return 'The model was not found. Pick one from the model list below — model ids are provider-specific and change over time.'
  }
  if (status === 429) {
    return 'Rate limit or quota reached. Wait a moment, or check the billing/quota page for this key.'
  }
  if (status >= 500) {
    return 'The provider had a server-side failure. This is usually temporary.'
  }
  return null
}

/**
 * One readable sentence for a failed provider call, for display in the UI.
 * Falls back to the status line when the body carries nothing usable.
 *
 * `label` names the operation ("Gemini API error"). Pass an empty string when
 * the caller's own surrounding text already says what failed, so the message
 * does not announce it twice.
 */
export function formatProviderHttpError(
  label: string,
  status: number,
  body: string,
  provider: AiProvider,
): string {
  const message = extractProviderErrorMessage(body)
  const remedy = remedyForStatus(status, provider, body)
  const head = message
    ? label ? `${label} (${status}): ${message}` : `HTTP ${status} — ${message}`
    : label ? `${label}: HTTP ${status}.` : `HTTP ${status}.`
  return remedy ? `${head} ${remedy}` : head
}

function truncate(value: string, max = 300): string {
  const clean = value.trim().replace(/\s+/g, ' ')
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
