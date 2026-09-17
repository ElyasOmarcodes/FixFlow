/**
 * FixFlow open-core extensibility seam.
 *
 * The core app is fully local-first and has zero dependency on any SaaS
 * backend. A separate (private) SaaS wrapper can inject alternative AI
 * transport and/or project storage implementations by setting
 * `window.__FIXFLOW_CONFIG__` before this app boots.
 *
 * Resolution is intentionally LAZY and UNCACHED: `getFixFlowConfig()` reads
 * `window.__FIXFLOW_CONFIG__` fresh on every call. Do not memoize this at
 * module scope — a config injected after this module first evaluates (e.g. by
 * a script that runs after the bundle starts executing) must still be picked
 * up by subsequent calls.
 */

import type { AiTransport } from '@/ai/transport'
import type { ProjectStorageAdapter } from '@/store/storage/types'

export interface FixFlowConfig {
  /** Override the AI transport (default: direct fetch via src/ai/client.ts). */
  aiTransport?: AiTransport
  /** Override project persistence (default: localStorage-based adapter). */
  projectStorage?: ProjectStorageAdapter
}

declare global {
  interface Window {
    __FIXFLOW_CONFIG__?: FixFlowConfig
  }
}

/**
 * Resolve the current FixFlow config. Always re-reads `window` at call
 * time — never cache the result in a module-level constant.
 */
export function getFixFlowConfig(): FixFlowConfig {
  if (typeof window === 'undefined') return {}
  return window.__FIXFLOW_CONFIG__ ?? {}
}
