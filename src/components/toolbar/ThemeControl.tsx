import { useEffect, useState } from 'react'
import { useT } from '@/i18n'

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
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.style.colorScheme = document.documentElement.dataset.theme
    }
    apply()
    try { localStorage.setItem('pixeldeck.theme', theme) } catch { /* Session-only preference. */ }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return <select className="pd-theme-control" aria-label={t('workspace.theme')} value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
    <option value="system">{t('workspace.system')}</option>
    <option value="light">{t('phone.themeLight')}</option>
    <option value="dark">{t('phone.themeDark')}</option>
  </select>
}
