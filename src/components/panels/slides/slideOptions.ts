import type { TranslationKey } from '@/i18n'

/** How many store slides one canvas spans. A panorama is 2 or 3. */
export const NUM_SLIDES_OPTIONS: { value: number; labelKey: TranslationKey; suffix?: string }[] = [
  { value: 1, labelKey: 'slides.single' },
  { value: 2, labelKey: 'slides.title', suffix: '×2' },
  { value: 3, labelKey: 'slides.title', suffix: '×3' },
]
