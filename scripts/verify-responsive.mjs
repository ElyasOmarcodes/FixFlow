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
    try { if ((await fetch('http://127.0.0.1:4173')).ok) break } catch { /* Wait for Vite. */ }
    await delay(200)
  }
  browser = await chromium.launch()
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1024 })
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
      await page.locator('#mobile-layers .pd-panel-close').click()
      await expect(page.locator('#mobile-layers')).toBeHidden()
      await page.locator('.pd-mobile-nav button').last().click()
      await expect(page.locator('#mobile-properties')).toBeVisible()
      await page.locator('#mobile-properties .pd-panel-close').click()
    }
    await page.screenshot({ path: `test-results/responsive/${width}x${height}.png` })
    await page.locator('.pd-slides').getByRole('button', { name: 'Export', exact: true }).click()
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
