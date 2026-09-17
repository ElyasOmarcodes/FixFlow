import type { ReactNode } from 'react'

type ShortcutRow = { keys: ReactNode; desc: string }

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-h-6 items-center whitespace-nowrap rounded-md border border-[var(--pd-line)] bg-[var(--pd-c-1e1e28)] px-1.5 font-mono text-[10px] font-medium text-[var(--pd-c-d8d8e2)] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  )
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 border-b border-[var(--pd-line-subtle)] pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pd-c-9b8fff)] first:mt-0">
      {children}
    </div>
  )
}

export function ShortcutTable({ rows }: { rows: ShortcutRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--pd-line)]">
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-[var(--pd-fill)]' : 'bg-transparent'}>
              <td className="w-[46%] border-r border-[var(--pd-line)] px-3 py-2.5 text-[var(--pd-c-777786)] sm:w-[42%]">
                <span className="flex flex-wrap items-center gap-1">{row.keys}</span>
              </td>
              <td className="px-3 py-2.5 text-[var(--pd-c-b0b0c4)]">{row.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GuideText({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] leading-7 text-[var(--pd-c-b0b0c4)]">{children}</p>
}

export function P({ children }: { children: ReactNode }) {
  return <GuideText>{children}</GuideText>
}

export function GuideList({ children }: { children: ReactNode }) {
  return <ul className="m-0 space-y-3.5 p-0 text-[13px] leading-6 text-[var(--pd-c-a0a0b0)]">{children}</ul>
}

export function GuideItem({ children, tone = 'purple' }: { children: ReactNode; tone?: 'purple' | 'amber' | 'teal' }) {
  const dot = tone === 'amber' ? 'bg-[#f2b84b]' : tone === 'teal' ? 'bg-[#48c7bf]' : 'bg-[#8f82ff]'
  return (
    <li className="relative list-none pl-5">
      <span className={`absolute start-0 top-[10px] h-1.5 w-1.5 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
      {children}
    </li>
  )
}

export function Li({ children }: { children: ReactNode }) {
  return <GuideItem>{children}</GuideItem>
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[var(--pd-c-d8d8e2)]">{children}</strong>
}

export function Callout({ children, tone = 'purple', label }: { children: ReactNode; tone?: 'purple' | 'amber' | 'teal'; label?: string }) {
  const styles = {
    purple: 'border-[var(--pd-accent-soft)] bg-[var(--pd-accent-wash)] text-[var(--pd-c-c4b5fd)]',
    amber: 'border-[rgba(242,184,75,0.22)] bg-[rgba(242,184,75,0.055)] text-[var(--pd-warn)]',
    teal: 'border-[rgba(72,199,191,0.22)] bg-[rgba(72,199,191,0.055)] text-[var(--pd-info)]',
  }
  return (
    <div className={`my-5 rounded-xl border px-4 py-3.5 text-[12px] leading-6 ${styles[tone]}`}>
      {label && <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] opacity-80">{label}</div>}
      {children}
    </div>
  )
}
