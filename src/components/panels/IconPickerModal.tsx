import { useEffect, useMemo, useState } from 'react'
import { ICON_CATEGORIES, searchIcons, type IconCategory, type IconGlyph } from '@/assets/icons/library'
import {
  DEFAULT_VARIANT, SYMBOL_STYLES, SYMBOL_WEIGHTS, fetchMaterialSymbol, loadSymbolNames,
  searchMaterialSymbols, symbolUrl,
  type SymbolStyle, type SymbolVariant, type SymbolWeight,
} from '@/utils/materialSymbols'
import { loadSymbolFont, symbolFontFamily, symbolRendersAsGlyph } from '@/utils/symbolFont'
import { ModalShell } from '@/components/ui/ModalShell'
import { Icon } from '@/components/ui/Icon'
import { VirtualIconGrid } from './icons/VirtualIconGrid'
import { useT } from '@/i18n'

interface IconPickerModalProps {
  open: boolean
  onClose: () => void
  /** Library glyphs report a name; a fetched symbol also carries its geometry. */
  onPick: (icon: { name: string; path?: string; viewBox?: string; filled?: boolean }) => void
  /** Highlighted as current, when replacing an existing icon. */
  selected?: string
  /** Hide the online tab, for a caller that can only draw bundled geometry. */
  libraryOnly?: boolean
}

type Source = 'library' | 'online'

/** One grid row, in px: the cell's own height plus the grid gap. */
const ROW_HEIGHT = 78
/** Narrowest a cell may get before the grid drops a column. */
const CELL_WIDTH = 78

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
 * Fallback preview: one <img> straight from Google's per-icon endpoint.
 *
 * Only used when the font could not be loaded. Because the grid is virtualised
 * this is about thirty requests rather than four thousand, so a blocked font
 * degrades to a slower grid instead of an unusable one.
 */
function SymbolImage({ name, variant, size = 24 }: { name: string; variant: SymbolVariant; size?: number }) {
  const [failed, setFailed] = useState(false)
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
 *
 * The online tab draws its previews with the Material Symbols *font*, one
 * ~320 KB file covering all 4,403 glyphs, and virtualises the grid. That is
 * what lets the whole catalogue be scrolled — previously it was capped at 120
 * because each visible cell was its own request, so a person could not see
 * what they were choosing from. What gets committed to the canvas is still the
 * picked icon's path geometry, so the font is a browsing aid only.
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
  // Which style/weight/fill combination the font is installed for. Held as
  // the key itself rather than a boolean so switching variant falls back to
  // the images for exactly as long as the new font is in flight.
  const [readyFontKey, setReadyFontKey] = useState<string | null>(null)

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

  // One font per style/weight/fill combination, fetched the first time that
  // combination is shown. `fonts.check` is what decides whether the grid can
  // draw glyphs: a blocked CDN resolves the load but leaves nothing installed.
  const fontKey = `${style}:${weight}:${filled ? 1 : 0}`
  const fontReady = readyFontKey === fontKey
  useEffect(() => {
    if (source !== 'online') return
    let cancelled = false
    loadSymbolFont(style, weight, filled).then((installed) => {
      // A blocked CDN loads nothing, and the grid stays on the image previews
      // rather than printing four thousand icon names.
      if (!cancelled && installed) setReadyFontKey(fontKey)
    })
    return () => { cancelled = true }
  }, [source, style, weight, filled, fontKey])

  const variant: SymbolVariant = useMemo(() => ({ style, filled, weight }), [style, filled, weight])
  const libraryResults = useMemo(() => searchIcons(query, category), [query, category])
  // Uncapped: the grid only mounts the rows on screen, so the whole catalogue
  // costs the same as one screenful of it.
  const onlineResults = useMemo(
    () => (names ? searchMaterialSymbols(query, names, names.length) : []),
    [query, names],
  )

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
          <VirtualIconGrid
            items={libraryResults}
            rowHeight={ROW_HEIGHT}
            minCellWidth={CELL_WIDTH}
            keyOf={(glyph) => glyph.name}
            emptyState={<p className="pd-icon-empty">{t('icons.noResults')}</p>}
            renderCell={(glyph) => (
              <button
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
            )}
          />
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
              <p className="pd-icon-count">{t('icons.count', { count: onlineResults.length })}</p>
              {error && <p className="pd-icon-error"><Icon name="alert-triangle" size={13} />{error}</p>}
              <VirtualIconGrid
                items={onlineResults}
                rowHeight={ROW_HEIGHT}
                minCellWidth={CELL_WIDTH}
                keyOf={(name) => name}
                emptyState={<p className="pd-icon-empty">{t('icons.noResults')}</p>}
                renderCell={(name) => (
                  <button
                    type="button"
                    title={name}
                    aria-label={name}
                    disabled={pendingName !== null}
                    aria-pressed={selected === `material:${name}`}
                    className={selected === `material:${name}` ? 'pd-icon-cell pd-icon-cell-active' : 'pd-icon-cell'}
                    onClick={() => void handleOnlinePick(name)}
                  >
                    {pendingName === name ? (
                      <Icon name="spinner" size={22} className="pd-spin-slow" />
                    ) : fontReady && symbolRendersAsGlyph(style, weight, filled, name) ? (
                      // The glyph *is* the name: Material Symbols map each
                      // icon's name to its artwork as a ligature.
                      <span className="pd-symbol-glyph" style={{ fontFamily: symbolFontFamily(style) }} aria-hidden="true">
                        {name}
                      </span>
                    ) : (
                      <SymbolImage name={name} variant={variant} />
                    )}
                    <span>{name.replace(/_/g, ' ')}</span>
                  </button>
                )}
              />
            </>
          )}
        </>
      )}
    </ModalShell>
  )
}
