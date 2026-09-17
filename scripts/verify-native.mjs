import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * The behaviours that decide whether this reads as an app or as a web page.
 *
 * Android's Back is driven through the same stack the native listener uses,
 * so a browser can exercise it: the point under test is the unwind order, not
 * the plugin. The web-gesture suppression is checked the same way — by asking
 * whether the event was cancelled, which is what the WebView acts on.
 */

// The dev server, not `preview`: the back stack is exercised by importing the
// module the app itself uses, which means source paths have to resolve.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4185'], { stdio: 'ignore' })
let browser
await mkdir('test-results/native', { recursive: true })
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    // Loopback-only readiness probe for our local test server; no credentials or user data.
    // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
    try { if ((await fetch('http://127.0.0.1:4185')).ok) break } catch { /* Wait for Vite. */ }
    await delay(200)
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    try { window.localStorage.setItem('pixeldeck:start-screen', 'off') } catch { /* private window */ }
  })
  await page.goto('http://127.0.0.1:4185')
  await expect(page.locator('.pd-editor canvas').first()).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1200)

  // Open a panel, then a dialog from inside it: Back must take the dialog
  // first and leave the panel standing. Guessing from the DOM used to take
  // the panel and leave the dialog floating over nothing.
  await page.locator('.pd-mobile-nav button').first().click()
  await expect(page.locator('#mobile-layers')).toBeVisible()
  await page.getByRole('button', { name: 'New layer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Icon', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose an icon' })
  await expect(picker).toBeVisible()

  const back = () => page.evaluate(async () => {
    const { handleBack } = await import('/src/native/backStack.ts')
    return handleBack()
  })

  expect(await back()).toBe(true)
  await expect(picker).toHaveCount(0)
  await expect(page.locator('#mobile-layers')).toBeVisible()
  console.log('PASS back: closes the dialog, not the panel under it')

  expect(await back()).toBe(true)
  await expect(page.locator('#mobile-layers')).toBeHidden()
  console.log('PASS back: then closes the panel')

  // Nothing left — the shell is told so, rather than a surface being invented.
  expect(await back()).toBe(false)
  console.log('PASS back: reports an empty stack at the root')

  // A long-press on the chrome must not raise the WebView's own menu, and a
  // stray file drop must not navigate the editor away.
  const cancelled = await page.evaluate(() => {
    const onChrome = document.querySelector('.pd-mobile-nav button')
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    onChrome.dispatchEvent(menu)
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(drop)
    return { menu: menu.defaultPrevented, drop: drop.defaultPrevented }
  })
  expect(cancelled.menu).toBe(true)
  expect(cancelled.drop).toBe(true)
  console.log('PASS gestures: context menu and stray file drop are swallowed')

  // Typing must not leave the page zoomed at a scale the app cannot undo.
  const fontSize = await page.evaluate(() => {
    const input = document.createElement('input')
    document.body.append(input)
    const size = Number.parseFloat(getComputedStyle(input).fontSize)
    input.remove()
    return size
  })
  expect(fontSize).toBeGreaterThanOrEqual(16)
  console.log(`PASS keyboard: touch inputs are ${fontSize}px, so focusing one cannot zoom the viewport`)

  await page.screenshot({ path: 'test-results/native/editor.png' })
  expect(errors).toEqual([])
} finally {
  await browser?.close()
  server.kill()
}
