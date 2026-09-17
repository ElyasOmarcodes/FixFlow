import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

/**
 * The icon catalogue, end to end.
 *
 * What this is guarding: the picker used to show 120 of 4,403 symbols because
 * every visible cell was its own request to Google. It now draws the whole
 * catalogue from one font and virtualises the grid. Two things can silently
 * undo that — a cap creeping back in, and the grid quietly mounting all 4,403
 * cells — and neither shows up in a unit test, so they are asserted here
 * against a real browser.
 *
 * Deliberately network-agnostic: a runner that cannot reach fonts.googleapis
 * .com must still pass, because the picker is required to degrade to the
 * image previews rather than to break.
 */

const OUT = 'test-results/icons'
const PORT = 5179

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' })
for (let i = 0; i < 60; i++) {
  // Loopback-only readiness probe for our local test server; no credentials or user data.
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  try { if ((await fetch(`http://127.0.0.1:${PORT}`)).ok) break } catch { /* Start server. */ }
  await delay(200)
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
await mkdir(OUT, { recursive: true })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    try { window.localStorage.setItem('pixeldeck:start-screen', 'off') } catch { /* private window */ }
  })
  await page.goto(process.env.PIXELDECK_TEST_URL || `http://127.0.0.1:${PORT}`)
  await page.waitForTimeout(3500)

  // Adding an icon layer opens the picker on the bundled library.
  await page.getByRole('button', { name: 'New layer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Icon', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Choose an icon' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/library.png` })

  await page.getByRole('tab', { name: 'Google icons' }).click()
  // Long enough for the font to arrive on a slow link. It is not a deadline:
  // whatever has not arrived falls back to the images, which is a state this
  // script is equally willing to pass.
  await page.waitForTimeout(9000)
  await page.screenshot({ path: `${OUT}/online-top.png` })

  // The whole catalogue is offered, not a page of it.
  const count = await page.locator('.pd-icon-count').first().textContent()
  expect(count).toMatch(/\b4[0-9]{3} icons\b/)

  const grid = page.locator('.pd-vgrid').first()
  const mounted = await page.locator('.pd-vgrid-cell').count()
  // Virtualised: a screenful and some overscan, nowhere near the full list.
  expect(mounted).toBeGreaterThan(20)
  expect(mounted).toBeLessThan(300)

  // Every mounted cell draws something. Which something depends on what the
  // runner can reach — the font, the image endpoint, or neither — and all
  // three are acceptable; a cell with nothing in it is not.
  const glyphs = await page.locator('.pd-symbol-glyph').count()
  const images = await page.locator('.pd-symbol-img').count()
  const drawn = await page.locator('.pd-vgrid-cell .pd-icon-cell > :first-child').count()
  expect(drawn).toBe(mounted)

  // The end of the catalogue is reachable by scrolling, and still virtualised.
  await grid.evaluate((el) => { el.scrollTop = el.scrollHeight - el.clientHeight })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/online-bottom.png` })
  await expect(page.locator('.pd-icon-cell', { hasText: 'zoom out map' })).toBeVisible()
  expect(await page.locator('.pd-vgrid-cell').count()).toBeLessThan(300)

  // A name the font has no ligature for must never be spelled out across its
  // neighbours — that is what the measurement fallback is for.
  const widest = await page.locator('.pd-symbol-glyph').evaluateAll(
    (nodes) => Math.max(0, ...nodes.map((node) => node.getBoundingClientRect().width)),
  )
  expect(widest).toBeLessThan(60)
  // The offline path must be the exception, not the shape of the feature: if
  // the runner reached Google at all, most cells are real glyphs or images.
  if (glyphs > 0) expect(glyphs).toBeGreaterThan(mounted / 2)

  // All three shapes are live.
  for (const style of ['Rounded', 'Sharp', 'Outlined']) {
    await page.getByRole('button', { name: style, exact: true }).click()
    await page.waitForTimeout(1500)
    expect(await page.locator('.pd-vgrid-cell').count()).toBeGreaterThan(20)
  }
  await page.screenshot({ path: `${OUT}/online-rounded.png` })
  await page.keyboard.press('Escape')

  // A chip can take an online glyph too, not only a bundled one.
  await page.getByRole('button', { name: 'New layer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Chip', exact: true }).click()
  await page.getByRole('button', { name: /No icon/i }).first().click()
  await expect(page.getByRole('tab', { name: 'Google icons' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/chip-picker.png` })
  await page.keyboard.press('Escape')

  // The translate-everything action is reachable from the toolbar.
  await page.getByRole('button', { name: /Translate everything/i }).first().click()
  await expect(page.getByRole('dialog', { name: 'Translate the design' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/translate-all.png` })

  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`)
  console.log(`✓ icons: ${count.trim()}, ${mounted} cells mounted, ${glyphs} glyph / ${images} image previews`)
} finally {
  await browser.close()
  server.kill()
}
