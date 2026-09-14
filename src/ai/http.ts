import { Capacitor, CapacitorHttp } from '@capacitor/core'

/** Use the Android networking stack; WebView CORS/origin policy must not block BYOK. */
export async function aiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (Capacitor.getPlatform() !== 'android' || init.body instanceof FormData) return fetch(url, init)
  if (init.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
  const headers = Object.fromEntries(new Headers(init.headers).entries())
  const response = await CapacitorHttp.request({
    url,
    method: init.method ?? 'GET',
    headers,
    data: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    responseType: 'text',
    connectTimeout: 20000,
    readTimeout: 60000,
  })
  if (init.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
  return new Response(typeof response.data === 'string' ? response.data : JSON.stringify(response.data), {
    status: response.status, headers: response.headers,
  })
}
