import { MobileMoreSheet } from './MobileMoreSheet'
import { useCompactLayout } from '@/hooks/useCompactLayout'
import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore, useUndoRedo } from '@/store'
import { notifyProjectConflict, useProjectsStore } from '@/store/projects'
import { useAssistantStore } from '@/store/assistant'
import { ProjectConflictError } from '@/store/storage/types'
import { BrandKitButton } from '@/components/toolbar/BrandKitButton'
import { Logo } from '@/components/toolbar/Logo'
import { MenuBar, type MenuSpec } from '@/components/toolbar/MenuBar'
import { Icon } from '@/components/ui/Icon'
import { UI_LANGUAGES, useT, useUiLanguageStore } from '@/i18n'
import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from '@/utils/theme'

// Lazy-load heavy modals — only fetched when the user opens them for the first time.
const ProjectsModal = lazy(() =>
  import('@/components/panels/ProjectsModal').then((m) => ({ default: m.ProjectsModal })),
)
const TemplatesModal = lazy(() =>
  import('@/components/panels/TemplatesModal').then((m) => ({ default: m.TemplatesModal })),
)
const SettingsModal = lazy(() =>
  import('@/components/panels/SettingsModal').then((m) => ({ default: m.SettingsModal })),
)
const HelpModal = lazy(() =>
  import('@/components/panels/HelpModal').then((m) => ({ default: m.HelpModal })),
)
const TranslateCanvasModal = lazy(() =>
  import('@/components/panels/TranslateCanvasModal').then((m) => ({ default: m.TranslateCanvasModal })),
)
const GenerateSlideModal = lazy(() =>
  import('@/components/panels/GenerateSlideModal').then((m) => ({ default: m.GenerateSlideModal })),
)
const ApiKeysModal = lazy(() =>
  import('@/components/panels/ApiKeysModal').then((m) => ({ default: m.ApiKeysModal })),
)

interface ToolbarProps {
  onExport: () => void
  onPreview: () => void
  mode: 'editor' | 'localization'
  onSetMode: (mode: 'editor' | 'localization') => void
  /** Reopen the start screen. */
  onHome: () => void
}

export function Toolbar({ mode, onSetMode, onExport, onPreview, onHome }: ToolbarProps) {
  const t = useT()
  // The desktop toolbar is not rendered at all on compact widths — it is not
  // merely hidden. A hidden copy would duplicate every control in the
  // accessibility tree and give the sheet's buttons ghost twins.
  const compact = useCompactLayout()
  const {
    project,
    selection,
    selectedLayerIds,
    createGroup,
    dissolveGroup,
    duplicateLayer,
    removeLayer,
    clearMultiSelection,
    smartSnap,
    toggleSmartSnap,
    showGrid,
    toggleGrid,
    showSeamGuides,
    toggleSeamGuides,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    selection: s.selection,
    selectedLayerIds: s.selectedLayerIds,
    createGroup: s.createGroup,
    dissolveGroup: s.dissolveGroup,
    duplicateLayer: s.duplicateLayer,
    removeLayer: s.removeLayer,
    clearMultiSelection: s.clearMultiSelection,
    smartSnap: s.smartSnap,
    toggleSmartSnap: s.toggleSmartSnap,
    showGrid: s.showGrid,
    toggleGrid: s.toggleGrid,
    showSeamGuides: s.showSeamGuides,
    toggleSeamGuides: s.toggleSeamGuides,
  })))

  const { undo, redo, canUndo, canRedo } = useUndoRedo()

  // Projects store — for save indicator + rename
  const { projects, renameProject } = useProjectsStore(
    useShallow((s) => ({
      projects: s.projects,
      renameProject: s.renameProject,
    })),
  )
  const activeProjectMeta = projects.find((p) => p.id === project.id)

  // Inline project name editing
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  function startEditingName() {
    setTempName(project.name)
    setEditingName(true)
  }

  function commitName() {
    const trimmed = tempName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed).catch((err) => {
        if (err instanceof ProjectConflictError) notifyProjectConflict(err.projectId)
        else console.error('[FixFlow] Failed to rename project', err)
      })
    }
    setEditingName(false)
  }

  function cancelName() {
    setEditingName(false)
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.select()
  }, [editingName])
  const assistantOpen = useAssistantStore((state) => state.open)
  const toggleAssistant = useAssistantStore((state) => state.toggleOpen)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [translateOpen, setTranslateOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [apiKeysOpen, setApiKeysOpen] = useState(false)

  // Saved indicator — flashes "Saving…" then "Saved" briefly
  const [saveLabel, setSaveLabel] = useState<'saved' | 'saving' | null>(null)
  const saveLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Show "Saved" for 2s whenever the meta updatedAt changes
    if (!activeProjectMeta) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveLabel('saved')
    if (saveLabelTimer.current) clearTimeout(saveLabelTimer.current)
    saveLabelTimer.current = setTimeout(() => setSaveLabel(null), 2000)
    return () => {
      if (saveLabelTimer.current) clearTimeout(saveLabelTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectMeta?.updatedAt])

  // Picking something that opens a surface of its own dismisses the sheet;
  // toggles and the theme select leave it up, because you may want several.
  const runAndClose = (action: () => void) => () => { action(); setMoreOpen(false) }

  // ─ What the menus and the options bar act on ──────────────────────────────

  const targetIds = selectedLayerIds.length > 0
    ? selectedLayerIds
    : selection?.layerId ? [selection.layerId] : []
  const selectionCount = targetIds.length
  const duplicateSelection = () => { for (const id of targetIds) duplicateLayer(id) }
  const deleteSelection = () => { for (const id of targetIds) removeLayer(id); clearMultiSelection() }

  // The Insert menu reuses the layer panel's own insert path rather than
  // duplicating it: image insertion owns a file input and icon insertion owns
  // the picker, and a second copy of either would drift from the first.
  const insert = (kind: string) => {
    window.dispatchEvent(new CustomEvent('fixflow:insert', { detail: kind }))
  }

  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference())
  const chooseTheme = (next: ThemePreference) => {
    setTheme(next)
    saveThemePreference(next)
    applyTheme(next)
  }

  const uiLanguage = useUiLanguageStore((state) => state.language)
  const setUiLanguage = useUiLanguageStore((state) => state.setLanguage)

  const menus: MenuSpec[] = [
    {
      key: 'file',
      label: t('menu.file'),
      items: [
        { key: 'home', label: t('toolbar.home'), icon: 'home', onSelect: onHome },
        { key: 'projects', label: `${t('toolbar.projects')}…`, icon: 'grid', onSelect: () => setProjectsOpen(true) },
        { key: 'templates', label: `${t('toolbar.templates')}…`, icon: 'template', onSelect: () => setTemplatesOpen(true) },
        { key: 'rename', label: `${t('common.rename')}…`, icon: 'pencil', separatorBefore: true, onSelect: startEditingName },
        { key: 'preview', label: t('slides.preview'), icon: 'eye', separatorBefore: true, onSelect: onPreview },
        { key: 'export', label: `${t('common.export')}…`, icon: 'download', shortcut: 'Ctrl+E', onSelect: onExport },
      ],
    },
    {
      key: 'edit',
      label: t('menu.edit'),
      items: [
        { key: 'undo', label: t('toolbar.undo'), icon: 'undo', shortcut: 'Ctrl+Z', disabled: !canUndo, onSelect: () => undo() },
        { key: 'redo', label: t('toolbar.redo'), icon: 'redo', shortcut: 'Ctrl+Shift+Z', disabled: !canRedo, onSelect: () => redo() },
        { key: 'duplicate', label: t('workspace.duplicate'), icon: 'copy', shortcut: 'Ctrl+D', separatorBefore: true, disabled: selectionCount === 0, onSelect: duplicateSelection },
        { key: 'delete', label: t('workspace.delete'), icon: 'trash', shortcut: 'Del', disabled: selectionCount === 0, onSelect: deleteSelection },
        { key: 'group', label: t('toolbar.group'), icon: 'group', separatorBefore: true, disabled: selectedLayerIds.length < 2, onSelect: () => createGroup(selectedLayerIds) },
        { key: 'ungroup', label: t('layerUi.ungroup'), icon: 'ungroup', disabled: !selection?.layerId, onSelect: () => { if (selection?.layerId) dissolveGroup(selection.layerId) } },
      ],
    },
    {
      key: 'insert',
      label: t('menu.insert'),
      items: [
        { key: 'text', label: t('layers.insertText'), icon: 'text', onSelect: () => insert('text') },
        { key: 'image', label: t('layers.insertImage'), icon: 'image', onSelect: () => insert('image') },
        { key: 'shape', label: t('layers.insertShape'), icon: 'shape', onSelect: () => insert('shape') },
        { key: 'chip', label: t('layers.insertChip'), icon: 'chip', onSelect: () => insert('chip') },
        { key: 'icon', label: t('layers.insertIcon'), icon: 'sparkles', onSelect: () => insert('icon') },
        { key: 'emoji', label: t('layers.insertEmoji'), icon: 'emoji', onSelect: () => insert('emoji') },
        { key: 'phone', label: t('layers.insertDevices'), icon: 'phone', separatorBefore: true, onSelect: () => insert('phone') },
        { key: 'brand', label: t('layers.insertBrand'), icon: 'brand', onSelect: () => insert('brand') },
      ],
    },
    {
      key: 'view',
      label: t('menu.view'),
      items: [
        { key: 'fit', label: t('workspace.fit'), icon: 'maximize', onSelect: () => window.dispatchEvent(new Event('fixflow:fit')) },
        { key: 'grid', label: t('menu.grid'), checked: showGrid, separatorBefore: true, onSelect: toggleGrid },
        { key: 'seams', label: t('menu.seamGuides'), checked: showSeamGuides, onSelect: toggleSeamGuides },
        { key: 'snap', label: t('toolbar.smartSnap'), checked: smartSnap, onSelect: toggleSmartSnap },
        { key: 'theme-system', label: t('workspace.system'), checked: theme === 'system', separatorBefore: true, groupLabel: t('workspace.theme'), onSelect: () => chooseTheme('system') },
        { key: 'theme-light', label: t('menu.themeLight'), checked: theme === 'light', onSelect: () => chooseTheme('light') },
        { key: 'theme-dark', label: t('menu.themeDark'), checked: theme === 'dark', onSelect: () => chooseTheme('dark') },
      ],
    },
    {
      key: 'ai',
      label: t('menu.ai'),
      items: [
        {
          key: 'assistant',
          label: t('assistant.title'),
          icon: 'sparkles',
          shortcut: 'Ctrl+J',
          checked: assistantOpen,
          onSelect: () => toggleAssistant(),
        },
        { key: 'generate', label: `${t('generate.action')}…`, icon: 'ai', separatorBefore: true, onSelect: () => setGenerateOpen(true) },
        { key: 'translate', label: `${t('translateAll.action')}…`, icon: 'sparkles', onSelect: () => setTranslateOpen(true) },
        {
          key: 'localization',
          label: mode === 'localization' ? t('toolbar.backToDesign') : t('toolbar.localization'),
          icon: 'languages',
          separatorBefore: true,
          onSelect: () => onSetMode(mode === 'localization' ? 'editor' : 'localization'),
        },
        { key: 'keys', label: `${t('menu.apiKeys')}…`, icon: 'lock', separatorBefore: true, onSelect: () => setApiKeysOpen(true) },
      ],
    },
    {
      key: 'help',
      label: t('menu.help'),
      items: [
        { key: 'guide', label: t('toolbar.help'), icon: 'help', shortcut: 'F1', onSelect: () => setHelpOpen(true) },
        { key: 'settings', label: `${t('toolbar.settings')}…`, icon: 'settings', separatorBefore: true, onSelect: () => setSettingsOpen(true) },
        ...UI_LANGUAGES.map((option) => ({
          key: `lang-${option.code}`,
          label: option.nativeLabel,
          checked: uiLanguage === option.code,
          separatorBefore: option.code === UI_LANGUAGES[0].code,
          groupLabel: option.code === UI_LANGUAGES[0].code ? t('settings.language') : undefined,
          onSelect: () => setUiLanguage(option.code),
        })),
        { key: 'github', label: t('toolbar.github'), icon: 'github', separatorBefore: true, href: 'https://github.com/ElyasOmarcodes/FixFlow' },
      ],
    },
  ]

  return (<>
    {/* Lazy-loaded on first open, and outside both layouts so either can open them. */}
    <Suspense>
      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TranslateCanvasModal
        open={translateOpen}
        onClose={() => setTranslateOpen(false)}
        onNeedsApiKey={() => { setTranslateOpen(false); setApiKeysOpen(true) }}
      />
      <GenerateSlideModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onNeedsApiKey={() => { setGenerateOpen(false); setApiKeysOpen(true) }}
      />
      <ApiKeysModal open={apiKeysOpen} onClose={() => setApiKeysOpen(false)} />
    </Suspense>

    {compact && (
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        projectName={project.name}
        onRenameProject={(name) => {
          renameProject(project.id, name).catch((err) => {
            if (err instanceof ProjectConflictError) notifyProjectConflict(err.projectId)
            else console.error('[FixFlow] Failed to rename project', err)
          })
        }}
        groups={[
          {
            key: 'project',
            title: t('toolbar.projects'),
            actions: [
              { key: 'home', icon: 'home', label: t('toolbar.home'), onClick: runAndClose(onHome) },
              { key: 'projects', icon: 'grid', label: t('toolbar.projects'), onClick: runAndClose(() => setProjectsOpen(true)) },
              { key: 'templates', icon: 'template', label: t('toolbar.templates'), onClick: runAndClose(() => setTemplatesOpen(true)) },
              { key: 'preview', icon: 'eye', label: t('slides.preview'), onClick: runAndClose(onPreview) },
              { key: 'export', icon: 'download', label: t('common.export'), onClick: runAndClose(onExport), primary: true },
            ],
          },
          {
            key: 'edit',
            title: t('workspace.edit'),
            actions: [
              { key: 'undo', icon: 'undo', label: t('toolbar.undo'), onClick: () => undo(), disabled: !canUndo },
              { key: 'redo', icon: 'redo', label: t('toolbar.redo'), onClick: () => redo(), disabled: !canRedo },
              { key: 'snap', icon: 'magnet', label: t('toolbar.smartSnap'), onClick: toggleSmartSnap, active: smartSnap },
              ...(selectedLayerIds.length >= 2 ? [{
                key: 'group',
                icon: 'group' as const,
                label: `${t('toolbar.group')} (${selectedLayerIds.length})`,
                onClick: runAndClose(() => createGroup(selectedLayerIds)),
              }] : []),
            ],
          },
          {
            key: 'ai',
            title: t('translateAll.title'),
            actions: [
              {
                key: 'generate-slide',
                icon: 'ai',
                label: t('generate.action'),
                onClick: runAndClose(() => setGenerateOpen(true)),
                primary: true,
              },
              {
                key: 'translate-all',
                icon: 'sparkles',
                label: t('translateAll.action'),
                onClick: runAndClose(() => setTranslateOpen(true)),
              },
            ],
          },
          {
            key: 'workspace',
            title: t('workspace.tools'),
            actions: [
              { key: 'localization', icon: 'languages', label: mode === 'localization' ? t('toolbar.backToDesign') : t('toolbar.localization'), onClick: runAndClose(() => onSetMode(mode === 'localization' ? 'editor' : 'localization')), active: mode === 'localization' },
              { key: 'settings', icon: 'settings', label: t('toolbar.settings'), onClick: runAndClose(() => setSettingsOpen(true)) },
              { key: 'help', icon: 'help', label: t('toolbar.help'), onClick: runAndClose(() => setHelpOpen(true)) },
              { key: 'github', icon: 'github', label: t('toolbar.github'), onClick: () => {}, href: 'https://github.com/ElyasOmarcodes/FixFlow' },
            ],
          },
        ]}
      />
    )}

    <div className="pd-mobile-header">
      <button aria-label={t('toolbar.projects')} onClick={() => setProjectsOpen(true)}><Icon name="grid" size={20} /></button>
      <strong>{project.name}</strong>
      <button aria-label={t('slides.preview')} onClick={onPreview}><Icon name="eye" size={18} /></button>
      <button aria-label={t('common.export')} onClick={onExport}><Icon name="download" size={18} /></button>
      <button aria-label={t('toolbar.undo')} disabled={!canUndo} onClick={() => undo()}><Icon name="undo" size={20} /></button>
      <button aria-label={t('toolbar.redo')} disabled={!canRedo} onClick={() => redo()}><Icon name="redo" size={20} /></button>
      <button aria-label={t('toolbar.settings')} onClick={() => setSettingsOpen(true)}><Icon name="settings" size={20} /></button>
      <button aria-label={t('workspace.more')} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}><Icon name="more-horizontal" size={20} /></button>
    </div>
    {!compact && <header className="pd-toolbar" style={{ background: 'var(--pd-c-18181f)' }}>
      {/* Row one: identity, the menus, the document. */}
      <div className="pd-menubar-row">
        <button
          type="button"
          className="pd-home-button"
          onClick={onHome}
          title={t('toolbar.home')}
          aria-label={t('toolbar.home')}
        >
          <Logo />
        </button>

        <MenuBar menus={menus} />

        <div className="pd-doc-title">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={tempName}
              aria-label={t('toolbar.renameProject')}
              onChange={(event) => setTempName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitName()
                if (event.key === 'Escape') cancelName()
              }}
            />
          ) : (
            <button type="button" onClick={startEditingName} title={t('toolbar.renameProject')}>
              {project.name}
            </button>
          )}
          {saveLabel && (
            <span className="pd-save-state">
              <Icon name={saveLabel === 'saving' ? 'spinner' : 'check'} size={11} strokeWidth={2.2} />
              {saveLabel === 'saving' ? t('toolbar.saving') : t('toolbar.saved')}
            </span>
          )}
        </div>
      </div>

      {/* Row two: what you reach for while working — Photoshop's options bar,
          which is where the commands that change with the selection belong. */}
      <div className="pd-optionsbar">
        <div className="pd-options-group">
          <button
            type="button"
            onClick={() => undo()}
            disabled={!canUndo}
            title={`${t('toolbar.undo')} (Ctrl+Z)`}
            aria-label={t('toolbar.undo')}
          >
            <Icon name="undo" size={15} />
          </button>
          <button
            type="button"
            onClick={() => redo()}
            disabled={!canRedo}
            title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('toolbar.redo')}
          >
            <Icon name="redo" size={15} />
          </button>
        </div>

        <div className="pd-options-divider" />

        <BrandKitButton />

        <div className="pd-options-divider" />

        <button
          type="button"
          onClick={toggleSmartSnap}
          aria-pressed={smartSnap}
          title={`${t('toolbar.smartSnapTitle')} (Hold Alt to bypass)`}
          className="pd-options-toggle"
        >
          <Icon name="magnet" size={13} />
          {t('toolbar.smartSnap')}
        </button>

        {/* Only while something is selected: an options bar that shows the same
            controls whatever is on the canvas is just a second toolbar. */}
        {selectionCount > 0 && <>
          <div className="pd-options-divider" />
          <span className="pd-options-context">{t('layers.selected', { count: selectionCount })}</span>
          <div className="pd-options-group">
            <button type="button" onClick={duplicateSelection} title={t('workspace.duplicate')} aria-label={t('workspace.duplicate')}>
              <Icon name="copy" size={15} />
            </button>
            <button type="button" onClick={deleteSelection} title={t('workspace.delete')} aria-label={t('workspace.delete')}>
              <Icon name="trash" size={15} />
            </button>
          </div>
          {selectedLayerIds.length >= 2 && (
            <button
              type="button"
              onClick={() => createGroup(selectedLayerIds)}
              className="pd-options-primary"
              title={t('toolbar.groupTitle')}
            >
              <Icon name="group" size={13} />
              {t('toolbar.group')} ({selectedLayerIds.length})
            </button>
          )}
        </>}

        <div className="min-w-2 flex-1" />

        <button type="button" onClick={onPreview} title={t('slides.preview')} className="pd-options-toggle">
          <Icon name="eye" size={14} />
          {t('slides.preview')}
        </button>
        <button type="button" onClick={onExport} className="pd-options-export">
          <Icon name="download" size={14} />
          {t('common.export')}
        </button>
      </div>
    </header>}
  </>)
}
