import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useAssistantStore, MAX_ASSISTANT_WIDTH, MIN_ASSISTANT_WIDTH } from '@/store/assistant'
import type { AssistantMessage } from '@/store/assistant'
import { useApiKeysStore } from '@/store/apiKeys'
import { useCompactLayout } from '@/hooks/useCompactLayout'
import { Icon } from '@/components/ui/Icon'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useT } from '@/i18n'

/**
 * The assistant dock.
 *
 * A conversation that edits the canvas, docked beside it rather than floated
 * over it: this is a panel you work *with*, not a dialog you dismiss. It keeps
 * its own width, because how much room a conversation deserves next to a
 * design is a per-person answer.
 *
 * The transcript shows what was actually done, not just what was said. A turn
 * that added three layers and grouped them says so, foldable, because "I have
 * updated your slide" with no list is exactly the kind of claim a person
 * cannot check.
 */
interface AssistantPanelProps {
  /**
   * Rendered inside the mobile sheet rather than as the desktop dock.
   *
   * The two differ in what controls their visibility: the dock is governed by
   * its own remembered preference, while the sheet is one of the surfaces the
   * bottom bar switches between — and on a phone the width grip and the
   * "close the dock" button would both be lies.
   */
  embedded?: boolean
  onClose?: () => void
}

export function AssistantPanel({ embedded = false, onClose }: AssistantPanelProps = {}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const threadRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const { open, width, messages, busy, readOnly, setOpen, setWidth, setReadOnly, send, stop, clear, revert } =
    useAssistantStore(useShallow((state) => ({
      open: state.open,
      width: state.width,
      messages: state.messages,
      busy: state.busy,
      readOnly: state.readOnly,
      setOpen: state.setOpen,
      setWidth: state.setWidth,
      setReadOnly: state.setReadOnly,
      send: state.send,
      stop: state.stop,
      clear: state.clear,
      revert: state.revert,
    })))

  // Not merely hidden below 1024px: a dock left mounted on a phone is a second
  // transcript and a second composer in the accessibility tree, and its
  // textarea competes for focus with the sheet's.
  const compact = useCompactLayout()

  const selectionCount = useEditorStore((state) => (
    state.selectedLayerIds.length || (state.selection ? 1 : 0)
  ))
  const model = useApiKeysStore((state) => state.getActiveModel())

  // Follow the conversation as it grows, the way every chat does.
  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    void send(text)
  }, [draft, busy, send])

  // Drag the inline-start edge. Pointer capture rather than window listeners:
  // the drag must survive the pointer crossing the canvas, which swallows
  // events of its own.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startWidth = width
    const rtl = document.documentElement.dir === 'rtl'
    const move = (moveEvent: PointerEvent) => {
      const delta = (startX - moveEvent.clientX) * (rtl ? -1 : 1)
      setWidth(startWidth + delta)
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  if (!embedded && (!open || compact)) return null

  return (
    <aside
      className={embedded ? 'pd-assistant pd-assistant-embedded' : 'pd-assistant'}
      style={embedded ? undefined : { width }}
      aria-label={t('assistant.title')}
    >
      {!embedded && <div
        className="pd-assistant-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('assistant.resize')}
        aria-valuenow={width}
        aria-valuemin={MIN_ASSISTANT_WIDTH}
        aria-valuemax={MAX_ASSISTANT_WIDTH}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setWidth(width + 16)
          else if (event.key === 'ArrowRight') setWidth(width - 16)
        }}
      />}

      <header className="pd-assistant-header">
        <span className="pd-assistant-title"><Icon name="sparkles" size={16} />{t('assistant.title')}</span>
        {model && <span className="pd-assistant-model" title={model}>{model}</span>}
        <button type="button" onClick={clear} title={t('assistant.newChat')} aria-label={t('assistant.newChat')}>
          <Icon name="plus" size={16} />
        </button>
        <button type="button" onClick={() => (embedded ? onClose?.() : setOpen(false))} title={t('assistant.close')} aria-label={t('assistant.close')}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="pd-assistant-mode">
        <div>
          <p className="pd-assistant-mode-label">{t('assistant.readOnly')}</p>
          {readOnly && <p className="pd-assistant-hint">{t('assistant.readOnlyHint')}</p>}
        </div>
        <ToggleSwitch checked={readOnly} onChange={setReadOnly} ariaLabel={t('assistant.readOnly')} />
      </div>

      <div className="pd-assistant-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="pd-assistant-empty">
            <Icon name="sparkles" size={22} />
            <h3>{t('assistant.emptyTitle')}</h3>
            <p>{t('assistant.emptyBody')}</p>
            <div className="pd-assistant-suggestions">
              {([t('assistant.try1'), t('assistant.try2'), t('assistant.try3')]).map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => { setDraft(suggestion); inputRef.current?.focus() }}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageRow key={message.id} message={message} onRevert={() => revert(message.id)} />
          ))
        )}
        {busy && <p className="pd-assistant-busy"><Icon name="spinner" size={14} />{t('assistant.working')}</p>}
      </div>

      <form
        className="pd-assistant-composer"
        onSubmit={(event) => { event.preventDefault(); submit() }}
      >
        {selectionCount > 0 && (
          <p className="pd-assistant-context" title={t('assistant.selectionHint')}>
            <Icon name="layers" size={12} />
            {t('assistant.selected', { count: String(selectionCount) })}
          </p>
        )}
        <div className="pd-assistant-input">
          <textarea
            ref={inputRef}
            rows={2}
            value={draft}
            placeholder={t('assistant.placeholder')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line: this is a chat box,
              // and a person writing two sentences should not have to reach
              // for a modifier to send the first one.
              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
            }}
          />
          {busy ? (
            <button type="button" className="pd-assistant-send" onClick={stop} aria-label={t('assistant.stop')} title={t('assistant.stop')}>
              <Icon name="close" size={16} />
            </button>
          ) : (
            <button type="submit" className="pd-assistant-send" disabled={!draft.trim()} aria-label={t('assistant.send')} title={t('assistant.send')}>
              <Icon name="corner-down-left" size={16} />
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}

function MessageRow({ message, onRevert }: { message: AssistantMessage; onRevert: () => void }) {
  const t = useT()
  const calls = message.calls ?? []

  if (message.role === 'user') {
    return <div className="pd-assistant-msg pd-assistant-user"><p>{message.text}</p></div>
  }

  if (message.role === 'error') {
    // The store cannot translate — it has no hook — so it sends a sentinel.
    const text = message.text === '__needs-key__' ? t('assistant.needsKey') : message.text
    return (
      <div className="pd-assistant-msg pd-assistant-error">
        <p><Icon name="alert-triangle" size={14} />{t('assistant.failed')}</p>
        <p className="pd-assistant-error-body">{text}</p>
      </div>
    )
  }

  return (
    <div className="pd-assistant-msg pd-assistant-reply">
      {message.text && message.text.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {calls.length > 0 && (
        <details className="pd-assistant-calls">
          <summary>{t('assistant.changes', { count: String(calls.length) })}</summary>
          <ul>
            {calls.map((call, index) => (
              <li key={index} className={call.failed ? 'pd-assistant-call-failed' : undefined}>
                <Icon name={call.failed ? 'alert-triangle' : 'check'} size={12} />
                <code>{call.tool}</code>
                <span>{call.result}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {message.undoable && !message.reverted && (
        <button type="button" className="pd-assistant-revert" onClick={onRevert}>
          <Icon name="undo" size={12} />{t('assistant.revert')}
        </button>
      )}
      {message.reverted && <p className="pd-assistant-hint">{t('assistant.reverted')}</p>}
    </div>
  )
}
