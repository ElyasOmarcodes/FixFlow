import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import JSZip from 'jszip'

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' })
let browser
await mkdir('test-results/responsive', { recursive: true })
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    // Loopback-only readiness probe for our local test server; no credentials or user data.
    // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    try { if ((await fetch('http://127.0.0.1:4173')).ok) break } catch { /* Wait for Vite. */ }
    await delay(200)
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1024 })
    // These runs exercise the editor, so skip the launch screen the way a
    // returning user would — it is verified on its own in verify-start.mjs.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pixeldeck:start-screen', 'off') } catch { /* private window */ }
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:4173')
    await page.waitForTimeout(3500)
    const canvas = page.locator('.pd-editor canvas').first()
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box.width).toBeGreaterThan(width < 1024 ? width - 20 : 200)
    expect(box.height).toBeGreaterThan(40)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (width < 1024) {
      await page.locator('.pd-mobile-nav button').first().click()
      await expect(page.locator('#mobile-layers')).toBeVisible()
      await expect(page.locator('.pd-slides')).toBeHidden()
      await page.getByRole('button', { name: 'New layer', exact: true }).click()
      const insert = page.getByRole('menu', { name: 'New layer', exact: true })
      await expect(insert).toBeVisible()
      const insertBox = await insert.boundingBox()
      expect(insertBox.y).toBeGreaterThanOrEqual(0)
      await page.getByRole('menuitem', { name: 'Shape', exact: true }).click()
      await expect(insert).toHaveCount(0)
      await page.locator('#mobile-layers .pd-panel-close').click()
      await expect(page.locator('#mobile-layers')).toBeHidden()
      // By what it controls, not by its position in the bar: the bar has since
      // grown a fourth item, and `last()` silently became the assistant.
      await page.locator('.pd-mobile-nav button[aria-controls="mobile-properties"]').click()
      await expect(page.locator('#mobile-properties')).toBeVisible()
      await page.locator('#mobile-properties .pd-panel-close').click()
    }
    // ── Slide options ─────────────────────────────────────────────────────
    // On a desktop these are a labelled column; on a phone they are the first
    // card in the slide strip. Either way the surface they open has to fit and
    // has to close — the old compact form was a floating panel over the canvas
    // that answered neither Escape nor a press outside it.
    if (width < 1024) {
      const optionsCard = page.locator('.pd-slide-options-card')
      await expect(optionsCard).toHaveCount(1)
      const strip = await page.locator('.pd-slide-thumbnails').boundingBox()
      const cardBox = await optionsCard.boundingBox()
      // It rides inside the strip, like the slide cards beside it.
      expect(cardBox.y).toBeGreaterThanOrEqual(strip.y - 2)
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(strip.y + strip.height + 2)

      await optionsCard.click()
      const popover = page.locator('.pd-slide-options-popover')
      await expect(popover).toBeVisible()
      const popBox = await popover.boundingBox()
      expect(popBox.x).toBeGreaterThanOrEqual(0)
      expect(popBox.y).toBeGreaterThanOrEqual(0)
      expect(popBox.x + popBox.width).toBeLessThanOrEqual(width + 1)
      expect(popBox.y + popBox.height).toBeLessThanOrEqual(height + 1)
      await page.keyboard.press('Escape')
      await expect(popover).toHaveCount(0)
      await optionsCard.click()
      await expect(popover).toBeVisible()
      await page.mouse.click(Math.round(width / 2), 120)
      await expect(popover).toHaveCount(0)
    } else {
      await expect(page.locator('.pd-slide-options')).toHaveCount(1)
      await expect(page.locator('.pd-slide-options-card')).toHaveCount(0)
    }

    // ── Canvas-format menu ────────────────────────────────────────────────
    // It lists every preset family, so its natural height is ~1000px. It must
    // be clamped to the viewport and scroll, not run off the bottom — when the
    // clamp was invalid CSS the last entries, including "Custom size…" and the
    // whole custom-size dialog behind it, were simply unreachable (the body
    // does not scroll).
    await page.getByTitle('Add a canvas format').click()
    const formatMenu = page.locator('[aria-label="Create new layout"]').locator('..')
    await expect(formatMenu).toBeVisible()
    const menuMetrics = await formatMenu.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return {
        top: rect.top,
        bottom: rect.bottom,
        right: rect.right,
        left: rect.left,
        scrollable: node.scrollHeight > node.clientHeight + 1,
      }
    })
    expect(menuMetrics.top).toBeGreaterThanOrEqual(0)
    expect(menuMetrics.bottom).toBeLessThanOrEqual(height + 1)
    expect(menuMetrics.left).toBeGreaterThanOrEqual(0)
    expect(menuMetrics.right).toBeLessThanOrEqual(width + 1)
    expect(menuMetrics.scrollable).toBe(true)
    // The last item is reachable by scrolling the menu itself.
    const customSize = page.getByRole('button', { name: 'Custom size…', exact: true })
    await customSize.scrollIntoViewIfNeeded()
    await customSize.click()
    const dpi = page.getByLabel('DPI')
    await expect(dpi).toBeVisible()
    const dpiBox = await dpi.boundingBox()
    expect(dpiBox.y).toBeGreaterThanOrEqual(0)
    expect(dpiBox.y + dpiBox.height).toBeLessThanOrEqual(height + 1)
    expect(dpiBox.x + dpiBox.width).toBeLessThanOrEqual(width + 1)
    await page.screenshot({ path: `test-results/responsive/format-menu-${width}x${height}.png` })
    // Escape must shut it — every other dismissible surface in the editor
    // answers Escape, and these menus used to ignore it entirely.
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('DPI')).toHaveCount(0)
    // And so must a press outside it.
    await page.getByTitle('Add a canvas format').click()
    await expect(formatMenu).toBeVisible()
    await page.mouse.click(width - 6, height - 6)
    await expect(formatMenu).toHaveCount(0)

    await page.screenshot({ path: `test-results/responsive/${width}x${height}.png` })
    await page.locator(width < 1024 ? '.pd-mobile-header' : '.pd-toolbar').getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width + 1)
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(height + 1)
    await page.screenshot({ path: `test-results/responsive/export-${width}x${height}.png` })
    if (width === 390) {
      const downloadPromise = page.waitForEvent('download', { timeout: 90000 })
      await page.getByRole('button', { name: 'Export PNGs', exact: true }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.zip$/)
      const zip = await JSZip.loadAsync(await readFile(await download.path()))
      const pngs = Object.values(zip.files).filter((file) => file.name.endsWith('.png'))
      expect(pngs.length).toBeGreaterThan(0)
      expect(Array.from((await pngs[0].async('uint8array')).slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    }
    expect(errors).toEqual([])
    console.log(`PASS ${width}x${height}: canvas, panels, viewport and export dialog`)
    await page.close()
  }
} finally {
  await browser?.close()
  server.kill()
}
