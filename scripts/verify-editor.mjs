import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'], { stdio: 'ignore' })
for (let i = 0; i < 50; i++) {
  // Loopback-only readiness probe for our local test server; no credentials or user data.
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  try { if ((await fetch('http://127.0.0.1:5173')).ok) break } catch { /* Start server. */ }
  await delay(200)
}
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
await mkdir('test-results/editor', { recursive: true })
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 1024 })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(process.env.PIXELDECK_TEST_URL || 'http://127.0.0.1:5173')
    await page.waitForTimeout(3500)
    if (width < 1024) await page.locator('.pd-mobile-nav button').first().click()
    await page.getByRole('button', { name: 'New layer', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Text', exact: true }).click()
    const editor = page.locator('[contenteditable=true]').filter({ visible: true }).first()
    await expect(editor).toBeVisible()
    await editor.fill('سلام نړۍ — PixelDeck 2026')
    await expect(editor).toHaveAttribute('dir', 'rtl')
    if (width < 1024) {
      await expect(page.getByRole('dialog', { name: 'Edit text' })).toBeVisible()
      await page.screenshot({ path: `test-results/editor/text-${width}.png` })
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await expect(page.locator('.pd-mobile-text-editor')).toHaveCount(0)
      await page.getByRole('button', { name: 'New layer', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Text', exact: true }).click()
      await expect(page.locator('.pd-mobile-text-editor')).toBeVisible()
      // Android Back dispatches Escape on window, rather than the focused editor.
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
      await expect(page.locator('.pd-mobile-text-editor')).toHaveCount(0)
    } else { await editor.press('Escape') }
    await expect(page.locator('.pd-editor canvas').first()).toBeVisible()
    // Exercise grouping through touch-accessible controls, without store shortcuts.
    await page.getByRole('button', { name: 'New layer', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Shape', exact: true }).click()
    await page.locator('.pd-layer-selection').getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByRole('button', { name: 'Select all', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Group selected layers', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Group selected layers', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ungroup', exact: true })).toBeEnabled()
    await page.locator('.pd-layer-list').getByRole('button', { name: 'Rename', exact: true }).first().click()
    const rename = page.locator('.pd-layer-list input').first()
    await rename.fill('Collection')
    await rename.press('Enter')
    const child = page.locator('.pd-layer-list [class~="group/child"]').filter({ hasText: 'Text' }).first()
    await child.getByRole('button', { name: 'Edit', exact: true }).click()
    const childEditor = page.locator('[contenteditable=true]').filter({ visible: true }).first()
    await childEditor.fill('متن داخل گروه')
    if (width < 1024) await page.getByRole('button', { name: 'Done', exact: true }).click()
    else await childEditor.press('Escape')
    await page.locator('.pd-layer-list').getByText('Collection', { exact: true }).click()
    if (width < 1024) {
      await expect(page.locator('.pd-mobile-header')).toBeHidden()
      await expect(page.locator('.pd-slides')).toBeHidden()
    }
    await page.screenshot({ path: `test-results/editor/layers-${width}.png` })
    await page.getByRole('button', { name: 'Ungroup', exact: true }).click()
    await page.locator('.pd-layer-list').getByText('Text', { exact: true }).last().click()
    // Real UI operations: duplicate, delete and undo.
    await page.locator('.pd-layer-footer').getByRole('button', { name: 'Duplicate', exact: true }).click()
    await page.locator('.pd-layer-footer').getByRole('button', { name: 'Delete', exact: true }).click()
    if (width < 1024) { await page.locator('#mobile-layers .pd-panel-close').click(); await page.locator('.pd-mobile-header').getByRole('button', { name: 'Undo', exact: true }).click() }
    else await page.getByTitle('Undo (Ctrl+Z)').click()
    await page.screenshot({ path: `test-results/editor/workspace-${width}-system.png` })
    if (width < 1024) {
      await page.getByRole('button', { name: 'More tools', exact: true }).click()
    }
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    if (width < 1024) await page.locator('.pd-mobile-nav button').first().click()
    await page.locator('.pd-layer-list').getByText('Text', { exact: true }).last().click()
    if (width < 1024) await page.locator('.pd-mobile-nav button').last().click()
    await page.screenshot({ path: `test-results/editor/workspace-${width}-light.png` })
    if (width < 1024) await page.locator('#mobile-properties .pd-panel-close').click()
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.screenshot({ path: `test-results/editor/workspace-${width}-dark.png` })
    const settingsButton = width < 1024 ? page.locator('.pd-mobile-header').getByRole('button', { name: 'Settings', exact: true }) : page.getByTitle('Open settings', { exact: true })
    await settingsButton.click()
    await expect(page.locator('.pd-settings')).toBeVisible()
    for (const tab of ['AI', 'Language', 'Brand', 'Pano']) {
      await page.locator('.pd-settings-tabs').getByRole('button', { name: tab, exact: true }).click()
      const dimensions = await page.locator('.pd-settings-content').evaluate((node) => ({ width: node.clientWidth, scroll: node.scrollWidth }))
      expect(dimensions.width).toBeGreaterThan(width < 1024 ? width - 5 : 400)
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 2)
    }
    await page.screenshot({ path: `test-results/editor/settings-${width}.png` })
    await page.locator('.pd-settings').getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByTitle('Help & keyboard shortcuts').click()
    await expect(page.getByRole('dialog', { name: 'PixelDeck user guide' })).toBeVisible()
    await page.screenshot({ path: `test-results/editor/guide-${width}.png` })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    for (const [lang, title, aiTitle] of [
      ['ps', 'د PixelDeck لارښود', 'Gemini او د AI کارول'],
      ['fa', 'راهنمای PixelDeck', 'Gemini و استفاده از AI'],
    ]) {
      await page.evaluate((language) => localStorage.setItem('pixeldeck.ui-language', language), lang)
      await page.reload()
      await page.waitForTimeout(1800)
      if (width < 1024) {
        await page.locator('.pd-mobile-header').getByRole('button', { name: 'تنظیمات', exact: true }).click()
        await page.locator('.pd-settings-tabs').getByRole('button', { name: 'پانو', exact: true }).click()
        const content = page.locator('.pd-settings-content')
        await expect(content.getByRole('heading')).toHaveText(lang === 'ps' ? 'د پانوراما تنظیمات' : 'تنظیمات پانوراما')
        expect(await content.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2)
        await page.screenshot({ path: `test-results/editor/settings-${lang}-${width}.png` })
        await page.keyboard.press('Escape')
        await page.locator('.pd-mobile-header button').last().click()
      }
      await page.locator('.pd-toolbar').getByTitle(lang === 'ps' ? 'مرسته او د کیبورډ لنډ لارې' : 'راهنما و کلیدهای میان‌بر').click()
      await expect(page.getByRole('dialog', { name: title })).toBeVisible()
      if (width < 1024) await page.getByRole('dialog').locator('select').selectOption('ai-features')
      else await page.getByRole('dialog').getByRole('button', { name: new RegExp(aiTitle) }).click()
      await expect(page.getByRole('heading', { name: aiTitle })).toBeVisible()
      await page.screenshot({ path: `test-results/editor/guide-${lang}-${width}.png` })
      await page.keyboard.press('Escape')
    }
    if (width === 1440) {
      await page.evaluate(() => localStorage.setItem('pixeldeck.ui-language', 'en'))
      await page.reload()
      for (const slug of ['noor-editorial', 'orbit-studio', 'serein-wellness']) {
        await page.evaluate(async (name) => {
          const { useEditorStore } = await import('/src/store/index.ts')
          const template = await (await fetch(`/templates/${name}.template.json`)).json()
          useEditorStore.getState().importTemplateAsNewProject(template)
        }, slug)
        await page.waitForTimeout(1200)
        for (let index = 0; index < 7; index++) {
          await page.evaluate(async (i) => {
            const { useEditorStore } = await import('/src/store/index.ts')
            const state = useEditorStore.getState()
            state.setActiveSlideGroup(state.project.slideGroups[i].id)
          }, index)
          await page.waitForTimeout(350)
          await page.screenshot({ path: `test-results/editor/${slug}-${index + 1}.png` })
        }
      }
    }
    expect(errors).toEqual([])
    console.log(`PASS ${width}: type RTL text, duplicate/delete/undo, themes, guide`)
    await page.close()
  }
} finally { await browser.close(); server.kill() }
