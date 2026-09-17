import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useApiKeysStore } from '@/store/apiKeys'
import { LANGUAGES } from '@/utils/locale'
import { collectCanvasTexts, translateCanvasSlide, type CanvasTextTarget } from '@/ai/features/translateCanvas'
import type { AiAuth } from '@/ai/features/translateText'
import type { CanvasTranslationPatch } from '@/store/slices/translateSlice'
import { ModalShell } from '@/components/ui/ModalShell'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

interface TranslateCanvasModalProps {
  open: boolean
  onClose: () => void
  /** Opened when there is no API key yet, so the flow can be finished in place. */
  onNeedsApiKey: () => void
}

type Scope = 'slide' | 'project'
type Phase = 'idle' | 'running' | 'done' | 'error'

/**
 * Translate every string on the canvas in one go.
 *
 * Deliberately separate from the localisation view. That view maintains a
 * *matrix* — the same design in nine languages, each kept in its own locale
 * column. This one rewrites the design itself, which is what someone means by
 * "make this Pashto": one target language, in place, chips and grouped layers
 * included, and one undo step if they change their mind.
 */
export function TranslateCanvasModal({ open, onClose, onNeedsApiKey }: TranslateCanvasModalProps) {
  const t = useT()
  const { project, activeSlideGroupId, applyCanvasTranslations } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    applyCanvasTranslations: s.applyCanvasTranslations,
  })))
  const { provider, getActiveKey, getActiveModel, getActiveBaseUrl } = useApiKeysStore()

  const [scope, setScope] = useState<Scope>('slide')
  const [target, setTarget] = useState('ps')
  const [phase, setPhase] = useState<Phase>('idle')
  const [done, setDone] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Reset on the closed edge, in render: the shell keeps the body mounted for
  // one exit frame, so an effect would leave the last run's result showing.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) { setPhase('idle'); setDone(0); setFailedCount(0); setError(null) }
  }

  const groups = useMemo(
    () => (scope === 'project'
      ? project.slideGroups
      : project.slideGroups.filter((group) => group.id === activeSlideGroupId)),
    [project.slideGroups, scope, activeSlideGroupId],
  )
  const targets = useMemo(
    () => groups.flatMap((group): CanvasTextTarget[] => collectCanvasTexts(group)),
    [groups],
  )

  const run = async () => {
    const apiKey = getActiveKey()
    if (!apiKey) { onNeedsApiKey(); return }
    if (targets.length === 0) return

    setPhase('running')
    setDone(0)
    setFailedCount(0)
    setError(null)

    const auth: AiAuth = { provider, apiKey, model: getActiveModel(), baseUrl: getActiveBaseUrl() }
    const patches: CanvasTranslationPatch[] = []
    let failed = 0
    let completed = 0

    try {
      // Slide by slide rather than all at once: one request carrying every
      // string in the project would blow the token budget on a nine-slide
      // deck, and a slide is the unit whose wording has to agree anyway.
      for (const group of groups) {
        const slideTargets = targets.filter((item) => item.slideGroupId === group.id)
        if (slideTargets.length === 0) continue
        const base = completed
        const result = await translateCanvasSlide({
          auth,
          project,
          slideGroup: group,
          targets: slideTargets,
          targetLocale: target,
          onProgress: (count) => setDone(base + count),
        })
        for (const translation of result.translations) {
          patches.push({
            slideGroupId: translation.target.slideGroupId,
            layerId: translation.target.layerId,
            text: translation.text,
            marks: translation.marks,
          })
        }
        failed += result.failed.length
        completed += slideTargets.length
        setDone(completed)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setPhase('error')
      // Whatever did come back is still applied: a half-translated design is
      // better than a wasted call, and one undo puts it all back.
      applyCanvasTranslations(patches)
      return
    }

    applyCanvasTranslations(patches)
    setFailedCount(failed)
    setPhase('done')
  }

  const running = phase === 'running'

  return (
    <ModalShell
      open={open}
      onClose={running ? () => {} : onClose}
      title={t('translateAll.title')}
      maxWidth="max-w-lg"
      bodyClassName="pd-translate-all"
      closeOnBackdrop={!running}
      showCloseButton={!running}
    >
      <p className="pd-translate-all-lede">{t('translateAll.lede')}</p>

      <div className="pd-translate-all-field">
        <label className="pd-translate-all-label" htmlFor="pd-translate-scope">{t('translateAll.scope')}</label>
        <div className="pd-icon-source pd-translate-all-scope" id="pd-translate-scope" role="group" aria-label={t('translateAll.scope')}>
          <button type="button" role="tab" aria-selected={scope === 'slide'} disabled={running} onClick={() => setScope('slide')}>
            {t('translateAll.scopeSlide')}
          </button>
          <button type="button" role="tab" aria-selected={scope === 'project'} disabled={running} onClick={() => setScope('project')}>
            {t('translateAll.scopeProject', { count: project.slideGroups.length })}
          </button>
        </div>
      </div>

      <div className="pd-translate-all-field">
        <label className="pd-translate-all-label" htmlFor="pd-translate-target">{t('translateAll.target')}</label>
        <select
          id="pd-translate-target"
          className="pd-translate-all-select"
          value={target}
          disabled={running}
          onChange={(event) => setTarget(event.target.value)}
        >
          {/* The three interface languages first: they are what this app's own
              users translate into most, and hunting for Pashto at the bottom
              of an alphabetical list of fifty is its own small insult. */}
          <option value="ps">Pashto — پښتو</option>
          <option value="fa">Persian / Dari — دری</option>
          <option value="ar">Arabic — العربية</option>
          <option disabled>──────────</option>
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.name}</option>
          ))}
        </select>
      </div>

      <p className="pd-translate-all-count">
        <Icon name="text" size={13} />
        {targets.length === 1 ? t('translateAll.foundOne') : t('translateAll.found', { count: targets.length })}
      </p>

      {running && (
        <p className="pd-translate-all-progress" role="status">
          <Icon name="spinner" size={13} className="pd-spin-slow" />
          {t('translateAll.progress', { done, total: targets.length })}
        </p>
      )}

      {phase === 'done' && (
        <p className={failedCount > 0 ? 'pd-translate-all-warn' : 'pd-translate-all-ok'} role="status">
          <Icon name={failedCount > 0 ? 'alert-triangle' : 'check'} size={13} />
          {failedCount > 0
            ? t('translateAll.partial', { count: targets.length - failedCount, failed: failedCount })
            : t('translateAll.complete', { count: targets.length })}
        </p>
      )}

      {phase === 'error' && error && (
        <p className="pd-translate-all-error" role="alert"><Icon name="alert-triangle" size={13} />{error}</p>
      )}

      <div className="pd-translate-all-actions">
        <button type="button" className="pd-translate-all-cancel" disabled={running} onClick={onClose}>
          {phase === 'done' ? t('common.close') : t('common.cancel')}
        </button>
        <button
          type="button"
          className="pd-translate-all-run"
          disabled={running || targets.length === 0}
          onClick={() => void run()}
        >
          <Icon name={running ? 'spinner' : 'languages'} size={14} className={running ? 'pd-spin-slow' : undefined} />
          {phase === 'done' ? t('translateAll.again') : t('translateAll.run')}
        </button>
      </div>
    </ModalShell>
  )
}
