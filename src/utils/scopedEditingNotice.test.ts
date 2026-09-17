import { describe, it, expect, beforeEach } from 'vitest'
import { markScopedNoticeSeen, resetScopedNoticesSeen } from './scopedEditingNotice'

/** A tiny in-memory localStorage, since the suite runs on the node environment. */
function installStorage(impl?: Partial<Storage>) {
  const data = new Map<string, string>()
  const store: Storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size },
    ...impl,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = { localStorage: store }
  return data
}

beforeEach(() => { installStorage(); resetScopedNoticesSeen() })

describe('scoped editing notice', () => {
  it('remembers each kind separately', async () => {
    const data = installStorage()
    resetScopedNoticesSeen()
    markScopedNoticeSeen('format')
    expect(JSON.parse(data.get('pixeldeck:scoped-notice-seen')!)).toEqual(['format'])
    markScopedNoticeSeen('locale')
    expect(new Set(JSON.parse(data.get('pixeldeck:scoped-notice-seen')!))).toEqual(new Set(['format', 'locale']))
  })

  it('is idempotent, so a re-render cannot rewrite storage', () => {
    const data = installStorage()
    resetScopedNoticesSeen()
    markScopedNoticeSeen('format')
    const first = data.get('pixeldeck:scoped-notice-seen')
    markScopedNoticeSeen('format')
    expect(data.get('pixeldeck:scoped-notice-seen')).toBe(first)
  })

  it('reset clears the record', () => {
    const data = installStorage()
    markScopedNoticeSeen('format')
    resetScopedNoticesSeen()
    expect(data.has('pixeldeck:scoped-notice-seen')).toBe(false)
  })

  it('survives storage that throws, rather than taking the app down', () => {
    // A private window, or blocked site data: the notice simply shows again.
    installStorage({
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    })
    expect(() => { resetScopedNoticesSeen(); markScopedNoticeSeen('format') }).not.toThrow()
  })
})
