import { useEffect, useMemo, useState } from 'react'
import { ICON_CATEGORIES, searchIcons, type IconCategory, type IconGlyph } from '@/assets/icons/library'
import {
  DEFAULT_VARIANT, SYMBOL_STYLES, SYMBOL_WEIGHTS, fetchMaterialSymbol, loadSymbolNames,
  searchMaterialSymbols, symbolUrl,
  type SymbolStyle, type SymbolVariant, type SymbolWeight,
} from '@/utils/materialSymbols'
import { ModalShell } from '@/components/ui/ModalShell'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

interface IconPickerModalProps {
  open: boolean
  onClose: () => void
  /** Library glyphs report a name; a fetched symbol also carries its geometry. */
  onPick: (icon: { name: string; path?: string; viewBox?: string; filled?: boolean }) => void
  /** Highlighted as current, when replacing an existing icon. */
  selected?: string
  /**
   * Hide the online tab. Callers that draw the glyph as strokes on a 24-grid
   * (the chip's inline icon) can only use the bundled library, so offering the
   * fetched set would hand them something they cannot render.
   */
  libraryOnly?: boolean
}

type Source = 'library' | 'online'

/** How many symbols the grid draws before asking the person to narrow down. */
const ONLINE_PAGE = 120

/** Draws a bundled glyph from raw path data at a fixed preview size. */
function GlyphPreview({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * A Google symbol, drawn by the browser straight from the endpoint.
 *
 * An <img> rather than a fetch-and-parse: the grid shows hundreds at a time
 * and only the one that gets picked needs its geometry in hand. The browser
 * caches them, so picking is usually instant afterwards.
 *
 * A failed load falls back to a placeholder rather than an empty cell: behind
 * a corporate proxy, or offline, a grid of bare labels looks like the app is
 * broken instead of like the network is.
 */
function SymbolPreview({ name, variant, size = 24 }: { name: string; variant: SymbolVariant; size?: number }) {
  const [failed, setFailed] = useState(false)
  // A new name or variant is a new request, so give the image another chance.
  const key = `${name}:${variant.style}:${variant.filled}:${variant.weight}`
  const [lastKey, setLastKey] = useState(key)
  if (lastKey !== key) { setLastKey(key); setFailed(false) }

  if (failed) return <Icon name="image" size={size} />
  return (
    <img
      src={symbolUrl(name, variant)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // Painted with the current text colour rather than Google's black, so a
      // grid of them reads in both themes.
      className="pd-symbol-img"
    />
  )
}

/**
 * Icon picker.
 *
 * Two sources, deliberately in this order. The bundled library is first and is
 * the default because it always works — offline, in the desktop shell, and in
 * the headless CLI exporter. Google's catalogue is the second tab and carries
 * everything on fonts.google.com/icons: every name, all three styles, the fill
 * axis and the seven weights.
 */
export function IconPickerModal({ open, onClose, onPick, selected, libraryOnly }: IconPickerModalProps) {
  const t = useT()
  const [source, setSource] = useState<Source>('library')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<IconCategory | 'all'>('all')
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [style, setStyle] = useState<SymbolStyle>(DEFAULT_VARIANT.style)
  const [filled, setFilled] = useState(DEFAULT_VARIANT.filled)
  const [weight, setWeight] = useState<SymbolWeight>(DEFAULT_VARIANT.weight)
  const [names, setNames] = useState<readonly string[] | null>(null)
  const [namesFailed, setNamesFailed] = useState(false)

  // Reset on the open→closed edge, in render rather than in an effect: the
  // modal unmounts its body while exiting, so an effect would land a frame
  // late and the next open would flash the previous search.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) { setQuery(''); setCategory('all'); setError(null); setPendingName(null); setSource('library') }
  }

  // The name list is a 74 KB chunk; it only loads once the online tab is used.
  useEffect(() => {
    if (source !== 'online' || names || namesFailed) return
    let cancelled = false
    loadSymbolNames()
      .then((loaded) => { if (!cancelled) setNames(loaded) })
      .catch(() => { if (!cancelled) setNamesFailed(true) })
    return () => { cancelled = true }
  }, [source, names, namesFailed])

  const variant: SymbolVariant = useMemo(() => ({ style, filled, weight }), [style, filled, weight])
  const libraryResults = useMemo(() => searchIcons(query, category), [query, category])
  // Capped: every rendered cell is a request to Google, so the grid shows a
  // page at a time and the search narrows it rather than the scrollbar.
  const onlineMatches = useMemo(
    () => (names ? searchMaterialSymbols(query, names, 5000) : []),
    [query, names],
  )
  const onlineResults = useMemo(() => onlineMatches.slice(0, ONLINE_PAGE), [onlineMatches])

  const handleLibraryPick = (glyph: IconGlyph) => {
    onPick({ name: glyph.name })
    onClose()
  }

  const handleOnlinePick = async (name: string) => {
    setPendingName(name)
    setError(null)
    try {
      const symbol = await fetchMaterialSymbol(name, variant)
      onPick({ name: `material:${name}`, path: symbol.d, viewBox: symbol.viewBox, filled: symbol.filled })
      onClose()
    } catch {
      setError(t('icons.fetchFailed'))
    } finally {
      setPendingName(null)
    }
  }

  const showLibrary = libraryOnly || source === 'library'

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('icons.title')}
      maxWidth="max-w-3xl"
      bodyClassName="pd-icon-picker"
    >
      <div className="pd-icon-picker-bar">
        {!libraryOnly && <div className="pd-icon-source" role="tablist" aria-label={t('icons.source')}>
          <button type="button" role="tab" aria-selected={source === 'library'} onClick={() => setSource('library')}>
            {t('icons.library')}
          </button>
          <button type="button" role="tab" aria-selected={source === 'online'} onClick={() => setSource('online')}>
            {t('icons.online')}
          </button>
        </div>}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('icons.search')}
          aria-label={t('icons.search')}
          className="pd-icon-search"
        />
      </div>

      {showLibrary ? (
        <>
          <div className="pd-icon-categories" role="group" aria-label={t('icons.category')}>
            <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
              {t('icons.all')}
            </button>
            {ICON_CATEGORIES.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
          <p className="pd-icon-count">{t('icons.count', { count: libraryResults.length })}</p>
          <div className="pd-icon-grid">
            {libraryResults.map((glyph) => (
              <button
                key={glyph.name}
                type="button"
                title={glyph.name}
                aria-label={glyph.name}
                aria-pressed={selected === glyph.name}
                className={selected === glyph.name ? 'pd-icon-cell pd-icon-cell-active' : 'pd-icon-cell'}
                onClick={() => handleLibraryPick(glyph)}
              >
                <GlyphPreview d={glyph.d} />
                <span>{glyph.name.replace(/-/g, ' ')}</span>
              </button>
            ))}
          </div>
          {libraryResults.length === 0 && <p className="pd-icon-empty">{t('icons.noResults')}</p>}
        </>
      ) : (
        <>
          <div className="pd-icon-variants">
            <div className="pd-icon-variant-group" role="group" aria-label={t('icons.style')}>
              {SYMBOL_STYLES.map((item) => (
                <button key={item} type="button" aria-pressed={style === item} onClick={() => setStyle(item)}>
                  {t(`icons.style.${item}` as 'icons.style.outlined')}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pd-icon-variant-toggle"
              aria-pressed={filled}
              onClick={() => setFilled((value) => !value)}
            >
              <Icon name={filled ? 'check' : 'circle'} size={13} />
              {t('icons.fill')}
            </button>
            <label className="pd-icon-weight">
              <span>{t('icons.weight')}</span>
              <select value={weight} onChange={(event) => setWeight(Number(event.target.value) as SymbolWeight)}>
                {SYMBOL_WEIGHTS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          {namesFailed ? (
            <p className="pd-icon-empty">{t('icons.catalogueFailed')}</p>
          ) : !names ? (
            <p className="pd-icon-empty">{t('common.loading')}</p>
          ) : (
            <>
              <p className="pd-icon-count">
                {onlineMatches.length > onlineResults.length
                  ? t('icons.showingOf', { count: onlineResults.length, total: onlineMatches.length })
                  : t('icons.count', { count: onlineMatches.length })}
              </p>
              {error && <p className="pd-icon-error"><Icon name="alert-triangle" size={13} />{error}</p>}
              <div className="pd-icon-grid">
                {onlineResults.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    disabled={pendingName !== null}
                    aria-pressed={selected === `material:${name}`}
                    className={selected === `material:${name}` ? 'pd-icon-cell pd-icon-cell-active' : 'pd-icon-cell'}
                    onClick={() => void handleOnlinePick(name)}
                  >
                    {pendingName === name
                      ? <Icon name="spinner" size={22} className="pd-spin-slow" />
                      : <SymbolPreview name={name} variant={variant} />}
                    <span>{name.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
              {onlineResults.length === 0 && <p className="pd-icon-empty">{t('icons.noResults')}</p>}
            </>
          )}
        </>
      )}
    </ModalShell>
  )
}

