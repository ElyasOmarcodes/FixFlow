import { useCompactLayout } from '@/hooks/useCompactLayout'
import { Fragment, useState, useEffect, useRef } from 'react'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import { BASE_CANVAS_FORMAT, getFormatCanvasDims, getProjectBaseFormat, selectFormatViewGroups } from '@/utils/canvasFormats'
import { SlideOptionsCard, SlideOptionsControls } from '@/components/panels/slides/SlideOptionsCard'
import type { BackgroundLayer, SlideGroup } from '@/types'
import type { ThumbnailMap } from '@/hooks/useThumbnails'
import { Icon } from '@/components/ui/Icon'
import { useLongPress } from '@/native/useLongPress'
import { useT } from '@/i18n'

interface ContextMenu {
  groupId: string
  x: number
  y: number
}

interface SlideNavigatorProps {
  thumbnails: ThumbnailMap
  staleGroupIds: Set<string>
  stageRef: React.RefObject<Konva.Stage | null>
  onCaptureThumbnail: (groupId: string) => void
}

type FlatSlide = {
  group: SlideGroup
  slideIdx: number
  globalNum: number
  bgCss: string
}

interface SortableGroupItemProps {
  group: SlideGroup
  groupSlides: FlatSlide[]
  isActive: boolean
  isFirst: boolean
  renamingId: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement | null>
  thumbnails: ThumbnailMap
  staleGroupIds: Set<string>
  captureThumbnail: (groupId: string) => void
  THUMB_H: number
  handleContextMenu: (point: { clientX: number; clientY: number }, groupId: string) => void
  startRename: (groupId: string, currentName: string) => void
  setActiveSlideGroup: (id: string) => void
  commitRename: () => void
  setRenamingId: (id: string | null) => void
  setRenameValue: (v: string) => void
}

function SortableGroupItem({
  group,
  groupSlides,
  isActive,
  isFirst,
  renamingId,
  renameValue,
  renameInputRef,
  thumbnails,
  staleGroupIds,
  captureThumbnail,
  THUMB_H,
  handleContextMenu,
  startRename,
  setActiveSlideGroup,
  commitRename,
  setRenamingId,
  setRenameValue,
}: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })
  // A held press opens the group's menu. Measured from pointer events rather
  // than taken from `contextmenu`, which a touch hold does not reliably fire
  // on a <button> — which is why the first slide's menu stopped appearing.
  const longPress = useLongPress((point) => handleContextMenu(point, group.id))
  const thumbW = Math.min(50, Math.round((group.slideWidth / group.slideHeight) * THUMB_H))
  const slideGap = 6
  const stripWidth = (thumbW * groupSlides.length) + (slideGap * Math.max(0, groupSlides.length - 1))

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  }

  return (
    <div ref={setNodeRef} style={wrapperStyle} {...attributes} {...listeners}>
      {/* Visual divider between groups */}
      {!isFirst && (
        <div
          style={{
            width: 1,
            height: 32,
            background: 'rgba(255,255,255,0.1)',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />
      )}

      {/* The group header is constrained to the exact width of its thumbnail strip.
          It must not widen a narrow slide and create invisible side gutters between
          previews. Pano/strip slides keep their tighter inner gap as one visual unit. */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 2, width: stripWidth, flexShrink: 0 }}
        {...longPress}
        onDoubleClick={() => startRename(group.id, group.name)}
      >
        {renamingId === group.id ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: Math.max(stripWidth, 52), height: 14, fontSize: 9, boxSizing: 'border-box' }}
            className="px-1 rounded border border-[var(--pd-c-7c6ef6)] bg-[var(--pd-c-0f0f13)] text-[var(--pd-c-e8e8f0)] focus:outline-none"
          />
        ) : (
          <span
            style={{
              width: '100%',
              fontSize: 10,
              color: isActive ? '#9b8fff' : '#8b8b9e',
              lineHeight: '14px',
              height: 14,
              cursor: 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
            title={group.name}
          >
            {group.name}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: slideGap }}>
          {groupSlides.map(({ slideIdx, globalNum: num, bgCss }) => {
            const thumb = thumbnails[group.id]?.[slideIdx]

            return (
              <Fragment key={`${group.id}-${slideIdx}`}>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
                  className="relative shrink-0 group"
                >
                  {/* A real button: this is the primary way to move between
                      slides, and as a bare div it was invisible to the
                      keyboard and to a screen reader alike. */}
                  <button
                    type="button"
                    aria-label={`Slide ${num}`}
                    aria-current={isActive ? 'true' : undefined}
                    data-slide-group={group.id}
                    style={{
                      width: thumbW,
                      height: THUMB_H,
                      background: bgCss,
                      border: `1px solid ${isActive ? '#7c6ef6' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 4,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      position: 'relative',
                      overflow: 'hidden',
                      flexShrink: 0,
                      padding: 0,
                    }}
                    onClick={() => {
                      setActiveSlideGroup(group.id)
                      if (!thumb || staleGroupIds.has(group.id)) captureThumbnail(group.id)
                    }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={`Slide ${num}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4d4d60',
                        }}
                      >
                        <Icon name="phone" size={13} />
                      </div>
                    )}
                  </button>

                  <span style={{ fontSize: 9, color: isActive ? '#7c6ef6' : '#6b6b7a', lineHeight: 1 }}>
                    {num}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function SlideNavigator({ thumbnails, staleGroupIds, onCaptureThumbnail }: SlideNavigatorProps) {
  const compact = useCompactLayout()
  const t = useT()
  const {
    project,
    activeSlideGroupId,
    setActiveSlideGroup,
    setActiveCanvasFormat,
    addSlideGroup,
    removeSlideGroup,
    duplicateSlideGroup,
    updateSlideGroup,
    reorderSlideGroups,
    activeCanvasFormat,
    activeFamily,
    panoSettings,
    updatePanoSettings,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    setActiveSlideGroup: s.setActiveSlideGroup,
    setActiveCanvasFormat: s.setActiveCanvasFormat,
    addSlideGroup: s.addSlideGroup,
    removeSlideGroup: s.removeSlideGroup,
    duplicateSlideGroup: s.duplicateSlideGroup,
    updateSlideGroup: s.updateSlideGroup,
    reorderSlideGroups: s.reorderSlideGroups,
    activeCanvasFormat: s.activeCanvasFormat,
    activeFamily: s.activeFamily,
    panoSettings: s.project.settings.pano ?? { gapPx: 24, compensate: false },
    updatePanoSettings: s.updatePanoSettings,
  })))

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const baseFormat = getProjectBaseFormat(project)
  const viewProject = {
    ...project,
    slideGroups: project.slideGroups.map((group) => ({
      ...group,
      ...getFormatCanvasDims(group, activeCanvasFormat, baseFormat, project.settings.customFormats),
    })),
  }
  const visibleGroups = selectFormatViewGroups(viewProject, activeCanvasFormat, activeFamily)
  const activeGroup = viewProject.slideGroups.find((g) => g.id === activeSlideGroupId)
  // Whether ANY slide group in the project is a pano/strip — not just the active
  // one — since panoSettings.compensate is a project-wide setting.
  const hasPano = project.slideGroups.some((g) => g.numSlides > 1)

  // The formats currently active for this project
  // Export targets — Base is used when no platform or custom formats are active.

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // Focus rename input
  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 30)
  }, [renamingId])

  const startRename = (groupId: string, currentName: string) => {
    setContextMenu(null)
    setRenamingId(groupId)
    setRenameValue(currentName)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) updateSlideGroup(renamingId, { name: renameValue.trim() })
    setRenamingId(null)
    setRenameValue('')
  }

  const handleContextMenu = (point: { clientX: number; clientY: number }, groupId: string) => {
    const MENU_HEIGHT = 100 // 3 items × ~32px
    const y = point.clientY + MENU_HEIGHT > window.innerHeight ? point.clientY - MENU_HEIGHT : point.clientY
    setContextMenu({ groupId, x: point.clientX, y })
  }

  const selectSlideGroup = (id: string) => {
    const group = project.slideGroups.find((candidate) => candidate.id === id)
    if (group && !visibleGroups.some((visibleGroup) => visibleGroup.id === group.id)) setActiveCanvasFormat(BASE_CANVAS_FORMAT)
    setActiveSlideGroup(id)
  }

  const handleMenuAction = (action: string, groupId: string) => {
    setContextMenu(null)
    switch (action) {
      case 'rename': {
        const group = project.slideGroups.find((g) => g.id === groupId)
        if (group) startRename(groupId, group.name)
        break
      }
      case 'duplicate': duplicateSlideGroup(groupId); break
      case 'delete':
        if (project.slideGroups.length > 1) removeSlideGroup(groupId)
        break
    }
  }

  // Build flat slide list with global sequential numbers (used for globalNum lookup)
  const flatSlides: FlatSlide[] = []
  let globalNum = 0
  for (const group of visibleGroups) {
    const bgLayer = group.layers.find((l) => l.type === 'background') as BackgroundLayer | undefined
    const bgFill = bgLayer?.fill ?? group.background?.fill
    const bgCss = bgFill ? fillToCss(bgFill) : '#1a1a2e'
    for (let i = 0; i < group.numSlides; i++) {
      globalNum++
      flatSlides.push({ group, slideIdx: i, globalNum, bgCss })
    }
  }

  const THUMB_H = 44
  const borderColor = 'rgba(255,255,255,0.06)'

  // ─── Drag-and-drop ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = visibleGroups.map((g) => g.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    const reorderedVisibleIds = arrayMove(ids, oldIndex, newIndex)
    let nextVisibleIndex = 0
    reorderSlideGroups(project.slideGroups.map((group) => (
      visibleGroups.some((visibleGroup) => visibleGroup.id === group.id) ? reorderedVisibleIds[nextVisibleIndex++] : group.id
    )))
  }

  return (
    <footer
      className="pd-slides h-20 flex items-center gap-3 px-3 shrink-0 border-t"
      style={{ background: 'var(--pd-c-18181f)', borderColor }}
    >
      {/* Width follows the responsive LayersPanel width, less this footer's 12px inset. */}
      {/* Desktop keeps the labelled column; a phone gets the card in the strip
          below, because this column has nowhere to go at that width. */}
      {!compact && (
        <section
          aria-label={t('slides.options')}
          className="pd-slide-options flex w-[196px] shrink-0 flex-col gap-1.5 border-e border-[var(--pd-line-subtle)] pe-3 min-[1440px]:w-[212px]"
        >
          <p className="text-[10px] text-[var(--pd-c-8a86a0)]">{t('slides.title')}</p>
          <SlideOptionsControls
            activeGroup={activeGroup}
            hasPano={hasPano}
            panoSettings={panoSettings}
            onSetNumSlides={(value) => activeGroup && updateSlideGroup(activeGroup.id, { numSlides: value })}
            onUpdatePano={updatePanoSettings}
          />
        </section>
      )}

      <div className="pd-slide-thumbnails flex items-center gap-2 flex-1 overflow-x-auto min-w-0">
        {compact && (
          <SlideOptionsCard
            activeGroup={activeGroup}
            hasPano={hasPano}
            panoSettings={panoSettings}
            thumbHeight={THUMB_H}
            onSetNumSlides={(value) => activeGroup && updateSlideGroup(activeGroup.id, { numSlides: value })}
            onUpdatePano={updatePanoSettings}
          />
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleGroups.map((g) => g.id)} strategy={horizontalListSortingStrategy}>
            {visibleGroups.map((group, groupIdx) => {
              const groupSlides = flatSlides.filter((fs) => fs.group.id === group.id)
              return (
                <SortableGroupItem
                  key={group.id}
                  group={group}
                  groupSlides={groupSlides}
                  isActive={group.id === activeSlideGroupId}
                  isFirst={groupIdx === 0}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  thumbnails={thumbnails}
                  staleGroupIds={staleGroupIds}
                  captureThumbnail={onCaptureThumbnail}
                  THUMB_H={THUMB_H}
                  handleContextMenu={handleContextMenu}
                  startRename={startRename}
                  setActiveSlideGroup={selectSlideGroup}
                  commitRename={commitRename}
                  setRenamingId={setRenamingId}
                  setRenameValue={setRenameValue}
                />
              )
            })}
          </SortableContext>
        </DndContext>

        {/* Add slide group button — kept outside SortableContext so it's not draggable */}
        <button
          onClick={addSlideGroup}
          title={t('slides.addGroup')}
          aria-label={t('slides.addGroup')}
          className="shrink-0 w-8 h-8 flex items-center justify-center text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)] rounded border border-[var(--pd-line-soft)] hover:border-[var(--pd-line-loud)] transition-colors ml-1"
        >
          <Icon name="plus" size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          // A real menu: it is reached by a long press or a right-click and
          // has no other affordance, so without the role it is invisible to a
          // screen reader — and to anything looking for it by role.
          role="menu"
          aria-label={t('slides.options')}
          className="pd-slide-menu fixed z-[var(--pd-z-popover)] py-1 rounded shadow-2xl border border-[var(--pd-line-soft)] bg-[var(--pd-panel)]"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 140 }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { action: 'rename', label: 'Rename' },
            { action: 'duplicate', label: 'Duplicate' },
          ].map(({ action, label }) => (
            <button
              key={action}
              role="menuitem"
              className="w-full text-start px-3 py-2 text-xs text-[var(--pd-c-e8e8f0)] hover:bg-[var(--pd-fill)] transition-colors"
              onClick={() => handleMenuAction(action, contextMenu.groupId)}
            >
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--pd-line-soft)]" />
          <button role="menuitem" className="w-full text-start px-3 py-2 text-xs text-[var(--pd-danger)] hover:bg-[var(--pd-fill)] transition-colors" onClick={() => handleMenuAction('delete', contextMenu.groupId)}>Delete</button>
        </div>
      )}
    </footer>
  )
}
