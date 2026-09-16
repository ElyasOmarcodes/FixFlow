import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FillValue } from '@/types'
import { fillToCss } from '@/utils/gradients'
import { useT } from '@/i18n'
const category = (fill: FillValue) => typeof fill === 'string' ? 'solid' : fill.type
const useRecentFills = create<{ fills: FillValue[]; remember: (fill: FillValue) => void }>()(persist((set) => ({
  fills: [],
  remember: (fill) => set((state) => {
    const id = JSON.stringify(fill)
    if (typeof fill === 'string' && !/^(#[\da-f]{3,8}|rgba?\([^)]*\))$/i.test(fill)) return state
    const others = state.fills.filter((item) => JSON.stringify(item) !== id)
    const same = others.filter((item) => category(item) === category(fill)).slice(0, 39)
    return { fills: [fill, ...same, ...others.filter((item) => category(item) !== category(fill))] }
  }),
}), { name: 'pixeldeck.recent-fills-v1' }))
export function RecentFills({ fill, onChange }: { fill: FillValue; onChange: (value: FillValue) => void }) {
  const t = useT()
  const { fills, remember } = useRecentFills()
  const latest = useRef(fill)
  useEffect(() => { latest.current = fill }, [fill])
  useEffect(() => () => remember(latest.current), [remember])
  useEffect(() => { const timer = setTimeout(() => remember(fill), 650); return () => clearTimeout(timer) }, [fill, remember])
  const recent = fills.filter((item) => category(item) === category(fill))
  if (!recent.length) return null
  return <div className="pd-recent-fills"><p className="mb-1 text-xs">{t(typeof fill === 'string' ? 'actions.recentColors' : 'actions.recentGradients')}</p><div className="flex gap-2 overflow-x-auto pb-1">{recent.map((item, index) => <button key={JSON.stringify(item)} aria-label={`${t(typeof item === 'string' ? 'actions.recentColors' : 'actions.recentGradients')} ${index + 1}`} title={typeof item === 'string' ? item : item.type} onClick={() => onChange(item)} style={{ background: fillToCss(item) }} className="h-7 w-7 shrink-0 rounded-md border border-[var(--pd-field-border)]" />)}</div></div>
}
