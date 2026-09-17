import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_PANO_COMPENSATION_PX } from '@/utils/panoGeometry'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import type { PanoSettings, SlideGroup } from '@/types'
import { NUM_SLIDES_OPTIONS } from './slideOptions'

/**
 * Slide-count and panorama controls, as a card at the head of the slide strip.
 *
 * On a desktop these live in a labelled column beside the thumbnails. On a
 * phone that column has nowhere to go, so it used to become a floating panel
 * over the canvas that could only be shut by finding the same small summary
 * again — no Escape, no press-outside. Presenting it as the first card in the
 * strip puts it where the slides already are, and the panel it opens is a
 * proper dismissible popover.
 */

interface SlideOptionsProps {
  activeGroup: SlideGroup | undefined
  hasPano: boolean
  panoSettings: PanoSettings
  onSetNumSlides: (value: number) => void
  onUpdatePano: (patch: Partial<PanoSettings>) => void
}

/** The controls themselves, shared by the desktop column and the mobile popover. */
export function SlideOptionsControls({
  activeGroup,
  hasPano,
  panoSettings,
  onSetNumSlides,
  onUpdatePano,
}: SlideOptionsProps) {
  const t = useT()
  return (
    <>
      {activeGroup && (
        <div className="flex items-center gap-1.5" role="group" aria-label={t('slides.count')}>
          {NUM_SLIDES_OPTIONS.map(({ value, labelKey, suffix }) => (
            <button
              key={value}
              type="button"
              aria-pressed={activeGroup.numSlides === value}
              onClick={() => onSetNumSlides(value)}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                activeGroup.numSlides === value
                  ? 'border-[var(--pd-c-7c6ef6)] bg-[var(--pd-c-7c6ef6)] text-white'
                  : 'border-[var(--pd-line-soft)] text-[#8f90a3] hover:border-[var(--pd-line)] hover:text-[var(--pd-c-e8e8f0)]'
              }`}
            >
              {suffix ?? t(labelKey)}
            </button>
          ))}
        </div>
      )}
      {/* Always rendered, even with no pano groups, so this column's height
          never shifts the slide-count buttons when switching between modes. */}
      <label
        className={`flex items-center gap-1.5 text-[10px] ${hasPano ? 'text-[var(--pd-c-6b6b7a)]' : 'text-[#4a4a57]'}`}
      >
        <input
          type="checkbox"
          checked={hasPano && panoSettings.compensate}
          disabled={!hasPano}
          onChange={(event) => onUpdatePano({ compensate: event.target.checked })}
          className="h-3 w-3 accent-[var(--pd-c-7c6ef6)] disabled:cursor-not-allowed disabled:opacity-40"
          title="When enabled, export/preview skip this gap between slides"
        />
        <span>{t('slides.compensate')}</span>
        <span className="ms-1">{t('slides.gap')}</span>
        <input
          type="number"
          min={0}
          max={MAX_PANO_COMPENSATION_PX}
          value={panoSettings.gapPx}
          disabled={!hasPano}
          onChange={(event) => onUpdatePano({ gapPx: parseInt(event.target.value, 10) || 0 })}
          className="w-12 rounded border border-[var(--pd-line)] bg-[var(--pd-c-0f0f13)] px-1 py-0.5 text-end text-[var(--pd-c-e8e8f0)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          title="Store preview gap shown in editor and preview"
        />
        <span>px</span>
      </label>
    </>
  )
}

/** The compact form: a slide-sized card that opens the controls above itself. */
export function SlideOptionsCard(props: SlideOptionsProps & { thumbHeight: number }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState({ left: 0, bottom: 0 })

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (cardRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Kept from the editor's own Escape handling, which would otherwise also
      // clear the selection behind a popover the user only meant to shut.
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    window.addEventListener('keydown', dismissOnEscape, true)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      window.removeEventListener('keydown', dismissOnEscape, true)
    }
  }, [open])

  const toggle = () => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(240, window.innerWidth - 16)
      setAnchor({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        // Anchored to the viewport bottom so the popover opens *upward*, away
        // from the strip, instead of off the bottom of the screen.
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
      })
    }
    setOpen((value) => !value)
  }

  const count = props.activeGroup?.numSlides ?? 1
  const label = count === 1 ? t('slides.single') : `×${count}`

  return (
    <div ref={cardRef} className="pd-slide-options-card-wrap shrink-0">
      <button
        type="button"
        className="pd-slide-options-card"
        style={{ height: props.thumbHeight }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('slides.options')}
        title={t('slides.options')}
        onClick={toggle}
      >
        <Icon name="layers" size={15} />
        <span>{label}</span>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('slides.options')}
          className="pd-slide-options-popover"
          style={{ left: anchor.left, bottom: anchor.bottom }}
        >
          <header>
            <span>{t('slides.options')}</span>
            <button type="button" aria-label={t('common.close')} onClick={() => setOpen(false)}>
              <Icon name="close" size={16} />
            </button>
          </header>
          <SlideOptionsControls {...props} />
        </div>,
        document.body,
      )}
    </div>
  )
}
