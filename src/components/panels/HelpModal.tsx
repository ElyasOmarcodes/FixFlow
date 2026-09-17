import { useT, useUiLanguageStore } from '@/i18n'
import { useMemo, useRef, useState } from 'react'
import { ModalShell } from '@/components/ui/ModalShell'
import { getHelpChapters, type HelpSectionId } from '@/components/panels/help/loadHelpChapters'
import { HelpMarkdown } from '@/components/panels/help/HelpMarkdown'
import { Icon } from '@/components/ui/Icon'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

const GROUP_LABELS = ['GETTING STARTED', 'DESIGN', 'ADAPT', 'DELIVER'] as const

export function HelpModal({ open, onClose }: HelpModalProps) {
  const t = useT()
  const language = useUiLanguageStore((s) => s.language)
  const chapters = useMemo(() => getHelpChapters(language), [language])
  const groupLabels = { 'GETTING STARTED': t('help.start'), DESIGN: t('help.design'), ADAPT: t('help.adapt'), DELIVER: t('help.deliver') }
  const [activeId, setActiveId] = useState<HelpSectionId>('introduction')
  const [query, setQuery] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const activeIndex = chapters.findIndex((section) => section.id === activeId)
  const activeSection = chapters[activeIndex] ?? chapters[0]
  const filteredSections = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return chapters
    return chapters.filter((section) => section.title.toLowerCase().includes(normalized))
  }, [query, chapters])

  const selectSection = (id: HelpSectionId) => {
    setActiveId(id)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('help.title')}
      closeLabel={t('common.close')}
      maxWidth="max-w-[1120px]"
      backdropClassName="fixed inset-0 flex items-center justify-center p-3 sm:p-5"
      backdropStyle={{ background: 'rgba(4,4,7,0.72)', backdropFilter: 'blur(6px)' }}
      panelClassName="relative w-full h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
      panelStyle={{
        background: 'var(--pd-c-18181f)',
        borderColor: 'rgba(255,255,255,0.09)',
        boxShadow: '0 32px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,110,246,0.04)',
      }}
      closeButtonClassName="absolute top-4 end-4 z-10 text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)] transition-all text-base w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--pd-fill)]"
      header={(
        <header className="relative shrink-0 overflow-hidden border-b border-[var(--pd-line)] px-5 py-4 sm:px-6">
          <div className="pointer-events-none absolute -top-16 start-12 h-32 w-64 rounded-full bg-[var(--pd-c-7c6ef6)] opacity-[0.08] blur-3xl" />
          <div className="relative flex items-center gap-3 pr-10">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(155,143,255,0.28)] bg-[var(--pd-accent-wash)] text-[var(--pd-c-b8afff)] shadow-[0_8px_24px_rgba(124,110,246,0.12)]">
              <span aria-hidden="true" className="text-base">?</span>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--pd-c-f0eff8)]">
                {t('help.title')}
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--pd-c-6b6b7a)]">
                {t('help.subtitle')}
              </p>
            </div>
            <span className="ml-auto hidden rounded-full border border-[var(--pd-line)] bg-[var(--pd-fill)] px-2.5 py-1 text-[10px] font-medium tracking-wide text-[var(--pd-c-6b6b7a)] sm:block">
              {chapters.length} {t('help.sections')}
            </span>
          </div>
        </header>
      )}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-[var(--pd-line-subtle)] bg-[var(--pd-c-131318)] md:flex">
          <div className="border-b border-[var(--pd-line)] p-3">
            <label className="relative block">
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--pd-c-525260)]">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('help.search')}
                aria-label={t('help.search')}
                className="h-9 w-full rounded-lg border border-[var(--pd-line)] bg-[var(--pd-c-0f0f13)] pl-8 pr-3 text-[11px] text-[var(--pd-c-d8d8e2)] outline-none transition placeholder:text-[var(--pd-c-4a4a5a)] focus:border-[rgba(124,110,246,0.52)] focus:ring-2 focus:ring-[rgba(124,110,246,0.08)]"
              />
            </label>
          </div>

          <nav aria-label={t('help.sections')} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {GROUP_LABELS.map((group) => {
              const sections = filteredSections.filter((section) => section.group === group)
              if (sections.length === 0) return null
              return (
                <div key={groupLabels[group]} className="mb-4 last:mb-0">
                  <p className="mb-1.5 px-2 text-[9px] font-semibold tracking-[0.18em] text-[var(--pd-c-4a4a5a)]">
                    {groupLabels[group]}
                  </p>
                  <div className="space-y-0.5">
                    {sections.map((section) => {
                      const isActive = section.id === activeId
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => selectSection(section.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-[11px] transition-all ${
                            isActive
                              ? 'bg-[var(--pd-accent-wash)] text-[var(--pd-c-c4b5fd)]'
                              : 'text-[var(--pd-c-777786)] hover:bg-[var(--pd-fill-subtle)] hover:text-[var(--pd-c-d8d8e2)]'
                          }`}
                        >
                          {isActive && <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-[#8f82ff]" />}
                          <span className={`w-5 shrink-0 text-end font-mono text-[9px] ${isActive ? 'text-[var(--pd-c-9b8fff)]' : 'text-[var(--pd-c-4a4a5a)] group-hover:text-[var(--pd-c-6b6b7a)]'}`}>
                            {String(section.number).padStart(2, '0')}
                          </span>
                          <span className="truncate">{section.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {filteredSections.length === 0 && (
              <div className="px-2 py-8 text-center text-[11px] leading-relaxed text-[var(--pd-c-525260)]">
                {t('help.empty')}<br />“{query}”
              </div>
            )}
          </nav>
          <div className="border-t border-[var(--pd-line)] px-5 py-3 text-[10px] text-[var(--pd-c-4a4a5a)]">
            {t('help.jump')}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[var(--pd-c-18181f)]">
          <div className="shrink-0 border-b border-[var(--pd-line-subtle)] bg-[var(--pd-c-15151b)] px-4 py-2.5 md:hidden">
            <label className="flex items-center gap-3">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[var(--pd-c-525260)]">{t('help.sections')}</span>
              <select
                value={activeId}
                onChange={(event) => selectSection(event.target.value as HelpSectionId)}
                className="min-w-0 flex-1 rounded-lg border border-[var(--pd-line-soft)] bg-[var(--pd-c-0f0f13)] px-3 py-2 text-[11px] text-[var(--pd-c-d8d8e2)] outline-none focus:border-[var(--pd-accent-soft)]"
                aria-label={t('help.choose')}
              >
                {chapters.map((section) => (
                  <option key={section.id} value={section.id}>
                    {String(section.number).padStart(2, '0')} · {section.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
            <article className="mx-auto max-w-[760px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
              <div className="mb-7 flex items-start gap-4 border-b border-[var(--pd-line)] pb-6">
                <span className="mt-0.5 font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--pd-c-9b8fff)]">
                  {String(activeSection.number).padStart(2, '0')}
                </span>
                <div>
                  <p className="mb-2 text-[9px] font-semibold tracking-[0.18em] text-[var(--pd-c-525260)]">
                    {groupLabels[activeSection.group]}
                  </p>
                  <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[var(--pd-c-f0eff8)] sm:text-2xl">
                    {activeSection.title}
                  </h3>
                </div>
              </div>

              <div key={activeSection.id} className="animate-[fixflow-loader-enter_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
                <HelpMarkdown source={activeSection.body} />
              </div>

              <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--pd-line-subtle)] pt-5">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => selectSection(chapters[activeIndex - 1].id)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--pd-line-soft)] px-3 py-2 text-[11px] text-[var(--pd-c-8a86a0)] transition hover:border-[var(--pd-line)] hover:text-[var(--pd-c-e8e8f0)] disabled:pointer-events-none disabled:opacity-0"
                >
                  <Icon name="chevron-left" size={12} />
                  {t('help.previous')}
                </button>
                <span className="font-mono text-[9px] text-[var(--pd-c-4a4a5a)]">{activeIndex + 1} / {chapters.length}</span>
                <button
                  type="button"
                  disabled={activeIndex === chapters.length - 1}
                  onClick={() => selectSection(chapters[activeIndex + 1].id)}
                  className="flex items-center gap-1.5 rounded-lg border border-[rgba(124,110,246,0.22)] bg-[rgba(124,110,246,0.07)] px-3 py-2 text-[11px] text-[var(--pd-c-b8afff)] transition hover:border-[rgba(124,110,246,0.42)] hover:bg-[var(--pd-accent-wash)] disabled:pointer-events-none disabled:opacity-0"
                >
                  {t('help.next')}
                  <Icon name="chevron-right" size={12} />
                </button>
              </div>
            </article>
          </div>
        </main>
      </div>
    </ModalShell>
  )
}
