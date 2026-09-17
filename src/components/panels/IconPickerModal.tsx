import { useMemo, useState } from 'react'
import { ICON_CATEGORIES, searchIcons, type IconCategory, type IconGlyph } from '@/assets/icons/library'
import { fetchMaterialSymbol, MATERIAL_SYMBOL_NAMES, searchMaterialSymbols } from '@/utils/materialSymbols'
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

/** Draws a glyph from raw path data at a fixed preview size. */
function GlyphPreview({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * Icon picker.
 *
 * Two sources, deliberately in this order. The bundled library is first and is
 * the default because it always works — offline, in the desktop shell, and in
 * the headless CLI exporter. Material Symbols are fetched on demand and are a
 * bonus; if the network is unavailable the tab says so rather than presenting
 * an empty grid that looks broken.
 */
export function IconPickerModal({ open, onClose, onPick, selected, libraryOnly }: IconPickerModalProps) {
  const t = useT()
  const [source, setSource] = useState<Source>('library')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<IconCategory | 'all'>('all')
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset on the open→closed edge, in render rather than in an effect: the
  // modal unmounts its body while exiting, so an effect would land a frame
  // late and the next open would flash the previous search.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) { setQuery(''); setCategory('all'); setError(null); setPendingName(null); setSource('library') }
  }

  const libraryResults = useMemo(() => searchIcons(query, category), [query, category])
  const onlineResults = useMemo(() => searchMaterialSymbols(query), [query])

  const handleLibraryPick = (glyph: IconGlyph) => {
    onPick({ name: glyph.name })
    onClose()
  }

  const handleOnlinePick = async (name: string) => {
    setPendingName(name)
    setError(null)
    try {
      const symbol = await fetchMaterialSymbol(name)
      onPick({ name: `material:${name}`, path: symbol.d, viewBox: symbol.viewBox, filled: symbol.filled })
      onClose()
    } catch {
      setError(t('icons.fetchFailed'))
    } finally {
      setPendingName(null)
    }
  }

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

      {libraryOnly || source === 'library' ? (
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
          <p className="pd-icon-note">{t('icons.onlineNote', { count: MATERIAL_SYMBOL_NAMES.length })}</p>
          {error && <p className="pd-icon-error"><Icon name="alert-triangle" size={13} />{error}</p>}
          <div className="pd-icon-grid pd-icon-grid-names">
            {onlineResults.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                disabled={pendingName !== null}
                className="pd-icon-cell"
                onClick={() => void handleOnlinePick(name)}
              >
                {pendingName === name
                  ? <Icon name="spinner" size={20} className="pd-spin-slow" />
                  : <Icon name="sparkles" size={20} />}
                <span>{name.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
          {onlineResults.length === 0 && <p className="pd-icon-empty">{t('icons.noResults')}</p>}
        </>
      )}
    </ModalShell>
  )
}
