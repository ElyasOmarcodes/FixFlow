import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

/**
 * Render the brand mark to the platform icon sources.
 *
 * `resources/icon.png` and `resources/splash.png` are what `tauri icon` and
 * `@capacitor/assets` derive every launcher icon, favicon and splash screen
 * from, so they are the two files that decide what the app looks like on a
 * home screen. They are PNGs, and hand-drawing them means the app icon and
 * the in-app mark drift apart the first time either is touched.
 *
 * So they are generated from `public/brand-mark.svg` instead. Rendered in the
 * browser the app already ships with, rather than pulling in an image
 * library: the mark is one gradient and one path, and this way what lands in
 * the PNG is exactly what a browser draws.
 *
 * Run after changing the mark:  node scripts/build-brand-assets.mjs
 */

const ICON_PX = 1024
const SPLASH_PX = 2732
/** The mark occupies this share of the splash; the rest is the app's surface. */
const SPLASH_MARK_SHARE = 0.22
const SPLASH_BACKGROUND = '#0F0F13'

const mark = await readFile('public/brand-mark.svg', 'utf8')

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage({ viewport: { width: ICON_PX, height: ICON_PX } })

  // ── Launcher icon: the mark, full bleed. Platforms apply their own mask,
  //    so any rounding baked in here would be rounded twice.
  await page.setContent(
    `<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block;width:${ICON_PX}px;height:${ICON_PX}px}</style>${mark}`,
  )
  await writeFile('resources/icon.png', await page.screenshot({ omitBackground: true }))

  // ── Splash: the mark small and centred on the app's own surface, so the
  //    launch does not flash a colour the app never shows again.
  const markPx = Math.round(SPLASH_PX * SPLASH_MARK_SHARE)
  await page.setViewportSize({ width: SPLASH_PX, height: SPLASH_PX })
  await page.setContent(
    `<style>
      html,body{margin:0;padding:0;overflow:hidden;background:${SPLASH_BACKGROUND}}
      .wrap{width:${SPLASH_PX}px;height:${SPLASH_PX}px;display:flex;align-items:center;justify-content:center}
      svg{display:block;width:${markPx}px;height:${markPx}px;border-radius:${Math.round(markPx * 0.22)}px}
    </style><div class="wrap">${mark}</div>`,
  )
  await writeFile('resources/splash.png', await page.screenshot())

  console.log(`✓ brand assets: icon ${ICON_PX}px, splash ${SPLASH_PX}px`)
} finally {
  await browser.close()
}
