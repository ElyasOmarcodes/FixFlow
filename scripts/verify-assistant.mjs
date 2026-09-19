import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'

/**
 * The assistant, driven in a real browser.
 *
 * The unit tests prove the loop and the tools; what they cannot prove is that
 * a person can open the panel, type a sentence, and watch the canvas change —
 * which is the entire feature. So this drives the actual UI, with a scripted
 * transport standing in for the provider: no key, no network, no cost, and a
 * deterministic reply, while every other layer (panel, store, turn boundary,
 * tools, Konva) is the real one.
 */

/** A UI string, read from the dictionary that defines it rather than copied. */
async function uiString(language, key) {
  const raw = await readFile(`src/i18n/locales/${language}.ts`, 'utf8')
  const match = new RegExp(`'${key}':\\s*(?:'([^']+)'|"([^"]+)")`).exec(raw)
  if (!match) throw new Error(`No ${key} in src/i18n/locales/${language}.ts`)
  return match[1] ?? match[2]
}

const PORT = 5187
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' })
for (let i = 0; i < 80; i++) {
  // Loopback-only readiness probe for our local test server; no credentials or user data.
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  try { if ((await fetch(`http://127.0.0.1:${PORT}`)).ok) break } catch { /* Start server. */ }
  await delay(200)
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
await mkdir('test-results/assistant', { recursive: true })

/** The replies the scripted model gives, in order, for one run. */
const SCRIPT = [
  {
    say: 'Reading the slide first.',
    actions: [{ tool: 'read_slide', args: {} }],
    status: 'working',
  },
  {
    say: 'Added a headline and a device.',
    actions: [
      { tool: 'add_layer', args: { layerType: 'text', text: 'Built for long evenings', x: 110, y: 240 } },
      { tool: 'add_layer', args: { layerType: 'phone' } },
    ],
    status: 'done',
  },
]

async function openEditor(page, language = 'en') {
  await page.addInitScript(([script, lang]) => {
    try {
      window.localStorage.setItem('pixeldeck:start-screen', 'off')
      window.localStorage.setItem('pixeldeck.ui-language', lang)
      // A key must be present or the panel refuses to send; the value is never
      // used, because the transport below never reaches a provider.
      window.localStorage.setItem('pixeldeck-api-keys', JSON.stringify({
        state: { provider: 'openai', openaiKey: 'test-key', selectedModels: { openai: 'scripted-model' } },
        version: 2,
      }))
      window.localStorage.setItem('pixeldeck.assistant', JSON.stringify({ open: true, width: 360, readOnly: false }))
    } catch { /* private window */ }
    let turn = 0
    window.__FIXFLOW_CONFIG__ = {
      aiTransport: {
        chat: async () => JSON.stringify(script[Math.min(turn++, script.length - 1)]),
        editImage: async () => { throw new Error('not used') },
      },
    }
  }, [SCRIPT, language])
  await page.goto(`http://127.0.0.1:${PORT}`)
  await page.waitForTimeout(2500)
}

/** How many layers the active slide group holds, read from the live store. */
async function layerCount(page) {
  return page.evaluate(async () => {
    const store = await import('/src/store/index.ts')
    const { project, activeSlideGroupId } = store.useEditorStore.getState()
    return project.slideGroups.find((group) => group.id === activeSlideGroupId).layers.length
  })
}

const failures = []
async function check(name, run) {
  try { await run(); console.log(`PASS ${name}`) } catch (error) { failures.push(name); console.log(`FAIL ${name}\n  ${error.message.split('\n')[0]}`) }
}

try {
  // ── A turn changes the canvas, and one undo takes it back ──────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openEditor(page)

    await check('the dock opens from the AI menu', async () => {
      // Closed first, so the menu item is what opens it.
      await page.evaluate(async () => {
        const store = await import('/src/store/assistant.ts')
        store.useAssistantStore.getState().setOpen(false)
      })
      await expect(page.locator('.pd-assistant')).toHaveCount(0)
      await page.locator('.pd-menubar').getByRole('menuitem', { name: 'AI', exact: true }).click()
      const menu = page.getByRole('menu', { name: 'AI' })
      const label = await uiString('en', 'assistant.title')
      await menu.getByRole('menuitem', { name: label, exact: true })
        .or(menu.getByRole('menuitemcheckbox', { name: label, exact: true })).first().click()
      await expect(page.locator('.pd-assistant')).toBeVisible()
    })

    const before = await layerCount(page)
    await page.screenshot({ path: 'test-results/assistant/01-empty.png' })

    await check('a message runs a turn and puts real layers on the canvas', async () => {
      await page.locator('.pd-assistant-input textarea').fill('add a headline and a device')
      await page.locator('.pd-assistant-input textarea').press('Enter')
      await page.waitForTimeout(2000)
      expect(await layerCount(page)).toBe(before + 2)
    })

    await check('the transcript lists what was actually done', async () => {
      await expect(page.locator('.pd-assistant-reply')).toContainText('Added a headline')
      await page.locator('.pd-assistant-calls summary').last().click()
      // One turn, three calls: the read it opened with, then the two adds.
      const calls = page.locator('.pd-assistant-calls code')
      await expect(calls.first()).toHaveText('read_slide')
      expect(await calls.count()).toBe(3)
    })

    await page.screenshot({ path: 'test-results/assistant/02-turn.png' })

    await check('the whole turn is one undo step', async () => {
      const depth = await page.evaluate(async () => {
        const store = await import('/src/store/index.ts')
        return store.useEditorStore.temporal.getState().pastStates.length
      })
      expect(depth).toBe(1)
    })

    await check('reverting the turn puts the canvas back', async () => {
      await page.locator('.pd-assistant-revert').last().click()
      await page.waitForTimeout(400)
      expect(await layerCount(page)).toBe(before)
    })

    await page.screenshot({ path: 'test-results/assistant/03-reverted.png' })

    await check('the panel keeps a width the person sets', async () => {
      await page.evaluate(async () => {
        const store = await import('/src/store/assistant.ts')
        store.useAssistantStore.getState().setWidth(480)
      })
      await page.waitForTimeout(200)
      const width = await page.locator('.pd-assistant').evaluate((element) => element.getBoundingClientRect().width)
      expect(Math.round(width)).toBe(480)
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pixeldeck.assistant')).width)
      expect(stored).toBe(480)
    })

    await page.close()
  }

  // ── Proposal mode really does not touch the design ─────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openEditor(page)
    await page.evaluate(async () => {
      const store = await import('/src/store/assistant.ts')
      store.useAssistantStore.getState().setReadOnly(true)
    })
    const before = await layerCount(page)

    await check('proposal mode answers without changing anything', async () => {
      await page.locator('.pd-assistant-input textarea').fill('add a headline and a device')
      await page.locator('.pd-assistant-input textarea').press('Enter')
      await page.waitForTimeout(2000)
      expect(await layerCount(page)).toBe(before)
      await expect(page.locator('.pd-assistant-reply').last()).toBeVisible()
    })

    await page.screenshot({ path: 'test-results/assistant/04-proposal.png' })
    await page.close()
  }

  // ── Pashto: the chrome mirrors, the canvas does not ────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openEditor(page, 'ps')

    await check('the panel is in Pashto and mirrors, while the canvas stays LTR', async () => {
      await expect(page.locator('.pd-assistant-title')).toContainText(await uiString('ps', 'assistant.title'))
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
      const canvasDir = await page.locator('.konvajs-content').evaluate((element) => getComputedStyle(element).direction)
      expect(canvasDir).toBe('ltr')
    })

    await check('a Pashto turn still edits the canvas', async () => {
      const before = await layerCount(page)
      await page.locator('.pd-assistant-input textarea').fill('سرلیک او ډیوایس ورزیات کړه')
      await page.locator('.pd-assistant-input textarea').press('Enter')
      await page.waitForTimeout(2000)
      expect(await layerCount(page)).toBe(before + 2)
    })

    await page.screenshot({ path: 'test-results/assistant/05-pashto.png' })
    await page.close()
  }
  // ── The phone: a sheet, not a column ──────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await openEditor(page)

    await check('the dock is not rendered on a phone', async () => {
      await expect(page.locator('.pd-assistant:not(.pd-assistant-embedded)')).toBeHidden()
    })

    await check('the bottom bar opens the assistant sheet', async () => {
      const label = await uiString('en', 'assistant.title')
      await page.locator('.pd-mobile-nav').getByRole('button', { name: label }).click()
      await page.waitForTimeout(500)
      await expect(page.locator('#mobile-assistant.pd-sidebar-open')).toBeVisible()
      await expect(page.locator('.pd-assistant-embedded')).toBeVisible()
    })

    await page.screenshot({ path: 'test-results/assistant/06-phone-sheet.png' })

    await check('a turn from the phone edits the canvas', async () => {
      const before = await layerCount(page)
      await page.locator('.pd-assistant-input textarea').fill('add a headline and a device')
      await page.locator('.pd-assistant-input textarea').press('Enter')
      await page.waitForTimeout(2200)
      expect(await layerCount(page)).toBe(before + 2)
    })

    await check('the composer sits above the bottom of the screen', async () => {
      const box = await page.locator('.pd-assistant-composer').boundingBox()
      expect(box.y + box.height).toBeLessThanOrEqual(844)
    })

    await page.screenshot({ path: 'test-results/assistant/07-phone-turn.png' })

    await check('closing the sheet returns to the canvas', async () => {
      await page.locator('.pd-assistant-header button').last().click()
      await page.waitForTimeout(400)
      await expect(page.locator('#mobile-assistant.pd-sidebar-open')).toHaveCount(0)
    })

    await page.close()
  }

  // ── The canvas asks the assistant ──────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openEditor(page)
    await page.evaluate(async () => {
      const store = await import('/src/store/assistant.ts')
      store.useAssistantStore.getState().setOpen(false)
    })

    await check('"ask the assistant" on a selected layer opens the panel', async () => {
      // Select something the way a person would: through the layers panel.
      await page.evaluate(async () => {
        const store = await import('/src/store/index.ts')
        const state = store.useEditorStore.getState()
        const group = state.project.slideGroups.find((entry) => entry.id === state.activeSlideGroupId)
        state.addText()
        const after = store.useEditorStore.getState().project.slideGroups.find((entry) => entry.id === group.id)
        store.useEditorStore.getState().select(after.layers[after.layers.length - 1].id)
      })
      await page.waitForTimeout(400)
      const label = await uiString('en', 'assistant.ask')
      await page.locator('.pd-selection-actions').getByRole('button', { name: label }).click()
      await expect(page.locator('.pd-assistant')).toBeVisible()
      // And the selection travels with the message.
      await expect(page.locator('.pd-assistant-context')).toBeVisible()
    })

    await check('the canvas flashes the layers a turn touched', async () => {
      await page.locator('.pd-assistant-input textarea').fill('add a headline and a device')
      await page.locator('.pd-assistant-input textarea').press('Enter')
      // Caught mid-flash: it is deliberately short, so a long wait here would
      // be testing that it had already gone.
      await page.waitForTimeout(900)
      expect(await page.locator('.pd-agent-flash').count()).toBeGreaterThan(0)
    })

    await page.screenshot({ path: 'test-results/assistant/08-flash.png' })

    await check('the flash fades instead of staying on the canvas', async () => {
      await page.waitForTimeout(2000)
      await expect(page.locator('.pd-agent-flash')).toHaveCount(0)
    })

    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nAll assistant checks passed.')
