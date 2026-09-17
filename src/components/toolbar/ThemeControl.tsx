import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from '@/utils/theme'

/**
 * Picks the theme. It does not *own* it — see src/utils/theme.ts. This
 * component is only rendered in the desktop toolbar and the mobile sheet, so
 * anything it owned would not exist until one of those was on screen.
 */
export function ThemeControl() {
  const t = useT()
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference)

  useEffect(() => {
    saveThemePreference(theme)
    applyTheme(theme)
  }, [theme])

  return <select className="pd-theme-control" aria-label={t('workspace.theme')} value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
    <option value="system">{t('workspace.system')}</option>
    <option value="light">{t('phone.themeLight')}</option>
    <option value="dark">{t('phone.themeDark')}</option>
  </select>
}
