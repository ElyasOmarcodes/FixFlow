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
    const ungroup = page.locator('.pd-layer-footer').getByRole('button', { name: 'Ungroup', exact: true })
    await expect(ungroup).toBeEnabled()
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
      // A phone sheet is full-screen, so the chrome behind it is hidden to buy
      // height. A tablet sheet only takes the lower two thirds, so the header
      // stays put and the canvas remains visible while you work the layer list.
      if (width < 768) await expect(page.locator('.pd-mobile-header')).toBeHidden()
      else {
        await expect(page.locator('.pd-mobile-header')).toBeVisible()
        const sheet = await page.locator('#mobile-layers').boundingBox()
        const header = await page.locator('.pd-mobile-header').boundingBox()
        expect(sheet.y).toBeGreaterThan(header.y + header.height)
      }
      await expect(page.locator('.pd-slides')).toBeHidden()
    }
    await page.screenshot({ path: `test-results/editor/layers-${width}.png` })
    await ungroup.click()
    await page.locator('.pd-layer-list').getByText('Text', { exact: true }).last().click()
    // Real UI operations: duplicate, delete and undo.
    await page.locator('.pd-layer-footer').getByRole('button', { name: 'Duplicate', exact: true }).click()
    await page.locator('.pd-layer-footer').getByRole('button', { name: 'Delete', exact: true }).click()
    if (width < 1024) { await page.locator('#mobile-layers .pd-panel-close').click(); await page.locator('.pd-mobile-header').getByRole('button', { name: 'Undo', exact: true }).click() }
    else await page.getByTitle('Undo (Ctrl+Z)').click()
    await page.screenshot({ path: `test-results/editor/workspace-${width}-system.png` })
    const openMoreIfCompact = async () => {
      if (width >= 1024) return
      await page.getByRole('button', { name: 'More tools', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'More tools' })).toBeVisible()
    }
    await openMoreIfCompact()
    if (width < 1024) {
      // The sheet is a grid of labelled targets, not a folded-up toolbar: every
      // action has to be reachable without horizontal scrolling.
      const sheet = page.getByRole('dialog', { name: 'More tools' })
      const overflow = await sheet.evaluate((node) => node.scrollWidth - node.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
      for (const label of ['Projects', 'Templates', 'Export', 'Undo', 'Redo', 'Settings', 'Help']) {
        await expect(sheet.getByRole('button', { name: label, exact: true }).or(
          sheet.getByRole('link', { name: label, exact: true }))).toHaveCount(1)
      }
      await page.screenshot({ path: `test-results/editor/more-sheet-${width}.png` })
    }
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    if (width < 1024) {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'More tools' })).toHaveCount(0)
    }
    if (width < 1024) await page.locator('.pd-mobile-nav button').first().click()
    await page.locator('.pd-layer-list').getByText('Text', { exact: true }).last().click()
    if (width < 1024) await page.locator('.pd-mobile-nav button').last().click()
    await page.screenshot({ path: `test-results/editor/workspace-${width}-light.png` })
    if (width < 1024) await page.locator('#mobile-properties .pd-panel-close').click()
    await openMoreIfCompact()
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    if (width < 1024) {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'More tools' })).toHaveCount(0)
    }
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
    if (width < 1024) {
      await openMoreIfCompact()
      await page.getByRole('dialog', { name: 'More tools' }).getByRole('button', { name: 'Help', exact: true }).click()
    } else {
      await page.getByTitle('Help & keyboard shortcuts').click()
    }
    await expect(page.getByRole('dialog', { name: 'PixelDeck user guide' })).toBeVisible()
    await page.screenshot({ path: `test-results/editor/guide-${width}.png` })
    await page.getByRole('dialog', { name: 'PixelDeck user guide' })
      .getByRole('button', { name: 'Close', exact: true }).click()
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
      }
      if (width < 1024) {
        // Help lives in the "more" sheet on compact widths; the desktop toolbar
        // is not rendered there at all.
        await page.locator('.pd-mobile-header button').last().click()
        await page.getByRole('dialog').getByRole('button', { name: lang === 'ps' ? 'مرسته' : 'راهنما', exact: true }).click()
      } else {
        await page.locator('.pd-toolbar').getByTitle(lang === 'ps' ? 'مرسته او د کیبورډ لنډ لارې' : 'راهنما و کلیدهای میان‌بر').click()
      }
      await expect(page.getByRole('dialog', { name: title })).toBeVisible()
      // Help switches navigation at md (768px), independently of the editor shell.
      const chapterSelect = page.getByRole('dialog').locator('select')
      if (await chapterSelect.isVisible()) await chapterSelect.selectOption('ai-features')
      else await page.getByRole('dialog').getByRole('button', { name: new RegExp(aiTitle) }).click()
      await expect(page.getByRole('heading', { name: aiTitle })).toBeVisible()
      await page.screenshot({ path: `test-results/editor/guide-${lang}-${width}.png` })
      await page.keyboard.press('Escape')
    }
    if (width === 1440) {
      await page.evaluate(() => localStorage.setItem('pixeldeck.ui-language', 'en'))
      await page.reload()
      await page.waitForTimeout(2500)

      // Applying a template must not merge it into whatever is already open —
      // that is what put two designs on one canvas. Driven through the real
      // modal, because the store could always do this; the UI never offered it.
      const groupCount = () => page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        return {
          groups: state.project.slideGroups.length,
          name: state.project.name,
          selection: state.selection,
          editingGroupId: state.editingGroupId,
          selectedLayerIds: state.selectedLayerIds.length,
        }
      })
      // Leave a selection behind, so a surviving one would be visible.
      await page.locator('.pd-layer-list button').first().click()
      const before = await groupCount()
      await page.locator('.pd-toolbar').getByRole('button', { name: 'Templates', exact: true }).click()
      const gallery = page.getByRole('dialog')
      await expect(gallery.getByRole('button', { name: 'A new project', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await gallery.getByRole('button', { name: 'Use this template', exact: true }).first().click()
      await page.waitForTimeout(1800)
      const after = await groupCount()
      // A fresh project, not the old one with extra slides bolted on.
      expect(after.name).not.toBe(before.name)
      // And nothing still pointing at a layer from the project we left.
      expect(after.selection).toBeNull()
      expect(after.editingGroupId).toBeNull()
      expect(after.selectedLayerIds).toBe(0)

      // Apply the same template again in append mode. Only then should the
      // groups accumulate — which is what proves the default did not append.
      await page.locator('.pd-toolbar').getByRole('button', { name: 'Templates', exact: true }).click()
      const appendGallery = page.getByRole('dialog')
      await appendGallery.getByRole('button', { name: 'Add to current project', exact: true }).click()
      await appendGallery.getByRole('button', { name: 'Add slides to project', exact: true }).first().click()
      await page.waitForTimeout(1800)
      const appended = await groupCount()
      expect(appended.groups).toBe(after.groups * 2)
      expect(appended.name).toBe(after.name)
      console.log(`  templates: new-project ${before.groups}->${after.groups} groups (not ${before.groups + after.groups}); append ${after.groups}->${appended.groups}; selection cleared both times`)

      // Back to a clean slate for the smart-snap check and the template sweep.
      await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        useEditorStore.getState().resetProject()
      })
      await page.waitForTimeout(600)

      // ── Smart snap ────────────────────────────────────────────────────────
      // Two shapes, one dragged towards the other by less than the magnet's
      // reach. With snapping on it must land *exactly* aligned; with it off the
      // same gesture must leave it where the pointer put it. Driven with a real
      // mouse drag, because the snap lives in Konva's drag pipeline.
      for (let i = 0; i < 2; i++) {
        await page.getByRole('button', { name: 'New layer', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Shape', exact: true }).click()
        await page.waitForTimeout(250)
      }
      const readShapes = () => page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        const group = state.project.slideGroups.find((item) => item.id === state.activeSlideGroupId)
        return group.layers.filter((layer) => layer.type === 'shape')
          .map((layer) => ({ id: layer.id, x: layer.x, y: layer.y, w: layer.width, h: layer.height }))
      })
      const [anchor, mover] = await readShapes()
      await page.evaluate(async ([a, b]) => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        state.updateLayer(a, { x: 200, y: 400, width: 300, height: 200 })
        state.updateLayer(b, { x: 200, y: 1400, width: 300, height: 200 })
      }, [anchor.id, mover.id])
      await page.waitForTimeout(250)

      const canvasBox = await page.locator('.pd-editor main canvas').first().boundingBox()
      const viewport = () => page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        return { zoom: state.zoom, vx: state.viewportX, vy: state.viewportY }
      })
      // Guides are Konva Lines in the accent colour; counting them proves the
      // user is shown *why* the layer stopped, not just that it moved.
      const guideCount = () => page.evaluate(async () => {
        const { getStage } = await import('/src/utils/stageRegistry.ts')
        const stage = getStage()
        return stage ? stage.find('Line').filter((line) => line.stroke() === '#ec4899').length : -1
      })
      const nudge = async (dxCanvas, dyCanvas) => {
        const { zoom, vx, vy } = await viewport()
        const current = (await readShapes()).find((shape) => shape.id === mover.id)
        const toScreen = (cx, cy) => ({ x: canvasBox.x + vx + cx * zoom, y: canvasBox.y + vy + cy * zoom })
        const from = toScreen(current.x + current.w / 2, current.y + current.h / 2)
        const to = toScreen(current.x + current.w / 2 + dxCanvas, current.y + current.h / 2 + dyCanvas)
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 })
        await page.mouse.move(to.x, to.y, { steps: 6 })
        await page.waitForTimeout(150)
        const guides = await guideCount()
        await page.mouse.up()
        await page.waitForTimeout(250)
        return guides
      }

      const { zoom: snapZoom } = await viewport()
      // Comfortably inside the magnet's reach so the test is not sensitive to
      // the exact threshold, but far enough that "no snap" is unmistakable.
      const offset = Math.round((7 / snapZoom) * 0.5)
      const guidesWhileSnapping = await nudge(offset, -600)
      const snapped = (await readShapes()).find((shape) => shape.id === mover.id)
      expect(snapped.x).toBe(200)
      expect(guidesWhileSnapping).toBeGreaterThan(0)
      await page.screenshot({ path: 'test-results/editor/smart-snap.png' })

      await page.locator('.pd-toolbar').getByRole('button', { name: 'Snap', exact: true }).click()
      await page.waitForTimeout(200)
      const guidesWithoutSnapping = await nudge(offset, -200)
      const free = (await readShapes()).find((shape) => shape.id === mover.id)
      expect(free.x).not.toBe(200)
      expect(guidesWithoutSnapping).toBe(0)
      console.log(`  smart snap: on -> x=${snapped.x} with ${guidesWhileSnapping} guide(s); off -> x=${free.x.toFixed(1)}, no guides`)

      // ── Selection handle actions ──────────────────────────────────────────
      // Four grips ringing the layer: delete and lock are buttons, resize and
      // rotate are drags. The layer is enlarged first because the cluster hides
      // below ~26 screen pixels, and the default shape at fit-zoom is near that.
      await page.locator('.pd-toolbar').getByRole('button', { name: 'Snap', exact: true }).click()
      await page.waitForTimeout(200)
      await page.evaluate(async (id) => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        state.updateLayer(id, { x: 200, y: 400, width: 800, height: 700, rotation: 0 })
        state.select(id)
      }, mover.id)
      await page.waitForTimeout(500)

      const handles = page.locator('.pd-handle-action')
      await expect(handles).toHaveCount(4)
      // Corner order matters: delete top-left, lock top-right, resize
      // bottom-left, rotate bottom-right.
      const corners = await handles.evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect()
        return { label: el.getAttribute('aria-label'), x: Math.round(r.x), y: Math.round(r.y) }
      }))
      const at = (predicate) => corners.find(predicate)
      const del = at((c) => c.label === 'Delete')
      const lock = at((c) => c.label === 'Lock layer')
      const resize = at((c) => (c.label || '').includes('resize'))
      const rotate = at((c) => (c.label || '').includes('rotate'))
      expect(del && lock && resize && rotate).toBeTruthy()
      expect(del.x).toBeLessThan(lock.x)
      expect(resize.x).toBeLessThan(rotate.x)
      expect(del.y).toBeLessThan(resize.y)
      expect(lock.y).toBeLessThan(rotate.y)

      const shapeState = () => page.evaluate(async (id) => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        const group = state.project.slideGroups.find((g) => g.id === state.activeSlideGroupId)
        const layer = group.layers.find((l) => l.id === id)
        return {
          width: layer.width,
          height: layer.height,
          rotation: layer.rotation,
          undo: useEditorStore.temporal.getState().pastStates.length,
        }
      }, mover.id)

      const dragHandle = async (selector, dx, dy) => {
        const grip = await page.locator(selector).boundingBox()
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
        await page.mouse.down()
        await page.mouse.move(grip.x + grip.width / 2 + dx, grip.y + grip.height / 2 + dy, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(300)
      }

      const beforeGestures = await shapeState()
      // Smart snap is on here, so the rotation must land on a multiple of 45.
      await dragHandle('.pd-handle-action[aria-label*="rotate"]', -150, 120)
      const rotated = await shapeState()
      expect(rotated.rotation % 45).toBe(0)
      expect(rotated.rotation).not.toBe(beforeGestures.rotation)
      expect(rotated.undo).toBe(beforeGestures.undo + 1)

      await dragHandle('.pd-handle-action[aria-label*="resize"]', -120, 120)
      const resized = await shapeState()
      expect(resized.width).toBeGreaterThan(rotated.width)
      // Proportional: the aspect ratio survives the drag.
      expect(resized.width / resized.height).toBeCloseTo(rotated.width / rotated.height, 3)
      // One undo step per gesture, not one per pointer move and not zero.
      expect(resized.undo).toBe(rotated.undo + 1)

      await page.keyboard.press('Control+z')
      await page.waitForTimeout(300)
      const undone = await shapeState()
      expect(undone.width).toBeCloseTo(rotated.width, 3)
      expect(undone.rotation).toBe(rotated.rotation)
      await page.screenshot({ path: 'test-results/editor/selection-handles.png' })

      // ── Bottom bar: duplication and stacking order ────────────────────────
      const bottomActions = await page.locator('.pd-selection-actions button')
        .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
      expect(bottomActions).toEqual([
        'Duplicate', 'Bring to front', 'Bring forward', 'Send backward', 'Send to back',
      ])

      // Ids, not types: both content layers are shapes, so a type list would look
      // unchanged however they are reordered.
      const order = () => page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        const group = state.project.slideGroups.find((g) => g.id === state.activeSlideGroupId)
        return group.layers.map((l) => ({ id: l.id, type: l.type }))
      })
      const beforeOrder = await order()
      await page.locator('.pd-selection-actions button[aria-label="Send to back"]').click()
      await page.waitForTimeout(300)
      const afterBack = await order()
      // The background never loses the bottom slot, whatever is sent behind.
      expect(afterBack[0].type).toBe('background')
      expect(afterBack.map((l) => l.id)).not.toEqual(beforeOrder.map((l) => l.id))
      await page.locator('.pd-selection-actions button[aria-label="Bring to front"]').click()
      await page.waitForTimeout(300)
      expect((await order()).map((l) => l.id)).toEqual(beforeOrder.map((l) => l.id))
      console.log(`  selection handles: 4 grips in corners, rotate snapped to ${rotated.rotation}deg, resize proportional, 1 undo step each`)
      console.log('  bottom bar: duplicate + 4 stacking actions, background stays at the bottom')

      // The background covers the whole canvas; ringing it would strand four
      // buttons in the corners of the viewport.
      await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        const state = useEditorStore.getState()
        const group = state.project.slideGroups.find((item) => item.id === state.activeSlideGroupId)
        state.select(group.layers.find((layer) => layer.type === 'background').id)
      })
      await page.waitForTimeout(400)
      await expect(handles).toHaveCount(0)

      // Snapping was already restored before the handle checks; just reset the
      // project for the template sweep below.
      await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/index.ts')
        useEditorStore.getState().resetProject()
      })
      await page.waitForTimeout(600)

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
