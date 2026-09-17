import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * The launch screen, at the three widths that actually differ: a small phone,
 * a tablet, and a desktop. What matters is that it appears on a first launch,
 * that every route out of it works, and that dismissing it leaves a live
 * editor behind — the whole point of layering it over the stage rather than
 * swapping the stage out.
 */

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174'], { stdio: 'ignore' })
let browser
await mkdir('test-results/start', { recursive: true })
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    // Loopback-only readiness probe for our local test server; no credentials or user data.
    // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    try { if ((await fetch('http://127.0.0.1:4174')).ok) break } catch { /* Wait for Vite. */ }
    await delay(200)
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1024 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    // Sampled from navigation so the handoff can be asserted, not assumed.
    const launchOrder = []
    const sample = setInterval(() => {
      page.evaluate(() => {
        const splash = document.querySelector('[class*="pd-z-splash"]')
        const splashUp = splash ? getComputedStyle(splash).opacity !== '0' : false
        const startUp = !!document.querySelector('.pd-start')
        if (splashUp) return 'splash'
        if (startUp) return 'start'
        // Before the bundle runs there is nothing at all, which is not the
        // editor showing through — only a live canvas with neither the splash
        // nor the start screen over it counts as the flash being tested for.
        return document.querySelector('.pd-editor canvas') ? 'editor-only' : 'blank'
      }).then((step) => launchOrder.push(step)).catch(() => {})
    }, 60)
    await page.goto('http://127.0.0.1:4174')

    const start = page.getByRole('dialog', { name: 'FixFlow', exact: true })
    await expect(start).toBeVisible({ timeout: 15000 })

    // Launch order is splash → projects page, with no editor in between. The
    // start screen is a lazy chunk, so it is preloaded *under* the splash;
    // without that the splash lifts onto a bare editor for a frame or two.
    expect(launchOrder.filter((step, i) => step !== launchOrder[i - 1])).not.toContain('editor-only')

    // Nothing may run off the side, at any width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const box = await start.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1)

    await expect(page.getByRole('button', { name: 'New project' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent projects' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Start from a template' })).toBeVisible()
    // The gallery is fetched, so templates arriving at all is the assertion.
    await expect(page.locator('.pd-start-template').first()).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: `test-results/start/start-${width}x${height}.png`, fullPage: true })

    // The editor underneath stays mounted while the screen is up — that is why
    // dismissing it is instant instead of rebuilding the Konva stage.
    expect(await page.locator('.pd-editor canvas').count()).toBeGreaterThan(0)

    // Escape dismisses.
    await page.keyboard.press('Escape')
    await expect(start).toBeHidden()
    await expect(page.locator('.pd-editor canvas').first()).toBeVisible()

    // And the canvas is live, not a leftover painting: insert a layer.
    if (width < 1024) await page.locator('.pd-mobile-nav button').first().click()
    await page.getByRole('button', { name: 'New layer', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Shape', exact: true }).click()
    await expect(page.locator('.pd-layer-panel')).toContainText('Shape')

    // Reopening from the toolbar, then leaving by the dismiss button.
    if (width >= 1024) {
      await page.getByRole('button', { name: 'Home', exact: true }).click()
      await expect(start).toBeVisible()
      await page.locator('.pd-start-dismiss').click()
      await expect(start).toBeHidden()
    }

    clearInterval(sample)
    expect(errors).toEqual([])
    console.log(`PASS ${width}x${height}: splash→start order, dismissal, live editor`)
    await context.close()
  }

  // A returning user who turned the screen off never sees it again.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    try { window.localStorage.setItem('pixeldeck:start-screen', 'off') } catch { /* private window */ }
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4174')
  await expect(page.locator('.pd-editor canvas').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)
  await expect(page.getByRole('dialog', { name: 'FixFlow', exact: true })).toHaveCount(0)
  console.log('PASS preference off: launches straight into the editor')
  await context.close()
} finally {
  await browser?.close()
  server.kill()
}
