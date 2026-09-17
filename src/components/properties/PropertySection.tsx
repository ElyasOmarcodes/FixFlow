import { useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * A titled group of properties.
 *
 * The panel used to be a stack of identical bordered boxes with no headings:
 * a slider called "Blur" sat in the same anonymous card as a shadow toggle,
 * and a person had no way to tell which control belonged to what, or where
 * one idea ended and the next began. Every group now says what it is, carries
 * an icon so it can be found by shape rather than by reading, and collapses —
 * so a long panel can be reduced to the two or three things being worked on.
 *
 * Collapsed state is remembered per section across sessions, because it is a
 * statement about how this person works, not about this layer.
 */

interface CollapsedState {
  collapsed: Record<string, boolean>
  toggle: (id: string) => void
}

const useCollapsed = create<CollapsedState>()(
  persist(
    (set) => ({
      collapsed: {},
      toggle: (id) => set((state) => ({ collapsed: { ...state.collapsed, [id]: !state.collapsed[id] } })),
    }),
    { name: 'pixeldeck.property-sections-v1' },
  ),
)

interface PropertySectionProps {
  /** Stable id — what the remembered collapsed state is keyed by. */
  id: string
  title: string
  icon?: IconName
  /** Shown on the header row, for a toggle that governs the whole section. */
  action?: ReactNode
  /** One line under the title, for a section whose purpose is not obvious. */
  hint?: string
  /** Sections a person opens for a specific task start closed. */
  defaultCollapsed?: boolean
  children: ReactNode
}

export function PropertySection({
  id, title, icon, action, hint, defaultCollapsed, children,
}: PropertySectionProps) {
  const { collapsed, toggle } = useCollapsed()
  const isCollapsed = collapsed[id] ?? defaultCollapsed ?? false
  const [bodyId] = useState(() => `pd-section-${id}`)

  return (
    <section className="pd-prop-section" data-collapsed={isCollapsed || undefined}>
      <div className="pd-prop-head">
        <button
          type="button"
          className="pd-prop-title"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          onClick={() => toggle(id)}
        >
          <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={12} className="pd-prop-caret" />
          {icon && <Icon name={icon} size={13} />}
          <span>{title}</span>
        </button>
        {action && <div className="pd-prop-action">{action}</div>}
      </div>
      {!isCollapsed && (
        <div id={bodyId} className="pd-prop-body">
          {hint && <p className="pd-prop-hint">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

/** A labelled pair of controls side by side, for properties that belong together. */
export function PropertyPair({ children }: { children: ReactNode }) {
  return <div className="pd-prop-pair">{children}</div>
}
