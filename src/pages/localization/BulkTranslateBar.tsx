import type { RefObject } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'

export interface BulkTranslateBarProps {
  nonDefaultLocales: string[]
  bulkEligibleCount: number
  hasApiKey: boolean
  isBulkRunning: boolean
  overwriteExisting: boolean
  setOverwriteExisting: (value: boolean) => void
  onBulkTranslate: () => void
  bulkCancelRef: RefObject<boolean>
  onOpenAiSettings: () => void
}

export function BulkTranslateBar({
  nonDefaultLocales,
  bulkEligibleCount,
  hasApiKey,
  isBulkRunning,
  overwriteExisting,
  setOverwriteExisting,
  onBulkTranslate,
  bulkCancelRef,
  onOpenAiSettings,
}: BulkTranslateBarProps) {
  const t = useT()
  if (nonDefaultLocales.length === 0) return null

  return (
    <section className="border-b border-[var(--pd-line-subtle)] bg-[var(--pd-c-111118)]/70 px-8 py-3 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--pd-c-6b6b7a)]">Bulk AI translate:</span>
          <span className="text-xs text-[var(--pd-c-9b8fff)]">{bulkEligibleCount} cells</span>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            className="accent-[var(--pd-c-7c6ef6)] w-3 h-3"
          />
          <span className="text-xs text-[#8f90a3]">Overwrite existing</span>
        </label>

        <button
          type="button"
          onClick={onBulkTranslate}
          disabled={!hasApiKey || isBulkRunning || bulkEligibleCount === 0}
          className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition ${
            !hasApiKey
              ? 'border-[var(--pd-line-soft)] text-[var(--pd-c-4a4a5a)] cursor-not-allowed'
              : isBulkRunning
                ? 'border-[var(--pd-accent-soft)] text-[var(--pd-c-9b8fff)] cursor-wait'
                : bulkEligibleCount === 0
                  ? 'border-[var(--pd-line-soft)] text-[var(--pd-c-4a4a5a)] cursor-not-allowed'
                  : 'border-[var(--pd-accent-soft)] bg-[var(--pd-accent-wash)] text-[#c5befd] hover:bg-[rgba(124,110,246,0.22)] hover:text-[var(--pd-c-f0eff8)]'
          }`}
          title={!hasApiKey ? 'Configure an AI API key in AI Settings' : undefined}
        >
          <span className="flex items-center gap-1.5">
            <Icon name={isBulkRunning ? 'spinner' : 'sparkles'} size={12} />
            {isBulkRunning
              ? t('loc.translating')
              : `${t('loc.translateAll')} (${nonDefaultLocales.length})`}
          </span>
        </button>

        {!hasApiKey && (
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="text-xs text-[var(--pd-warn-strong)] hover:text-[var(--pd-c-f0eff8)] underline underline-offset-2 transition"
          >
            No API key — open AI Settings
          </button>
        )}

        {isBulkRunning && (
          <button
            type="button"
            onClick={() => { bulkCancelRef.current = true }}
            className="text-xs text-[var(--pd-danger)] hover:text-[var(--pd-c-f0eff8)] transition"
          >
            Stop
          </button>
        )}
      </div>
    </section>
  )
}
