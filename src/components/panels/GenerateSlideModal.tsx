import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useApiKeysStore } from '@/store/apiKeys'
import { generateSlidePlan } from '@/ai/features/generateSlide'
import type { AiAuth } from '@/ai/features/translateText'
import { backgroundFillFor, buildSlideLayers, canvasFor } from '@/utils/slidePlan'
import { ModalShell } from '@/components/ui/ModalShell'
import { Icon } from '@/components/ui/Icon'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useT, useUiLanguageStore } from '@/i18n'
import type { ChipLayer, TextLayer } from '@/types'

interface GenerateSlideModalProps {
  open: boolean
  onClose: () => void
  onNeedsApiKey: () => void
}

/**
 * Describe a slide, get a slide.
 *
 * The model writes the copy, chooses the glyphs and picks the palette; the app
 * lays it out (`buildSlideLayers`). So what lands on the canvas is a real
 * slide made of the same layer types the toolbar makes — every piece of it
 * selectable and editable afterwards — rather than a picture of one.
 */
export function GenerateSlideModal({ open, onClose, onNeedsApiKey }: GenerateSlideModalProps) {
  const t = useT()
  const language = useUiLanguageStore((s) => s.language)
  const { project, activeSlideGroupId, applyGeneratedSlide } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    applyGeneratedSlide: s.applyGeneratedSlide,
  })))
  const { provider, getActiveKey, getActiveModel, getActiveBaseUrl } = useApiKeysStore()

  const [brief, setBrief] = useState('')
  const [replace, setReplace] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Reset on the closed edge, in render: the shell keeps the body mounted for
  // one exit frame, so an effect would leave the last result showing.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) { setBusy(false); setError(null); setDone(false) }
  }

  const group = useMemo(
    () => project.slideGroups.find((item) => item.id === activeSlideGroupId),
    [project.slideGroups, activeSlideGroupId],
  )

  /** What the slide says now, so a second run can build on it rather than ignore it. */
  const existingCopy = useMemo(() => {
    if (!group) return []
    const found: string[] = []
    const visit = (layers: typeof group.layers) => {
      for (const layer of layers) {
        if (layer.type === 'group') visit(layer.children)
        else if (layer.type === 'text' && (layer as TextLayer).text.trim()) found.push((layer as TextLayer).text.trim())
        else if (layer.type === 'chip' && (layer as ChipLayer).text.trim()) found.push((layer as ChipLayer).text.trim())
      }
    }
    visit(group.layers)
    return found
  }, [group])

  const run = async () => {
    const apiKey = getActiveKey()
    if (!apiKey) { onNeedsApiKey(); return }
    if (!brief.trim() || !group) return

    setBusy(true)
    setError(null)
    setDone(false)
    const auth: AiAuth = { provider, apiKey, model: getActiveModel(), baseUrl: getActiveBaseUrl() }
    try {
      const plan = await generateSlidePlan({
        auth,
        brief: brief.trim(),
        locale: language,
        existingCopy: replace ? undefined : existingCopy,
      })
      applyGeneratedSlide(
        { layers: buildSlideLayers(plan, canvasFor(group)), background: backgroundFillFor(plan) },
        { replace },
      )
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t('generate.title')}
      maxWidth="max-w-lg"
      bodyClassName="pd-generate"
      closeOnBackdrop={!busy}
      showCloseButton={!busy}
    >
      <p className="pd-generate-lede">{t('generate.lede')}</p>

      <label className="pd-generate-field">
        <span className="pd-generate-label">{t('generate.brief')}</span>
        <textarea
          className="pd-generate-input"
          rows={3}
          value={brief}
          disabled={busy}
          placeholder={t('generate.placeholder')}
          onChange={(event) => setBrief(event.target.value)}
          onKeyDown={(event) => {
            // The shortcut every prompt box has, so a one-line brief does not
            // need a trip to the mouse.
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void run()
          }}
        />
      </label>

      <div className="pd-generate-row">
        <div>
          <p className="pd-generate-switch-label">{t('generate.replace')}</p>
          <p className="pd-generate-hint">{replace ? t('generate.replaceOn') : t('generate.replaceOff')}</p>
        </div>
        <ToggleSwitch
          checked={replace}
          onChange={setReplace}
          ariaLabel={t('generate.replace')}
          size="lg"
        />
      </div>

      {busy && (
        <p className="pd-generate-progress" role="status">
          <Icon name="spinner" size={13} className="pd-spin-slow" />
          {t('generate.working')}
        </p>
      )}
      {done && !busy && (
        <p className="pd-generate-ok" role="status"><Icon name="check" size={13} />{t('generate.done')}</p>
      )}
      {error && (
        <p className="pd-generate-error" role="alert"><Icon name="alert-triangle" size={13} />{error}</p>
      )}

      <div className="pd-generate-actions">
        <button type="button" className="pd-generate-cancel" disabled={busy} onClick={onClose}>
          {done ? t('common.close') : t('common.cancel')}
        </button>
        <button
          type="button"
          className="pd-generate-run"
          disabled={busy || !brief.trim()}
          onClick={() => void run()}
        >
          <Icon name={busy ? 'spinner' : 'sparkles'} size={14} className={busy ? 'pd-spin-slow' : undefined} />
          {done ? t('generate.again') : t('generate.run')}
        </button>
      </div>
    </ModalShell>
  )
}
