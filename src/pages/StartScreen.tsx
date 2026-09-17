import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { notifyProjectConflict, useProjectsStore } from '@/store/projects'
import { useTemplatesStore, toAbsolute, type TemplateManifestEntry } from '@/store/templates'
import { useEditorStore } from '@/store'
import { ProjectConflictError } from '@/store/storage/types'
import { FileUploadButton } from '@/components/ui/FileUploadButton'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/toolbar/Logo'
import { nextUntitledName } from '@/utils/projectNames'
import { setShowStartScreenOnLaunch, shouldShowStartScreenOnLaunch } from '@/utils/startScreenPreference'
import { useT } from '@/i18n'

interface StartScreenProps {
  /** Dismiss and return to the editor. */
  onClose: () => void
}

/** Relative time, coarse on purpose: a recent list is scanned, not read. */
function relativeTime(iso: string, t: ReturnType<typeof useT>): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return t('start.justNow')
  if (minutes < 60) return t('start.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('start.hoursAgo', { count: hours })
  return t('start.daysAgo', { count: Math.floor(hours / 24) })
}

/**
 * A stable colour per project, derived from its id.
 *
 * Projects have no stored thumbnail — the library holds only metadata — so a
 * card would otherwise be a wall of identical grey rectangles. Deriving the
 * tile from the id means a project keeps the same colour every launch, which
 * is what actually makes a list of names scannable.
 */
function projectHue(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360
  return hash
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * The launch screen.
 *
 * Photoshop's home screen, and the reason it works: opening the app should put
 * you in front of your own work, not in front of whichever document happened
 * to be open last. Recent projects come first, templates second, and the
 * editor is one click away in either direction.
 *
 * It renders *over* the editor rather than replacing it, because the Konva
 * stage and its ResizeObserver have to stay mounted — tearing them down and
 * rebuilding them on every visit is what makes a web app feel like a web app.
 */
export function StartScreen({ onClose }: StartScreenProps) {
  const t = useT()
  const { projects, createProject, openProject, createProjectFromTemplate, importProjectFromJson } =
    useProjectsStore(useShallow((s) => ({
      projects: s.projects,
      createProject: s.createProject,
      openProject: s.openProject,
      createProjectFromTemplate: s.createProjectFromTemplate,
      importProjectFromJson: s.importProjectFromJson,
    })))
  const activeProjectId = useEditorStore((s) => s.project.id)
  const activeProjectName = useEditorStore((s) => s.project.name)
  const { manifest, loading, loadManifest, fetchTemplate } = useTemplatesStore()

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOnLaunch, setShowOnLaunch] = useState(shouldShowStartScreenOnLaunch)

  useEffect(() => { void loadManifest() }, [loadManifest])

  // Most recently touched first — the whole point of a recent list.
  const recent = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects],
  )

  const guard = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      if (err instanceof ProjectConflictError) notifyProjectConflict(err.projectId)
      else setError(err instanceof Error ? err.message : String(err))
      setBusy(null)
    }
  }

  const handleNew = () => guard('new', () => createProject(nextUntitledName(projects)))

  const handleOpen = (id: string) => guard(`open:${id}`, async () => {
    if (id !== activeProjectId) await openProject(id)
  })

  const handleTemplate = (entry: TemplateManifestEntry) => guard(`tpl:${entry.slug}`, async () => {
    // Always a new project, never appended: a template's slides carry their own
    // canvas size and palette, and dropping them into an open project is what
    // puts two designs on one canvas.
    await createProjectFromTemplate(await fetchTemplate(entry))
  })

  const handleImport = (files: File[]) => {
    const file = files[0]
    if (!file) return
    void guard('import', async () => {
      await importProjectFromJson(await file.text())
    })
  }

  const handleShowOnLaunch = (next: boolean) => {
    setShowOnLaunch(next)
    setShowStartScreenOnLaunch(next)
  }

  return (
    <div className="pd-start" role="dialog" aria-modal="true" aria-label={t('start.title')}>
      <div className="pd-start-scroll">
        <header className="pd-start-head">
          <Logo />
          <h1>{t('start.title')}</h1>
          <p>{t('start.tagline')}</p>
          <button type="button" className="pd-start-dismiss" onClick={onClose}>
            <Icon name="arrow-right" size={14} />
            {t('start.continueIn', { name: activeProjectName })}
          </button>
        </header>

        <div className="pd-start-actions">
          <button type="button" className="pd-start-cta" disabled={busy !== null} onClick={() => void handleNew()}>
            <Icon name="plus" size={18} />
            <span>
              <strong>{t('start.newProject')}</strong>
              <em>{t('start.newProjectHint')}</em>
            </span>
          </button>
          <FileUploadButton
            accept="application/json,.json"
            onFiles={handleImport}
            disabled={busy !== null}
            className="pd-start-cta pd-start-cta-quiet"
            ariaLabel={t('start.openFile')}
          >
            <Icon name="upload" size={18} />
            <span>
              <strong>{t('start.openFile')}</strong>
              <em>{t('start.openFileHint')}</em>
            </span>
          </FileUploadButton>
        </div>

        {error && (
          <p className="pd-start-error" role="alert">
            <Icon name="alert-triangle" size={13} />{error}
          </p>
        )}

        <section className="pd-start-section">
          <h2>{t('start.recent')}</h2>
          {recent.length === 0 ? (
            <p className="pd-start-empty">{t('start.noProjects')}</p>
          ) : (
            <ul className="pd-start-grid">
              {recent.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className="pd-start-card"
                    disabled={busy !== null}
                    onClick={() => void handleOpen(project.id)}
                  >
                    <span
                      className="pd-start-card-tile"
                      style={{
                        background: `linear-gradient(140deg, hsl(${projectHue(project.id)} 62% 58%), hsl(${(projectHue(project.id) + 48) % 360} 68% 44%))`,
                      }}
                      aria-hidden="true"
                    >
                      {busy === `open:${project.id}`
                        ? <Icon name="spinner" size={18} className="pd-spin-slow" />
                        : initials(project.name)}
                    </span>
                    <span className="pd-start-card-body">
                      <strong>{project.name}</strong>
                      <em>{relativeTime(project.updatedAt, t)}</em>
                    </span>
                    {project.id === activeProjectId && (
                      <span className="pd-start-card-badge">{t('start.open')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pd-start-section">
          <h2>{t('start.templates')}</h2>
          {loading && manifest.length === 0 && <p className="pd-start-empty">{t('common.loading')}</p>}
          <ul className="pd-start-grid pd-start-grid-wide">
            {manifest.map((entry) => (
              <li key={entry.slug}>
                <button
                  type="button"
                  className="pd-start-template"
                  disabled={busy !== null}
                  onClick={() => void handleTemplate(entry)}
                >
                  <span
                    className="pd-start-template-thumb"
                    style={entry.preview ? { background: entry.preview } : undefined}
                  >
                    {entry.thumbnail
                      ? <img src={toAbsolute(entry.thumbnail)} alt="" loading="lazy" />
                      : !entry.preview && <Icon name="template" size={22} />}
                    {busy === `tpl:${entry.slug}` && (
                      <span className="pd-start-template-busy"><Icon name="spinner" size={20} className="pd-spin-slow" /></span>
                    )}
                  </span>
                  <span className="pd-start-template-body">
                    <strong>{entry.name}</strong>
                    <em>{entry.slides ? t('start.slideCount', { count: entry.slides }) : entry.description}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pd-start-foot">
          <label>
            <input
              type="checkbox"
              checked={showOnLaunch}
              onChange={(event) => handleShowOnLaunch(event.target.checked)}
            />
            {t('start.showOnLaunch')}
          </label>
        </footer>
      </div>
    </div>
  )
}
