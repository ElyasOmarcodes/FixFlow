import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { ThemeControl } from './ThemeControl'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { IconName } from '@/components/ui/Icon'

/**
 * The "more tools" sheet on phones and tablets.
 *
 * It replaces what used to happen here: the desktop toolbar was un-hidden and
 * left to wrap, so a row built for 1440px folded into four ragged lines of
 * unlabelled icons, dividers stranded mid-row and a 100px-wide select wedged
 * between them. A toolbar is a horizontal affordance; a phone has no
 * horizontal room. So the same actions are presented the way a phone presents
 * things — a bottom sheet of labelled targets, grouped by what they do.
 */

interface SheetAction {
  key: string
  icon: IconName
  label: string
  onClick: () => void
  disabled?: boolean
  /** Rendered filled, for the one action in a group that is the point of it. */
  primary?: boolean
  /** Shown pressed, for toggles. */
  active?: boolean
  href?: string
}

interface MobileMoreSheetProps {
  open: boolean
  onClose: () => void
  projectName: string
  onRenameProject: (name: string) => void
  groups: { key: string; title: string; actions: SheetAction[] }[]
  footer?: ReactNode
}

/** Matches --pd-dur-sheet, so the exit finishes before the node is removed. */
const EXIT_MS = 200

export function MobileMoreSheet({
  open,
  onClose,
  projectName,
  onRenameProject,
  groups,
  footer,
}: MobileMoreSheetProps) {
  const t = useT()
  const [mounted, setMounted] = useState(open)
  const [exiting, setExiting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(projectName)

  // The open→closed edge is handled during render rather than in an effect, so
  // the sheet starts leaving in the same commit it is dismissed.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setMounted(true); setExiting(false) } else { setExiting(true) }
    if (!open) setRenaming(false)
  }

  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => { setExiting(false); setMounted(false) }, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Derived during render rather than synced in an effect: the draft only has
  // to follow the project name while the field is closed, and an effect here
  // would clobber what the user is typing on any unrelated project update.
  const [lastProjectName, setLastProjectName] = useState(projectName)
  if (projectName !== lastProjectName) {
    setLastProjectName(projectName)
    if (!renaming) setDraftName(projectName)
  }

  if (!mounted) return null

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== projectName) onRenameProject(trimmed)
    setRenaming(false)
  }

  return createPortal(
    <div
      className={`pd-more-backdrop${exiting ? ' pd-more-exiting' : ''}`}
      onClick={exiting ? undefined : onClose}
      // While leaving, the sheet is still painted but is no longer a dialog:
      // it must not take a click meant for what is behind it, and a screen
      // reader must not announce something the user has already dismissed.
      aria-hidden={exiting || undefined}
      data-testid="more-backdrop"
    >
      <div
        className="pd-more-sheet"
        role={exiting ? undefined : 'dialog'}
        aria-modal={exiting ? undefined : 'true'}
        aria-label={t('workspace.more')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pd-more-header">
          {renaming ? (
            <input
              autoFocus
              className="pd-more-rename"
              value={draftName}
              aria-label={t('toolbar.renameProject')}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename()
                if (event.key === 'Escape') { setDraftName(projectName); setRenaming(false) }
              }}
            />
          ) : (
            <button
              type="button"
              className="pd-more-title"
              title={t('toolbar.renameProject')}
              onClick={() => setRenaming(true)}
            >
              <span>{projectName}</span>
              <Icon name="pencil" size={13} />
            </button>
          )}
          <button
            type="button"
            className="pd-more-close"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="pd-more-body">
          {groups.map((group) => (
            <section key={group.key} className="pd-more-group">
              <h3>{group.title}</h3>
              <div className="pd-more-grid">
                {group.actions.map((action) => action.href ? (
                  <a
                    key={action.key}
                    className="pd-more-item"
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                  >
                    <Icon name={action.icon} size={19} />
                    <span>{action.label}</span>
                  </a>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    className={[
                      'pd-more-item',
                      action.primary ? 'pd-more-item-primary' : '',
                      action.active ? 'pd-more-item-active' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={action.disabled}
                    aria-pressed={action.active}
                    onClick={action.onClick}
                  >
                    <Icon name={action.icon} size={19} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section className="pd-more-group">
            <h3>{t('workspace.theme')}</h3>
            <div className="pd-more-theme"><ThemeControl /></div>
          </section>

          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}
