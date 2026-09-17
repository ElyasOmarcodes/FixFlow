import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditorStore } from '@/store'
import { useBrandColors } from '@/hooks/useBrandColors'
import { isBrandToken, parseBrandToken, resolveBrandColor, toBrandToken } from '@/utils/brandColors'
import { clamp, hexToHsv, hsvToHex, normalizeHex, prefersDarkInk, type Hsv } from '@/utils/color'
import { Icon } from '@/components/ui/Icon'
import { useRecentColors } from './recentColors'
import { useT } from '@/i18n'

/**
 * The colour control.
 *
 * What it replaces: a native `<input type="color">` next to a raw hex field,
 * under two rows of swatches, under a recents strip — every one of them always
 * open, in a 280px sidebar, repeated again for each gradient stop. There was
 * no way to actually *choose* a colour; you either knew its hex or you clicked
 * through to the operating system's own dialog, which looks nothing like the
 * app and is close to unusable on a phone.
 *
 * So: one closed row showing the current colour, and one picker when you open
 * it — a saturation/value field, a hue rail, a hex box, the eyedropper where
 * the browser has one, and the swatches organised into brand / recent /
 * palette instead of piled on top of each other. The panel is quiet until you
 * ask it not to be, which is the whole difference between this and a wall of
 * controls.
 */

interface ColorFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
  /** Hide the brand row, for callers where binding to a brand colour is meaningless. */
  hideBrand?: boolean
}

type SwatchTab = 'palette' | 'brand' | 'recent'

/**
 * A palette rather than a list of favourites.
 *
 * Ten hues at three lightnesses plus a neutral ramp: enough that most choices
 * are one tap, laid out so the columns read as one colour getting lighter and
 * the rows as the spectrum — which is what makes a grid of swatches scannable
 * instead of a mosaic.
 */
const PALETTE: readonly (readonly string[])[] = [
  ['#000000', '#1C1C2E', '#3A3A4A', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF'],
  ['#7F1D1D', '#DC2626', '#FF3B30', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2'],
  ['#7C2D12', '#EA580C', '#FF9500', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5', '#FFF7ED'],
  ['#713F12', '#CA8A04', '#F9D423', '#FACC15', '#FDE047', '#FEF08A', '#FEF9C3', '#FEFCE8'],
  ['#14532D', '#16A34A', '#34C759', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7', '#F0FDF4'],
  ['#134E4A', '#0D9488', '#5AC8FA', '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1', '#F0FDFA'],
  ['#0C4A6E', '#0284C7', '#007AFF', '#38BDF8', '#7DD3FC', '#BAE6FD', '#E0F2FE', '#F0F9FF'],
  ['#1E1B4B', '#4338CA', '#7C6EF6', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF', '#EEF2FF'],
  ['#4C1D95', '#7E22CE', '#AF52DE', '#A855F7', '#C084FC', '#D8B4FE', '#F3E8FF', '#FAF5FF'],
  ['#500724', '#BE185D', '#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8', '#FCE7F3', '#FDF2F8'],
]

/** Whether this browser offers the system eyedropper. */
function hasEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window
}

interface EyeDropperResult { sRGBHex: string }
interface EyeDropperLike { open: () => Promise<EyeDropperResult> }

/** The saturation/value field: hue fixed, the two axes you actually drag. */
function SaturationField({ hsv, onChange, onStart, onEnd }: {
  hsv: Hsv
  onChange: (next: Hsv) => void
  onStart: () => void
  onEnd: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const apply = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    onChange({
      h: hsv.h,
      s: clamp((event.clientX - box.left) / box.width, 0, 1),
      // Up is bright, which is the convention every design tool shares.
      v: 1 - clamp((event.clientY - box.top) / box.height, 0, 1),
    })
  }

  return (
    <div
      ref={ref}
      className="pd-color-sv"
      role="application"
      aria-label="Saturation and brightness"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex({ h: hsv.h, s: 1, v: 1 })})` }}
      onPointerDown={(event) => {
        event.preventDefault()
        ref.current?.setPointerCapture(event.pointerId)
        dragging.current = true
        onStart()
        apply(event)
      }}
      onPointerMove={(event) => { if (dragging.current) apply(event) }}
      onPointerUp={() => { if (dragging.current) { dragging.current = false; onEnd() } }}
      onPointerCancel={() => { if (dragging.current) { dragging.current = false; onEnd() } }}
    >
      <span
        className="pd-color-sv-handle"
        style={{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          background: hsvToHex(hsv),
        }}
      />
    </div>
  )
}

export function ColorField({
  value,
  onChange,
  placeholder = '#FFFFFF',
  onInteractionStart,
  onInteractionEnd,
  hideBrand,
}: ColorFieldProps) {
  const t = useT()
  const brandColors = useBrandColors()
  const addBrandColor = useEditorStore((s) => s.addBrandColor)
  const { colors: recentColors, remember } = useRecentColors()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SwatchTab>('palette')
  const [draft, setDraft] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [brandName, setBrandName] = useState('')

  const activeBrand = isBrandToken(value)
    ? brandColors.find((color) => color.id === (parseBrandToken(value) ?? ''))
    : undefined
  const hex = normalizeHex(resolveBrandColor(value, brandColors))

  // The hue is held while the picker is open. Dragging brightness to zero
  // makes a colour black, and black has no hue to read back — without this the
  // handle would jump to red the moment you came back up.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hex))
  const [lastHex, setLastHex] = useState(hex)
  if (lastHex !== hex) {
    setLastHex(hex)
    const next = hexToHsv(hex)
    // Only adopt the incoming hue when the colour has one to give.
    setHsv((current) => ({ h: next.s === 0 || next.v === 0 ? current.h : next.h, s: next.s, v: next.v }))
  }

  const commit = (next: string) => {
    onChange(next)
    remember(next)
  }

  const setFromHsv = (next: Hsv) => {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  const pickWithEyeDropper = async () => {
    try {
      const EyeDropperCtor = (window as unknown as { EyeDropper: new () => EyeDropperLike }).EyeDropper
      const result = await new EyeDropperCtor().open()
      commit(normalizeHex(result.sRGBHex))
    } catch { /* Dismissed, or unsupported: nothing to report. */ }
  }

  const swatches: string[] = tab === 'brand'
    ? brandColors.map((color) => resolveBrandColor(color.value, brandColors))
    : tab === 'recent'
      ? recentColors
      : []

  return (
    <div className="pd-color-field">
      <button
        type="button"
        className="pd-color-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="pd-color-chip" style={{ background: hex }} />
        <span className="pd-color-trigger-label">{activeBrand ? activeBrand.name : hex}</span>
        {activeBrand && <span className="pd-color-brand-tag">{t('color.brand')}</span>}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} />
      </button>

      {open && (
        <div className="pd-color-popover">
          <SaturationField
            hsv={hsv}
            onChange={setFromHsv}
            onStart={() => onInteractionStart?.()}
            onEnd={() => { onInteractionEnd?.(); remember(hsvToHex(hsv)) }}
          />

          <label className="pd-color-hue">
            <span className="sr-only">{t('color.hue')}</span>
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              aria-label={t('color.hue')}
              onPointerDown={() => onInteractionStart?.()}
              onPointerUp={() => onInteractionEnd?.()}
              onChange={(event) => setFromHsv({ ...hsv, h: Number(event.target.value) })}
            />
          </label>

          <div className="pd-color-entry">
            <input
              type="text"
              className="pd-color-hex"
              aria-label={t('color.hex')}
              placeholder={placeholder}
              value={draft ?? hex}
              onFocus={() => onInteractionStart?.()}
              onChange={(event) => {
                setDraft(event.target.value)
                // Applied as soon as it parses, so typing a hex previews live
                // rather than only on blur.
                const parsed = normalizeHex(event.target.value, '')
                if (parsed) onChange(parsed)
              }}
              onBlur={() => { setDraft(null); onInteractionEnd?.() }}
            />
            {hasEyeDropper() && (
              <button
                type="button"
                className="pd-color-eyedropper"
                title={t('color.eyedropper')}
                aria-label={t('color.eyedropper')}
                onClick={() => void pickWithEyeDropper()}
              >
                <Icon name="search" size={13} />
              </button>
            )}
            {activeBrand ? (
              <button
                type="button"
                className="pd-color-unbind"
                title={t('color.unbind')}
                onClick={() => onChange(hex)}
              >
                <Icon name="close" size={12} />
              </button>
            ) : !hideBrand && (
              <button
                type="button"
                className="pd-color-save"
                title={t('color.saveToBrand')}
                aria-label={t('color.saveToBrand')}
                onClick={() => { setBrandName(''); setNaming(true) }}
              >
                <Icon name="plus" size={13} />
              </button>
            )}
          </div>

          {naming && (
            <form
              className="pd-color-naming"
              onSubmit={(event) => {
                event.preventDefault()
                const name = brandName.trim()
                if (name) addBrandColor(name, hex)
                setNaming(false)
              }}
            >
              <input
                autoFocus
                type="text"
                value={brandName}
                placeholder={t('color.brandNamePlaceholder')}
                aria-label={t('color.brandNamePlaceholder')}
                onChange={(event) => setBrandName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setNaming(false) }}
              />
              <button type="submit">{t('common.save')}</button>
              <button type="button" onClick={() => setNaming(false)}>{t('common.cancel')}</button>
            </form>
          )}

          <div className="pd-color-tabs" role="tablist" aria-label={t('color.swatches')}>
            <button type="button" role="tab" aria-selected={tab === 'palette'} onClick={() => setTab('palette')}>
              {t('color.palette')}
            </button>
            {!hideBrand && (
              <button type="button" role="tab" aria-selected={tab === 'brand'} onClick={() => setTab('brand')}>
                {t('color.brand')}
              </button>
            )}
            <button type="button" role="tab" aria-selected={tab === 'recent'} onClick={() => setTab('recent')}>
              {t('color.recent')}
            </button>
          </div>

          {tab === 'palette' ? (
            <div className="pd-color-palette">
              {PALETTE.map((ramp) => (
                <div key={ramp[0]} className="pd-color-ramp">
                  {ramp.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      title={swatch}
                      aria-label={swatch}
                      aria-pressed={swatch === hex}
                      className="pd-color-swatch"
                      style={{ background: swatch }}
                      onClick={() => commit(swatch)}
                    >
                      {swatch === hex && (
                        <Icon name="check" size={11} className={prefersDarkInk(swatch) ? 'pd-ink-dark' : 'pd-ink-light'} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : swatches.length === 0 ? (
            <p className="pd-color-empty">
              {tab === 'brand' ? t('color.noBrand') : t('color.noRecent')}
            </p>
          ) : (
            <div className="pd-color-swatches">
              {(tab === 'brand' ? brandColors : swatches.map((swatch) => ({ id: swatch, name: swatch, value: swatch })))
                .map((entry) => {
                  const resolved = normalizeHex(resolveBrandColor(entry.value, brandColors))
                  const isActive = tab === 'brand' ? activeBrand?.id === entry.id : resolved === hex
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      title={entry.name}
                      aria-label={entry.name}
                      aria-pressed={isActive}
                      className="pd-color-swatch"
                      style={{ background: resolved }}
                      onClick={() => (tab === 'brand' ? onChange(toBrandToken(entry.id)) : commit(resolved))}
                    >
                      {isActive && (
                        <Icon name="check" size={11} className={prefersDarkInk(resolved) ? 'pd-ink-dark' : 'pd-ink-light'} />
                      )}
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
