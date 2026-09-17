import { useState } from 'react'
import { useEditorStore } from '@/store'
import { useBrandColors } from '@/hooks/useBrandColors'
import { AiProviderSettings } from '@/components/ai/AiProviderSettings'
import { BrandColorList } from '@/components/common/BrandColorList'
import { ModalShell } from '@/components/ui/ModalShell'
import { NumberInput } from '@/components/ui/NumberInput'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icon, type IconName } from '@/components/ui/Icon'
import { UI_LANGUAGES, useT, useUiLanguageStore, type TranslationKey } from '@/i18n'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// ─── Shared style tokens ────────────────────────────────────────────────────

const labelCls = 'text-[11px] text-[var(--pd-c-6b6b7a)] mb-1 block uppercase tracking-[0.08em]'

// ─── Tab definitions ─────────────────────────────────────────────────────────

type Tab = 'ai' | 'language' | 'brand' | 'pano'

interface TabMeta {
  id: Tab
  labelKey: TranslationKey
  icon: IconName
  section: 'GLOBAL' | 'PROJECT'
}

const TABS: TabMeta[] = [
  { id: 'ai', labelKey: 'settings.ai', icon: 'ai', section: 'GLOBAL' },
  { id: 'language', labelKey: 'settings.language', icon: 'languages', section: 'GLOBAL' },
  { id: 'brand', labelKey: 'settings.brand', icon: 'palette', section: 'PROJECT' },
  { id: 'pano', labelKey: 'settings.pano', icon: 'image', section: 'PROJECT' },
]

// ─── Language tab content ─────────────────────────────────────────────────────

function LanguageSettingsContent() {
  const t = useT()
  const language = useUiLanguageStore((s) => s.language)
  const setLanguage = useUiLanguageStore((s) => s.setLanguage)

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--pd-c-e8e8f0)] mb-1">{t('settings.languageTitle')}</h3>
      <p className="text-[12px] text-[var(--pd-c-6b6b7a)] mb-5 leading-relaxed">{t('settings.languageHint')}</p>

      <div className="space-y-2">
        {UI_LANGUAGES.map((lang) => {
          const selected = lang.code === language
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              aria-pressed={selected}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                selected
                  ? 'border-[var(--pd-c-7c6ef6)] bg-[var(--pd-accent-wash)]'
                  : 'border-[var(--pd-line-soft)] hover:border-[var(--pd-line-loud)] hover:bg-[var(--pd-fill-subtle)]'
              }`}
            >
              <span
                className="w-6 shrink-0 text-[var(--pd-c-7c6ef6)]"
                aria-hidden="true"
              >
                {selected ? <Icon name="check" size={15} strokeWidth={2.4} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                {/* Native name leads: someone looking for Pashto scans for پښتو,
                    not for the English word. */}
                <span
                  dir={lang.dir}
                  className="block text-sm text-[var(--pd-c-e8e8f0)]"
                  style={{ fontFamily: lang.dir === 'rtl' ? 'Vazirmatn, Inter, system-ui, sans-serif' : undefined }}
                >
                  {lang.nativeLabel}
                </span>
                <span className="block text-[11px] text-[var(--pd-c-6b6b7a)]">{lang.label}</span>
              </span>
              <span className="shrink-0 rounded-full border border-[var(--pd-line)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--pd-c-6b6b7a)]">
                {lang.dir}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-[var(--pd-c-525260)]">{t('settings.languageRtlNote')}</p>
    </div>
  )
}

// ─── Brand tab content ────────────────────────────────────────────────────────

function BrandSettingsContent() {
  const t = useT()
  const brandColors = useBrandColors()

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--pd-c-e8e8f0)] mb-1">{t('settings.brandTitle')}</h3>
      <p className="text-[12px] text-[var(--pd-c-6b6b7a)] mb-5 leading-relaxed">
        {t('settings.brandHint')}
      </p>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[var(--pd-c-4a4a5a)] uppercase tracking-[0.1em]">
          {t('settings.colorCount', { count: brandColors.length })}
        </span>
      </div>
      <BrandColorList />
    </div>
  )
}

// ─── Pano tab content ─────────────────────────────────────────────────────────

function PanoSettingsContent() {
  const t = useT()
  const panoSettings = useEditorStore(
    (s) => s.project.settings.pano ?? { gapPx: 24, compensate: false },
  )
  const updatePanoSettings = useEditorStore((s) => s.updatePanoSettings)

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--pd-c-e8e8f0)] mb-1">{t('settings.panoTitle')}</h3>
      <p className="text-[12px] text-[var(--pd-c-6b6b7a)] mb-5 leading-relaxed">
        {t('settings.panoHint')}
      </p>

      <div className="space-y-5">
        {/* Gap input */}
        <div className="rounded-xl border border-[var(--pd-line-soft)] p-4 bg-[var(--pd-fill)]">
          <label className={labelCls}>{t('settings.gapTitle')}</label>
          <p className="text-[11px] text-[var(--pd-c-4a4a5a)] mb-3 leading-relaxed">
            {t('settings.gapHint')}
          </p>
          <div className="flex items-center gap-3">
            <NumberInput
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onValueChange={(value) =>
                updatePanoSettings({ gapPx: Math.max(0, Math.min(300, value)) })
              }
              className="bg-[var(--pd-c-0f0f13)] border border-[var(--pd-line)] rounded px-3 py-2 text-sm text-[var(--pd-c-e8e8f0)] w-24 focus:outline-none focus:border-[var(--pd-accent-soft)]"
            />
            <span className="text-xs text-[var(--pd-c-6b6b7a)]">px</span>
            <input
              type="range"
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onChange={(e) => updatePanoSettings({ gapPx: Number(e.target.value) })}
              className="flex-1 accent-[var(--pd-c-7c6ef6)]"
            />
          </div>
        </div>

        {/* Compensate checkbox */}
        <div className="rounded-xl border border-[var(--pd-line-soft)] p-4 bg-[var(--pd-fill)]">
          <div className="flex items-start gap-3">
            <ToggleSwitch
              variant="checkbox"
              id="pano-compensate"
              checked={panoSettings.compensate ?? false}
              onChange={(checked) => updatePanoSettings({ compensate: checked })}
              checkboxClassName="mt-0.5 accent-[var(--pd-c-7c6ef6)] w-4 h-4 shrink-0 cursor-pointer"
            />
            <div>
              <label
                htmlFor="pano-compensate"
                className="text-xs font-medium text-[var(--pd-c-e8e8f0)] cursor-pointer"
              >
                {t('settings.compensateTitle')}
              </label>
              <p className="text-[11px] text-[var(--pd-c-4a4a5a)] mt-1 leading-relaxed">
                {t('settings.compensateHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="rounded-lg border border-[var(--pd-fill-soft)] bg-[var(--pd-fill)] px-4 py-3">
          <p className="text-[11px] text-[var(--pd-c-6b6b7a)] leading-relaxed">
            <span className="text-[var(--pd-c-c4b5fd)]">{t('settings.current')}</span>{' '}
            {panoSettings.gapPx ?? 24}px{' '}
            {panoSettings.compensate
              ? t('settings.compensateOn')
              : t('settings.compensateOff')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('ai')
  const translate = useT()

  const sections = ['GLOBAL', 'PROJECT'] as const
  const tabsBySection = (section: (typeof sections)[number]) =>
    TABS.filter((t) => t.section === section)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={translate('settings.title')}
      closeLabel={translate('common.close')}
      maxWidth="max-w-5xl"
      panelClassName="pd-settings relative rounded-2xl border shadow-2xl w-full mx-4 h-[85vh] flex flex-col overflow-hidden"
      footerClassName="shrink-0 px-5 py-2.5 border-t border-[var(--pd-line-subtle)] flex items-center gap-3"
      footer={(
        <>
          <span className="text-[11px] text-[var(--pd-c-4a4a5a)] font-mono select-all">v{__APP_VERSION__}</span>
          <span className="text-[var(--pd-c-3a3a4a)]">·</span>
          <span className="text-[11px] text-[var(--pd-c-4a4a5a)] font-mono select-all" title="Git commit hash">{__GIT_HASH__}</span>
          <span className="flex-1" />
          <a href="https://github.com/ElyasOmarhs/FixFlow" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--pd-c-4a4a5a)] hover:text-[var(--pd-c-7c6ef6)] transition-colors">github.com/ElyasOmarhs/FixFlow</a>
        </>
      )}
    >
        {/* Body: sidebar + content */}
        <div className="pd-settings-body flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav
            className="pd-settings-tabs w-44 shrink-0 border-r border-[var(--pd-line-subtle)] p-3 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            {sections.map((section) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--pd-c-4a4a5a)] mb-1 mt-3 first:mt-0 px-2">
                  {translate(section === 'GLOBAL' ? 'settings.global' : 'settings.project')}
                </p>
                {tabsBySection(section).map((tabMeta) => (
                  <button
                    key={tabMeta.id}
                    type="button"
                    onClick={() => setTab(tabMeta.id)}
                    className={`w-full px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 text-start ${
                      tab === tabMeta.id
                        ? 'bg-[var(--pd-accent-wash-strong)] text-[var(--pd-c-c4b5fd)]'
                        : 'text-[var(--pd-c-6b6b7a)] hover:text-[var(--pd-c-e8e8f0)] hover:bg-[var(--pd-fill-soft)]'
                    }`}
                  >
                    <Icon name={tabMeta.icon} size={14} />
                    <span>{translate(tabMeta.labelKey)}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Content area */}
          <div className="pd-settings-content min-w-0 flex-1 overflow-y-auto p-6">
            {tab === 'ai' && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--pd-c-e8e8f0)] mb-1">{translate('settings.ai')}</h3>
                <p className="text-[12px] text-[var(--pd-c-6b6b7a)] mb-5 leading-relaxed">
                  {translate('settings.aiHint')}
                </p>
                <AiProviderSettings />
              </div>
            )}
            {tab === 'language' && <LanguageSettingsContent />}
            {tab === 'brand' && <BrandSettingsContent />}
            {tab === 'pano' && <PanoSettingsContent />}
          </div>
        </div>

    </ModalShell>
  )
}
