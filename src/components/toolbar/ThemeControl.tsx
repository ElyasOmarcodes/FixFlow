import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { applySystemBars } from '@/native/systemUi'
import { haptic } from '@/native/haptics'

type Theme = 'light' | 'dark' | 'system'
export function ThemeControl() {
  const t = useT()
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('pixeldeck.theme')
      return saved === 'dark' || saved === 'light' ? saved : 'system'
    } catch { return 'system' }
  })
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
      // Repaint the phone's own status bar to match. Read from the computed
      // token rather than a second copy of the hex, so the bar can never
      // drift from the panel it sits above.
      const panel = getComputedStyle(document.documentElement).getPropertyValue('--pd-panel').trim()
      applySystemBars(resolved, panel || (resolved === 'dark' ? '#18181f' : '#ffffff'))
    }
    apply()
    try { localStorage.setItem('pixeldeck.theme', theme) } catch { /* Session-only preference. */ }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return <select className="pd-theme-control" aria-label={t('workspace.theme')} value={theme} onChange={(event) => { haptic('select'); setTheme(event.target.value as Theme) }}>
    <option value="system">{t('workspace.system')}</option>
    <option value="light">{t('phone.themeLight')}</option>
    <option value="dark">{t('phone.themeDark')}</option>
  </select>
}
