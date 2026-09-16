import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { BuiltInFormatId, CanvasFormatId, CustomFormatId } from '@/types'
import {
  CANVAS_FORMAT_PRESETS,
  countFormatAdjustments,
  countLocaleAdjustments,
  FORMAT_FAMILY,
  FORMAT_FAMILY_LABELS,
  FORMAT_FAMILY_ORDER,
  getCanvasFormat,
  getFormatLabel,
  getFormatFamilyKey,
  getGroupFamilyKey,
  hasFormatLayout,
  getProjectActiveFormats,
  getProjectBaseFormat,
  groupTargetsFormat,
  isCustomFormatId,
  selectFamilyFormats,
  selectFamilyGroups,
  selectProjectFamilies,
} from '@/utils/canvasFormats'
import { getLanguageName } from '@/utils/locale'
import { getScopedEditingIndicator } from '@/utils/scopedEditingIndicator'
import { CreateFormatLayoutModal } from '@/components/panels/CreateFormatLayoutModal'
import { ContentSyncModal } from '@/components/panels/ContentSyncModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

/**
 * Closes a popover on a press outside it or on Escape.
 *
 * `pointerdown` rather than `mousedown`: touch browsers synthesise mouse events
 * only after the gesture finishes, and not at all when the tap is consumed, so
 * a menu could be left open by a tap that clearly meant to dismiss it. Escape
 * is handled here too — every other dismissible surface in the editor answers
 * it, and these menus did not.
 */
function useDismissOnOutsideClick(
  open: boolean,
  refs: React.RefObject<HTMLDivElement | null> | React.RefObject<HTMLDivElement | null>[],
  close: () => void,
) {
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const targets = Array.isArray(refs) ? refs : [refs]
      if (!targets.some((ref) => ref.current?.contains(event.target as Node))) close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stop the editor's own Escape handling (exit group edit, clear
      // selection) from also firing behind a menu the user only meant to shut.
      event.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    // Capture phase, so this runs before the window-level editor shortcut.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open, refs, close])
}

/**
 * Sliding active-tab underline.
 *
 * - One instance per tab row.
 * - Must be a DIRECT CHILD (last element) of a `relative` row container.
 * - Every tab button in that row carries `data-tab-key`, including the
 *   "Default"/"Base" button.
 * - Measures with `offsetLeft`/`offsetWidth` — NOT `getBoundingClientRect()`.
 *   The family accordion translates the tab strip (`translate-x-*`) while
 *   opening; layout offsets are transform-immune, so measurements stay stable.
 *   The bar inherits the strip's translate for free because it lives inside it.
 */
function SlidingUnderline({
  accentClass,
  activeKey,
  enabled = true,
}: {
  /** Tailwind bg- class, e.g. `bg-[#f59e0b]` or `bg-[#22d3c5]`. */
  accentClass: string
  /** Matches `data-tab-key` on the currently active tab button. */
  activeKey: string
  /** Set `false` to fade out (e.g. collapsed accordion panel). */
  enabled?: boolean
}) {
  const barRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    const row = bar?.parentElement
    if (!bar || !row) return

    // Find the active tab.  CSS.escape guards locale codes and `custom:…` ids.
    const target = enabled
      ? row.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(activeKey)}"]`)
      : null

    if (!target) {
      // Fade out in place — retain the last transform/width so re-showing the
      // same tab is a fade-in, not a slide from the row origin.
      bar.style.opacity = '0'
      return
    }

    const measure = () => {
      // offsetLeft is relative to the row (the offsetParent), and is
      // *unaffected* by CSS transforms on ancestor accordion strips.
      bar.style.transform = `translateX(${target.offsetLeft}px)`
      bar.style.width = `${target.offsetWidth}px`
      bar.style.opacity = '1'
    }
    measure()

    // Observe the row (catches a sibling tab growing, shifting offsetLeft) and
    // the active tab itself (catches its label / ●N badge changing width).
    // Both fire from pure DOM mutations (e.g. the ●N badge appearing) with no
    // React re-render of SlidingUnderline needed.
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    observer.observe(target)
    return () => observer.disconnect()
  }, [activeKey, enabled])

  return (
    <span
      ref={barRef}
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 rounded-full opacity-0 transition-[transform,width,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${accentClass}`}
    />
  )
}

/** Keeps compact tab rows legible when their contents outgrow the editor chrome. */
function HorizontalScrollAffordance({
  children,
  className = '',
  containerClassName = '',
}: {
  children: React.ReactNode
  className?: string
  containerClassName?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const updateEdges = () => {
      const overflow = element.scrollWidth > element.clientWidth + 1
      // In an RTL container scrollLeft counts *down* from 0 as you scroll away
      // from the start edge, so the raw value can be negative. Measuring the
      // distance instead keeps "start" meaning the inline start in both
      // directions.
      const scrolled = Math.abs(element.scrollLeft)
      setEdges({
        start: overflow && scrolled > 1,
        end: overflow && scrolled + element.clientWidth < element.scrollWidth - 1,
      })
    }
    const frame = requestAnimationFrame(updateEdges)
    const observer = new ResizeObserver(updateEdges)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    element.addEventListener('scroll', updateEdges, { passive: true })
    element.addEventListener('transitionend', updateEdges)
    window.addEventListener('resize', updateEdges)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      element.removeEventListener('scroll', updateEdges)
      element.removeEventListener('transitionend', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [])

  return (
    <div className={`relative min-w-0 flex-1 ${containerClassName}`}>
      <div ref={scrollRef} className={`h-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      {/* pd-scroll-fade-* carry the gradient so it follows the writing direction. */}
      {edges.start && <span aria-hidden="true" className="pd-scroll-fade-start pointer-events-none absolute inset-y-0 start-0 z-10 w-7" />}
      {edges.end && <span aria-hidden="true" className="pd-scroll-fade-end pointer-events-none absolute inset-y-0 end-0 z-10 flex w-9 items-center justify-end pe-1 text-xs text-[#8d8997]"><span className="pd-dir-flip">›</span></span>}
    </div>
  )
}

/** The two editing axes share one piece of persistent editor chrome. */
export function EditingContextBar() {
  const t = useT()
  const {
    project,
    settings,
    slideGroups,
    activeSlideGroupId,
    activeCanvasFormat,
    activeFamily,
    activeLocale,
    setActiveCanvasFormat: setActiveCanvasFormatRaw,
    setActiveFamily,
    setActiveSlideGroup,
    setActiveLocale,
    addCustomFormat,
    addFormatToFamily,
    deleteFormatLayout,
    removeCustomFormat,
    resetActiveFormatLayout,
    shareActiveFormatOwnedLayers,
    resetActiveFormatVisibility,
    promoteActiveFormatLayoutToShared,
    resetActiveLocaleAdjust,
  } = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      settings: state.project.settings,
      slideGroups: state.project.slideGroups,
      activeSlideGroupId: state.activeSlideGroupId,
      activeCanvasFormat: state.activeCanvasFormat,
      activeFamily: state.activeFamily,
      activeLocale: state.activeLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
      setActiveFamily: state.setActiveFamily,
      setActiveSlideGroup: state.setActiveSlideGroup,
      setActiveLocale: state.setActiveLocale,
      addCustomFormat: state.addCustomFormat,
      addFormatToFamily: state.addFormatToFamily,
      deleteFormatLayout: state.deleteFormatLayout,
      removeCustomFormat: state.removeCustomFormat,
      resetActiveFormatLayout: state.resetActiveFormatLayout,
      shareActiveFormatOwnedLayers: state.shareActiveFormatOwnedLayers,
      resetActiveFormatVisibility: state.resetActiveFormatVisibility,
      promoteActiveFormatLayoutToShared: state.promoteActiveFormatLayoutToShared,
      resetActiveLocaleAdjust: state.resetActiveLocaleAdjust,
    })),
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [createTarget, setCreateTarget] = useState<CanvasFormatId | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BuiltInFormatId | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [contentSyncOpen, setContentSyncOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [customDpi, setCustomDpi] = useState('96')
  const [formatMenuPosition, setFormatMenuPosition] = useState({ left: 0, top: 0 })
  /**
   * How tall the format menu may grow before it runs off the bottom of the
   * screen. Derived from where it opens rather than hard-coded, because the
   * editing bar sits at a different height on a phone than on a desktop.
   * `dvh` rather than `vh`: on Android the URL bar makes `vh` taller than what
   * is actually visible, which is exactly the case this guards against.
   */
  const formatMenuMaxHeight = `calc(100dvh - ${Math.round(formatMenuPosition.top) + 16}px)`
  const dropdownRef = useRef<HTMLDivElement>(null)
  const formatMenuRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  useDismissOnOutsideClick(dropdownOpen || showCustomInput, [dropdownRef, formatMenuRef], () => { setDropdownOpen(false); setShowCustomInput(false) })
  useDismissOnOutsideClick(actionsOpen, actionsRef, () => setActionsOpen(false))

  const baseFormat = getProjectBaseFormat({ settings })
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats({ settings })
  const families = selectProjectFamilies(project)
  const hasMultipleFamilies = families.length >= 2
  const isCreated = (formatId: CanvasFormatId) => activeFormats.includes(formatId) && hasFormatLayout(project, formatId)
  const activeFamilyFormats = selectFamilyFormats(project, activeFamily)
    .filter(isCreated)
  const familyEntries = families.map((family) => {
    const formats = selectFamilyFormats(project, family)
      .filter(isCreated)
    return {
      family,
      presetFormats: formats.filter((formatId): formatId is BuiltInFormatId => !isCustomFormatId(formatId)),
      customFormats: formats.filter(isCustomFormatId),
    }
  })
  const rawGroup = slideGroups.find((group) => group.id === activeSlideGroupId)
  const defaultLocale = settings.defaultLocale
  const locales = settings.locales ?? [defaultLocale]
  const hasMultipleLocales = locales.length > 1
  const isFormatScoped = activeCanvasFormat !== baseFormat
  const isLocaleScoped = activeLocale !== defaultLocale
  const hasActions = isFormatScoped || isLocaleScoped || hasMultipleFamilies
  const formatLabel = getFormatLabel(activeCanvasFormat, settings.customFormats)
  const localeLabel = getLanguageName(activeLocale)
  const formatCount = rawGroup && isFormatScoped
    ? countFormatAdjustments(rawGroup, activeCanvasFormat, baseFormat)
    : 0
  const localeCount = rawGroup && isLocaleScoped
    ? countLocaleAdjustments(rawGroup, activeLocale, activeCanvasFormat)
    : 0
  const setActiveCanvasFormat = (formatId: CanvasFormatId) => {
    const targetFamily = getFormatFamilyKey(formatId)
    if (formatId !== baseFormat && targetFamily && targetFamily !== activeFamily) {
      setActiveFamily(targetFamily)
      setActiveCanvasFormatRaw(formatId)
      return
    }
    const activeGroup = slideGroups.find((group) => group.id === activeSlideGroupId)
    if (activeGroup && !groupTargetsFormat(activeGroup, formatId)) {
      const targetGroup = slideGroups.find((group) => groupTargetsFormat(group, formatId))
      if (targetGroup) setActiveSlideGroup(targetGroup.id)
    }
    setActiveCanvasFormatRaw(formatId)
  }
  const selectFormat = setActiveCanvasFormat
  const uncreatedFormats = CANVAS_FORMAT_PRESETS
    .map((format) => format.id)
    .filter((formatId) => !isCreated(formatId))
  // `group.formats` is canonical family membership, not "currently active"
  // (a fresh fork gets every built-in preset in its family up front). What
  // actually decides whether this deletion empties the family is whether any
  // OTHER member of that family remains in `activeFormats` — mirrors the
  // `deleteFormatLayout` store action's own family-emptiness check.
  const deleteTargetFamily = deleteTarget ? (getFormatFamilyKey(deleteTarget) ?? 'phone') : null
  const deleteTargetGroups = deleteTarget && deleteTargetFamily
    ? slideGroups.filter((group) => (getGroupFamilyKey(group) ?? 'phone') === deleteTargetFamily)
    : []
  const deleteTargetFamilyStillActive = deleteTarget && deleteTargetFamily
    ? selectFamilyFormats(project, deleteTargetFamily)
      .some((format) => format !== deleteTarget && activeFormats.includes(format))
    : true
  const deleteTargetOwnsAllGroups = deleteTargetGroups.length > 0
    && !deleteTargetFamilyStillActive
    && deleteTargetGroups.length === slideGroups.length
  const deleteTargetExclusiveGroups = deleteTargetFamilyStillActive ? [] : deleteTargetGroups
  const deleteTargetLabel = deleteTarget ? getFormatLabel(deleteTarget, settings.customFormats) : ''
  const deleteTargetMessage = deleteTargetOwnsAllGroups
    ? 'This is the only slide group in the project. Add another slide group before deleting this layout.'
    : deleteTargetGroups.length === 0
      ? 'This format has no dedicated layouts. It will just stop exporting.'
    : deleteTargetExclusiveGroups.length > 0
      ? `This removes ${deleteTargetExclusiveGroups.length === 1 ? 'its slides' : 'these slides'} permanently.`
      : 'This removes the format from its shared slides. The slides remain for their other formats.'

  const clearCustomForm = () => {
    setShowCustomInput(false)
    setCustomLabel('')
    setCustomW('')
    setCustomH('')
  }
  const openFormatMenu = () => {
    const rect = dropdownRef.current?.getBoundingClientRect()
    const menuWidth = Math.min(280, window.innerWidth - 16)
    if (rect) setFormatMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)), top: rect.bottom + 4 })
    setDropdownOpen((open) => !open)
  }
  const runFormatAction = (action: (format: CanvasFormatId) => void) => {
    action(activeCanvasFormat)
    setActionsOpen(false)
  }
  const handlePromoteLayout = () => {
    runFormatAction(promoteActiveFormatLayoutToShared)
  }
  const handleLocaleAdjustReset = () => {
    resetActiveLocaleAdjust()
    setActionsOpen(false)
  }
  const actionItemClass = 'w-full px-3 py-2 text-start text-[11px] text-[var(--pd-c-e8e8f0)] transition-colors hover:bg-[rgba(255,255,255,0.06)]'

  // `border-b-2 border-transparent` reserves the 2px the old inline underline
  // occupied, so removing it shifts no text.  The sliding bar overlays this strip.
  const tabClass = (active: boolean) =>
    `flex h-full shrink-0 items-center gap-1 whitespace-nowrap border-b-2 border-transparent px-2.5 text-[11px] font-medium transition-colors ${
      active ? 'text-[var(--pd-text)]' : 'text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)]'
    }`
  // Base is deliberately rendered inside EVERY family strip: `selectFormatViewGroups`
  // scopes the base view to that family's groups, so Base is per-family in effect.
  const renderBaseTab = () => (
    <button
      onClick={() => selectFormat(baseFormat)}
      data-tab-key={baseFormat}
      className={tabClass(activeCanvasFormat === baseFormat)}
      title="Base — shared authoring canvas. Not exported directly."
    >
      Base
    </button>
  )
  const renderPresetTab = (formatId: BuiltInFormatId) => {
    const isActive = activeCanvasFormat === formatId
    const count = rawGroup ? countFormatAdjustments(rawGroup, formatId, baseFormat) : 0
    const label = getFormatLabel(formatId, settings.customFormats)
    return <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
      <button onClick={() => setActiveCanvasFormat(formatId)} data-tab-key={formatId} className={tabClass(isActive)} title={`${label} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}>
        {label}{count > 0 && <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#fbbf24]"><Icon name="dot" size={6} />{count}</span>}
      </button>
      <div className="pointer-events-none -ml-0.5 flex h-full w-4 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover/tab:pointer-events-auto group-hover/tab:opacity-100">
        <button onClick={() => setDeleteTarget(formatId)} className="flex h-4 w-4 items-center justify-center rounded text-xs text-[var(--pd-c-6b6b7a)] transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]" title={`Delete ${label} layout`} aria-label={`Delete ${label} layout`}><Icon name="close" size={10} strokeWidth={2.4} /></button>
      </div>
    </div>
  }
  const renderCustomTab = (formatId: CustomFormatId) => (
    <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
      <button onClick={() => setActiveCanvasFormat(formatId)} data-tab-key={formatId} className={tabClass(activeCanvasFormat === formatId)}>
        {getFormatLabel(formatId, settings.customFormats)}
      </button>
      <button onClick={() => removeCustomFormat(formatId)} className="-ml-2 flex items-center pr-1 text-[var(--pd-c-6b6b7a)] opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-[#f87171]" title="Remove format" aria-label="Remove format"><Icon name="close" size={10} strokeWidth={2.4} /></button>
    </div>
  )
  const renderFormatAddButton = () => (
    <div className="relative ml-1 flex h-full shrink-0 items-center" ref={dropdownRef}>
      <button
        onClick={openFormatMenu}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-sm text-[var(--pd-c-6b6b7a)] transition-colors hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(245,158,11,0.07)] hover:text-[#fbbf24]"
        title="Add a canvas format"
      >
        +
      </button>
      <button title={t('formats.earlier')} aria-label={t('formats.earlier')} onClick={() => { const order = [...activeFormats]; const index = order.indexOf(activeCanvasFormat); if (index > 0) { [order[index - 1], order[index]] = [order[index], order[index - 1]]; useEditorStore.getState().updateSettings({ activeFormats: order }) } }}><Icon name="chevron-left" size={16} /></button>
      <button title={t('formats.later')} aria-label={t('formats.later')} onClick={() => { const order = [...activeFormats]; const index = order.indexOf(activeCanvasFormat); if (index >= 0 && index < order.length - 1) { [order[index], order[index + 1]] = [order[index + 1], order[index]]; useEditorStore.getState().updateSettings({ activeFormats: order }) } }}><Icon name="chevron-right" size={16} /></button>
    </div>
  )
  const renderFormatMenuFamilies = (
    formats: readonly BuiltInFormatId[],
    onSelect: (formatId: BuiltInFormatId) => void,
  ) => FORMAT_FAMILY_ORDER.map((family) => {
    const familyFormats = formats.filter((formatId) => FORMAT_FAMILY[formatId] === family)
    if (familyFormats.length === 0) return null
    return (
      <div key={family} className="pb-1.5 last:pb-0">
        <p className="px-3 pb-1 pt-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#575461]">{FORMAT_FAMILY_LABELS[family]}</p>
        {familyFormats.map((formatId) => {
          const { width, height } = getCanvasFormat(formatId)
          return (
            <button key={formatId} onClick={() => onSelect(formatId)} className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-start text-xs font-medium text-[#c2c2cf] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white">
              <span>{getFormatLabel(formatId, settings.customFormats)}</span>
              <span className="shrink-0 font-normal tabular-nums text-[#656574]">{width} × {height}</span>
            </button>
          )
        })}
      </div>
    )
  })

  return (
    <div className={`pd-editing-context relative ${actionsOpen ? 'z-40' : 'z-20'} h-11 shrink-0 border-b border-[rgba(255,255,255,0.07)] bg-[var(--pd-c-18181f)] px-3`}>
      <div className="flex h-full min-w-0 items-stretch">
        <section className="flex min-w-[12rem] flex-1 items-stretch" aria-label="Canvas format">
          <div className="mr-1.5 flex shrink-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_7px_rgba(245,158,11,0.35)]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6b6254]">{t('canvas.format')}</span>
          </div>
          {hasMultipleFamilies ? (
            <HorizontalScrollAffordance>
              <div role="group" aria-label="Format family" className="flex h-full min-w-max items-stretch gap-0.5">
                {familyEntries.map(({ family, presetFormats, customFormats }) => {
                const expanded = activeFamily === family
                const memberCount = presetFormats.length + customFormats.length
                const panelId = `format-family-${family}`
                return (
                  <div
                    key={family}
                    className={`flex h-full shrink-0 items-stretch rounded-t-[5px] transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
                      expanded
                        ? 'bg-[rgba(255,255,255,0.035)] shadow-[inset_0_1px_0_rgba(245,158,11,0.14)]'
                        : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <button
                      onClick={() => setActiveFamily(family)}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      title={
                        expanded
                          ? `${FORMAT_FAMILY_LABELS[family]} formats`
                          : `Switch to ${FORMAT_FAMILY_LABELS[family]} — ${memberCount} format${memberCount !== 1 ? 's' : ''}`
                      }
                      className={`flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors duration-200 ease-out motion-reduce:transition-none ${
                        expanded
                          ? 'text-[#e0a951]' : 'text-[#5c5967] hover:text-[#a29daa]'
                      }`}
                    >
                      {FORMAT_FAMILY_LABELS[family]}
                      <span
                        aria-hidden="true"
                        className={`grid h-3.5 min-w-3.5 place-items-center rounded-[3px] px-1 text-[8px] font-bold leading-none tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none ${
                          expanded
                            ? 'bg-[rgba(245,158,11,0.10)] text-[#e0a951]'
                            : 'bg-[rgba(255,255,255,0.05)] text-[#6f6b7b]'
                        }`}
                      >
                        {memberCount}
                      </span>
                    </button>

                    {/* Level 1 — animated track. `0fr -> 1fr` resolves against the
                        tabs' real max-content width, so the full 220ms is visible
                        motion (the old max-w-[34rem] finished in ~55ms then stalled). */}
                    <div
                      id={panelId}
                      inert={!expanded}
                      className={`grid h-full transition-[grid-template-columns] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                        expanded ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'
                      }`}
                    >
                      {/* Level 2 — clipper. `min-w-0` + `overflow-hidden` are BOTH
                          required or the 0fr track will never collapse. */}
                      <div className="flex h-full min-w-0 overflow-hidden">
                        {/* Level 3 — intrinsic content + fade/slide. */}
                        <div
                          className={`relative flex h-full min-w-max items-stretch border-l transition-[opacity,translate,transform,border-color] duration-150 ease-out motion-reduce:transition-none ${
                            expanded
                              ? 'translate-x-0 border-[rgba(255,255,255,0.07)] opacity-100 delay-[50ms]'
                              : '-translate-x-1.5 border-transparent opacity-0 delay-0'
                          }`}
                        >
                          {renderBaseTab()}
                          {presetFormats.map(renderPresetTab)}
                          {customFormats.map(renderCustomTab)}
                          <SlidingUnderline
                            accentClass="bg-[#f59e0b]"
                            activeKey={activeCanvasFormat}
                            enabled={expanded}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
                })}
                {renderFormatAddButton()}
              </div>
            </HorizontalScrollAffordance>
          ) : (
            <HorizontalScrollAffordance>
              <div className="relative flex h-full min-w-max items-stretch">
                {renderBaseTab()}
                {activeFamilyFormats.map((format) => isCustomFormatId(format) ? renderCustomTab(format) : renderPresetTab(format))}
                {renderFormatAddButton()}
                <SlidingUnderline accentClass="bg-[#f59e0b]" activeKey={activeCanvasFormat} />
              </div>
            </HorizontalScrollAffordance>
          )}

          {(dropdownOpen || showCustomInput) && createPortal(
            <div
              ref={formatMenuRef}
              className="fixed z-50"
              style={{ left: formatMenuPosition.left, top: formatMenuPosition.top }}
            >
            {dropdownOpen && (
              <div
                className="z-50 mt-1 w-[min(280px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1e1e2a] py-1 shadow-xl"
                style={{ maxHeight: formatMenuMaxHeight }}
              >
                {uncreatedFormats.length > 0 && <section aria-label="Create new layout">
                  <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#fbbf24]">Create new layout</p>
                  {renderFormatMenuFamilies(uncreatedFormats, (formatId) => {
                    const family = getFormatFamilyKey(formatId) ?? 'phone'
                    if (selectFamilyGroups(project, family).length > 0) {
                      addFormatToFamily(formatId)
                      setActiveCanvasFormat(formatId)
                    } else {
                      setCreateTarget(formatId)
                    }
                    setDropdownOpen(false)
                  })}
                </section>}
                {uncreatedFormats.length > 0 && <div className="mx-2 my-1 h-px bg-[rgba(255,255,255,0.08)]" />}
                <section aria-label="Add a custom canvas size">
                  <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#b7b7c5]">Add a custom canvas size</p>
                  <button
                    onClick={() => { setShowCustomInput(true); setDropdownOpen(false) }}
                    className="w-full px-3 py-1.5 text-start text-xs text-[#a0a0b0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--pd-c-e8e8f0)]"
                  >
                    Custom size…
                  </button>
                </section>
              </div>
            )}
            {showCustomInput && (
              <div
                className="z-50 mt-1 w-[min(260px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1e1e2a] p-3 shadow-xl"
                style={{ maxHeight: formatMenuMaxHeight }}
              >
                <p className="mb-2 text-[10px] text-[var(--pd-c-6b6b7a)]">Custom canvas format</p>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  className="mb-2 w-full rounded border border-[rgba(255,255,255,0.1)] bg-[var(--pd-c-0f0f13)] px-2 py-1 text-xs text-[var(--pd-c-e8e8f0)] focus:outline-none"
                />
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="W"
                    value={customW}
                    onChange={(event) => setCustomW(event.target.value)}
                    className="w-20 rounded border border-[rgba(255,255,255,0.1)] bg-[var(--pd-c-0f0f13)] px-2 py-1 text-xs text-[var(--pd-c-e8e8f0)] [appearance:textfield] focus:outline-none"
                  />
                  <span className="text-xs text-[var(--pd-c-6b6b7a)]">×</span>
                  <input
                    type="number"
                    placeholder="H"
                    value={customH}
                    onChange={(event) => setCustomH(event.target.value)}
                    className="w-20 rounded border border-[rgba(255,255,255,0.1)] bg-[var(--pd-c-0f0f13)] px-2 py-1 text-xs text-[var(--pd-c-e8e8f0)] [appearance:textfield] focus:outline-none"
                  />
                </div>
                <label className="mb-2 flex items-center gap-2 text-xs">DPI<input aria-label="DPI" type="number" min="1" max="1200" value={customDpi} onChange={(event) => setCustomDpi(event.target.value)} className="w-20 rounded bg-[var(--pd-field-bg)] px-2 py-1" /></label>
                <p className="mb-2 text-[10px]">{t('formats.dpiHint')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const width = parseInt(customW)
                      const height = parseInt(customH)
                      if (width >= 100 && width <= 9999 && height >= 100 && height <= 9999) {
                        addCustomFormat(customLabel.trim() || `Custom ${width}×${height}`, width, height, Number(customDpi))
                      }
                      clearCustomForm()
                    }}
                    className="flex-1 rounded bg-[#7c6ef6] px-2 py-1 text-xs text-white hover:bg-[#6c5ed6]"
                  >
                    Apply
                  </button>
                  <button onClick={clearCustomForm} className="px-2 py-1 text-xs text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)]">Cancel</button>
                </div>
              </div>
            )}
            </div>,
            document.body,
          )}
        </section>

        {hasMultipleLocales && (
          <section className="ml-3 flex w-fit min-w-0 max-w-[38%] shrink items-stretch border-l border-[rgba(255,255,255,0.08)] pl-3" aria-label="Editing locale">
            <div className="mr-1.5 flex shrink-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22d3c5] shadow-[0_0_7px_rgba(34,211,197,0.35)]" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#526d69]">Locale</span>
            </div>
            <HorizontalScrollAffordance containerClassName="w-fit max-w-full flex-none">
              <div className="relative flex h-full min-w-max items-stretch">
                <button
                onClick={() => setActiveLocale(defaultLocale)}
                data-tab-key={defaultLocale}
                className={tabClass(activeLocale === defaultLocale)}
                title={`Default locale · ${getLanguageName(defaultLocale)}`}
              >
                Default
              </button>
                {locales.filter((locale) => locale !== defaultLocale).map((locale) => {
                const isActive = activeLocale === locale
                // `activeCanvasFormat` doubles as the `localeAdjust` scope: at
                // the Base tab it already equals BASE_CANVAS_FORMAT, so one
                // call covers both the base-scoped and format-scoped count.
                const count = rawGroup ? countLocaleAdjustments(rawGroup, locale, activeCanvasFormat) : 0
                const label = getLanguageName(locale)
                return (
                  <button
                    key={locale}
                    onClick={() => setActiveLocale(locale)}
                    data-tab-key={locale}
                    className={tabClass(isActive)}
                    title={`${label} locale · ${count} locale layout adjustment${count !== 1 ? 's' : ''}`}
                  >
                    {label}
                    {count > 0 && <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#22d3c5]"><Icon name="dot" size={6} />{count}</span>}
                  </button>
                )
                })}
                <SlidingUnderline accentClass="bg-[#22d3c5]" activeKey={activeLocale} />
              </div>
            </HorizontalScrollAffordance>
          </section>
        )}
        {hasActions && (
          <div className="relative ml-3 flex shrink-0 items-center border-l border-[rgba(255,255,255,0.08)] pl-3" ref={actionsRef}>
            <button
              onClick={() => setActionsOpen((open) => !open)}
              className="rounded-md border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.035)] px-2 py-1 text-[10px] text-[#c9c9d4] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
            >
              <span className="flex items-center gap-1">Actions<Icon name="chevron-down" size={10} /></span>
            </button>
            {actionsOpen && (
              <div className="absolute end-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-2xl">
                {isFormatScoped && <>
                  <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#fbbf24]">{formatLabel} format actions</p>
                    <p className="mt-0.5 text-[10px] text-[var(--pd-c-6b6b7a)]">{formatCount} format adjustment{formatCount !== 1 ? 's' : ''} on this slide</p>
                  </div>
                  <button className={actionItemClass} onClick={() => runFormatAction(resetActiveFormatLayout)}>
                    Reset format layout
                    <span className="mt-0.5 block text-[10px] text-[var(--pd-c-6b6b7a)]">Remove all layout/model overrides for this format.</span>
                  </button>
                  <button className={actionItemClass} onClick={() => runFormatAction(shareActiveFormatOwnedLayers)}>
                    Make format layers shared
                    <span className="mt-0.5 block text-[10px] text-[var(--pd-c-6b6b7a)]">Convert layers created only in this format into shared layers.</span>
                  </button>
                  <button className={actionItemClass} onClick={() => runFormatAction(resetActiveFormatVisibility)}>
                    Reset format visibility
                    <span className="mt-0.5 block text-[10px] text-[var(--pd-c-6b6b7a)]">Clear hide/show decisions for this format.</span>
                  </button>
                  <div className="h-px bg-[rgba(255,255,255,0.08)]" />
                  <button className={actionItemClass} onClick={handlePromoteLayout}>
                    Use format layout as shared…
                    <span className="mt-0.5 block text-[10px] text-[#f59e0b]">Promotes this format layout into Base. Affects other formats.</span>
                  </button>
                </>}
                {isLocaleScoped && (
                  <section className="mt-1 border-t border-[rgba(255,255,255,0.12)]" aria-label={`${formatLabel} and ${localeLabel} actions`}>
                    <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#22d3c5]">{isFormatScoped ? `${formatLabel} × ${localeLabel}` : `${localeLabel} base layout`}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--pd-c-6b6b7a)]">
                        {localeCount} position and size adjustment{localeCount !== 1 ? 's' : ''} for {isFormatScoped ? 'this pairing' : 'this locale'}
                      </p>
                    </div>
                    <button className={actionItemClass} onClick={handleLocaleAdjustReset}>
                      {isFormatScoped ? 'Reset pairing layout' : 'Reset locale base layout'}
                      <span className="mt-0.5 block text-[10px] text-[#22d3c5]">
                        {isFormatScoped ? 'Remove all position and size adjustments for this pairing.' : 'Remove all base-layout adjustments for this locale.'}
                      </span>
                    </button>
                  </section>
                )}
                {hasMultipleFamilies && (
                  <section className={`${isFormatScoped || isLocaleScoped ? 'mt-1 border-t border-[rgba(255,255,255,0.12)]' : ''}`} aria-label="Content actions">
                    <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#7c6ef6]">Content</p>
                    </div>
                    <button className={actionItemClass} onClick={() => { setContentSyncOpen(true); setActionsOpen(false) }}>
                      Bring content from…
                      <span className="mt-0.5 block text-[10px] text-[var(--pd-c-6b6b7a)]">Copy text and images from another layout family into this screen. Layout is never changed.</span>
                    </button>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <CreateFormatLayoutModal key={createTarget} open={createTarget !== null} targetFormatId={createTarget} onClose={() => setCreateTarget(null)} />
      <ContentSyncModal open={contentSyncOpen} onClose={() => setContentSyncOpen(false)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTargetOwnsAllGroups ? `Can't delete ${deleteTargetLabel} layout` : `Delete the ${deleteTargetLabel} layout?`}
        message={deleteTargetMessage}
        confirmLabel={deleteTargetOwnsAllGroups ? 'Close' : 'Delete layout'}
        danger={!deleteTargetOwnsAllGroups}
        onConfirm={() => {
          if (deleteTarget && !deleteTargetOwnsAllGroups) deleteFormatLayout(deleteTarget)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/** A transient-feeling but persistent warning over the canvas when edits are scoped. */
export function EditingContextAlert() {
  const {
    project,
    activeLocale,
    activeCanvasFormat,
    setActiveLocale,
    setActiveCanvasFormat,
  } = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      activeLocale: state.activeLocale,
      activeCanvasFormat: state.activeCanvasFormat,
      setActiveLocale: state.setActiveLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
    })),
  )

  const { baseFormat, defaultLocale, isFormatScoped, isLocaleScoped } = getScopedEditingIndicator(
    project,
    activeLocale,
    activeCanvasFormat,
  )
  if (!isFormatScoped && !isLocaleScoped) return null

  const formatLabel = getFormatLabel(activeCanvasFormat, project.settings.customFormats)
  const localeLabel = getLanguageName(activeLocale)

  return (
    <div className="flex h-9 shrink-0 items-center justify-center border-b border-[rgba(255,255,255,0.08)] bg-[var(--pd-c-18181f)] px-3">
      <div className="flex min-w-0 max-w-full items-center justify-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          {isFormatScoped && <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_7px_rgba(245,158,11,0.75)]" />}
          {isLocaleScoped && <span className="h-1.5 w-1.5 rounded-full bg-[#22d3c5] shadow-[0_0_7px_rgba(34,211,197,0.7)]" />}
        </div>
        <p className="min-w-0 truncate text-[11px] leading-4 text-[#b7b7c5]">
          <strong className="font-semibold">
            {isFormatScoped && <span className="text-[#f59e0b]">{formatLabel}</span>}
            {isFormatScoped && isLocaleScoped && <span className="mx-1 text-[#565664]">×</span>}
            {isLocaleScoped && <span className="text-[#22d3c5]">{localeLabel}</span>}
          </strong>
          <span className="mx-1.5 text-[#565664]">—</span>
          {isFormatScoped && isLocaleScoped
            ? 'Position & size scoped to this pairing · New layers stay format-only · Content & style shared'
            : isFormatScoped
              ? 'Layout and new layers scoped to this format · Text & colors shared'
              : `Layout changes apply only to ${localeLabel} · Content & style remain shared`}
        </p>
        <button
          onClick={() => {
            setActiveCanvasFormat(baseFormat)
            setActiveLocale(defaultLocale)
          }}
          className="flex shrink-0 items-center gap-1 rounded-md border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.035)] px-2 py-1 text-[10px] text-[#c9c9d4] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
          title="Return to the shared base format and default locale"
        >
          <Icon name="corner-down-left" size={11} />
          Base + Default
        </button>
      </div>
    </div>
  )
}
