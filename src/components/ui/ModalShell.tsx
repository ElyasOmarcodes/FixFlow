import { createPortal } from 'react-dom'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

function shouldCloseModalForKey(key: string): boolean {
  return key === 'Escape'
}

/**
 * Must match `--pd-dur-fast`. A dialog that vanishes on the frame it is
 * dismissed reads as a glitch; letting it fade out is the difference between
 * a web page and an app. Kept short on purpose — a slow dismissal makes the
 * whole UI feel sluggish, because the user has already moved on.
 */
const EXIT_MS = 140

/** Reduced-motion users asked for no animation, so there is nothing to wait for. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Keeps the modal mounted for one exit animation after `open` goes false.
 * Returns whether to render at all, and whether the render is an exit.
 *
 * The open→closed edge is detected during render (React's documented way to
 * adjust state when a prop changes) rather than in an effect, so the exiting
 * render happens in the same commit the dialog is dismissed — no frame where
 * the dialog is still shown as interactive.
 */
function useExitTransition(open: boolean): { mounted: boolean; exiting: boolean } {
  const [wasOpen, setWasOpen] = useState(open)
  const [exiting, setExiting] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    setExiting(!open && !prefersReducedMotion())
  }

  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => setExiting(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])

  return { mounted: open || exiting, exiting }
}

interface ModalShellProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  header?: ReactNode
  maxWidth?: string
  backdropClassName?: string
  panelClassName?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
  backdropStyle?: CSSProperties
  panelStyle?: CSSProperties
  closeButtonClassName?: string
  closeButtonStyle?: CSSProperties
  closeLabel?: string
  closeGlyph?: ReactNode
  showCloseButton?: boolean
  closeOnEscape?: boolean
  onEscape?: () => void
  closeOnBackdrop?: boolean
}

export function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  header,
  maxWidth = 'max-w-2xl',
  backdropClassName = 'fixed inset-0 flex items-center justify-center backdrop-blur-sm',
  panelClassName = 'relative rounded-2xl border shadow-2xl w-full mx-4 flex flex-col overflow-hidden',
  headerClassName = 'px-5 py-4 border-b border-[var(--pd-line-subtle)] shrink-0',
  bodyClassName,
  footerClassName,
  backdropStyle = { background: 'rgba(0,0,0,0.65)' },
  panelStyle = { background: 'var(--pd-c-18181f)', borderColor: 'rgba(255,255,255,0.1)' },
  closeButtonClassName = 'absolute top-4 end-4 z-10 text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)] transition-colors text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--pd-fill)]',
  closeButtonStyle,
  closeLabel = 'Close modal',
  closeGlyph = <Icon name="close" size={15} />,
  showCloseButton = true,
  closeOnEscape = true,
  onEscape,
  closeOnBackdrop = true,
}: ModalShellProps) {
  const { mounted, exiting } = useExitTransition(open)

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handler = (event: KeyboardEvent) => {
      if (shouldCloseModalForKey(event.key)) (onEscape ?? onClose)()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeOnEscape, onClose, onEscape, open])

  if (!mounted) return null

  return createPortal(
    <div
      // While exiting the dialog is on its way out: it must not take clicks,
      // and `aria-hidden` keeps it out of the accessibility tree so a screen
      // reader does not announce a dialog the user has already dismissed.
      className={`pd-modal-backdrop ${exiting ? 'pd-modal-exiting ' : ''}${backdropClassName}`}
      style={backdropStyle}
      onClick={closeOnBackdrop && !exiting ? onClose : undefined}
      aria-hidden={exiting || undefined}
      data-testid="modal-backdrop"
    >
      <div
        role={exiting ? undefined : 'dialog'}
        aria-modal={exiting ? undefined : 'true'}
        aria-label={typeof title === 'string' ? title : undefined}
        className={`pd-modal-panel ${panelClassName} ${maxWidth}`.trim()}
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        {header ?? (title !== undefined && (
          <div className={headerClassName}>
            <h2 className="text-base font-semibold text-[var(--pd-c-e8e8f0)]">{title}</h2>
          </div>
        ))}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={closeButtonClassName}
            style={closeButtonStyle}
            aria-label={closeLabel}
          >
            {closeGlyph}
          </button>
        )}
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
        {footer !== undefined && (
          <div className={footerClassName}>{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
