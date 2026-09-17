import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * Render every slide of every bundled template and save it as a PNG.
 *
 * A template is a design, and a design is judged by looking at it — numbers in
 * a JSON file do not show a headline colliding with a device or a caption
 * running off the canvas. This opens each template through the normal "start
 * from a template" path, then exports the whole listing exactly as a user
 * would, so what lands in test-results/templates is what a store would get.
 */

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175'], { stdio: 'ignore' })
let browser
const only = process.argv.slice(2)
await mkdir('test-results/templates', { recursive: true })
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    // Loopback-only readiness probe for our local test server; no credentials or user data.
    // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    try { if ((await fetch('http://127.0.0.1:4175')).ok) break } catch { /* Wait for Vite. */ }
    await delay(200)
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  const index = await (await fetch('http://127.0.0.1:4175/templates/index.json')).json()
  const entries = index.templates.filter((entry) => only.length === 0 || only.includes(entry.slug))

  for (const entry of entries) {
    // A fresh context per template: each one lands as its own project, and a
    // shared library would make the recent list grow between runs.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:4175')

    await expect(page.getByRole('dialog', { name: 'FixFlow', exact: true })).toBeVisible({ timeout: 15000 })
    await page.locator('.pd-start-template', { hasText: entry.name }).first().click()
    await expect(page.getByRole('dialog', { name: 'FixFlow', exact: true })).toBeHidden({ timeout: 20000 })
    await page.waitForTimeout(2500)

    // Walk the slide strip, screenshotting the canvas for each slide group.
    // A pano group shows twice in the strip and renders as one wide canvas, so
    // only the first thumbnail of each group is worth visiting.
    const cards = page.locator('.pd-slide-thumbnails [data-slide-group]')
    const ids = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.slideGroup))
    const seen = new Set()
    expect(ids.length).toBeGreaterThan(0)
    let shot = 0
    for (let i = 0; i < ids.length; i++) {
      if (seen.has(ids[i])) continue
      seen.add(ids[i])
      await cards.nth(i).click()
      await page.waitForTimeout(1400)
      shot += 1
      await page.locator('.pd-editor main').screenshot({
        path: `test-results/templates/${entry.slug}-${String(shot).padStart(2, '0')}.png`,
      })
    }

    expect(errors).toEqual([])
    console.log(`PASS ${entry.slug}: ${shot} slide groups rendered`)
    await context.close()
  }
} finally {
  await browser?.close()
  server.kill()
}
