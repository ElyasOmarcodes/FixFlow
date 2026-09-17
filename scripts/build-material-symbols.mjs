import { writeFile } from 'node:fs/promises'

/**
 * Regenerate the bundled Material Symbols name list.
 *
 * The catalogue behind fonts.google.com/icons is not reachable from a browser:
 * `fonts.google.com/metadata/icons` sends no CORS header, so the app cannot
 * read it at runtime and a search box backed by it would always be empty. The
 * names are therefore baked in from Google's own published index, and only the
 * geometry of the one icon a person picks is fetched — from fonts.gstatic.com,
 * which does answer `access-control-allow-origin: *`.
 *
 * Run `node scripts/build-material-symbols.mjs` to pick up new icons.
 */

const INDEX = 'https://raw.githubusercontent.com/google/material-design-icons/master/update/current_versions.json'
const OUT = 'src/assets/icons/materialSymbolNames.ts'

const response = await fetch(INDEX)
if (!response.ok) throw new Error(`Google's icon index returned ${response.status}.`)
const versions = await response.json()

// `symbols::<name>` is the modern Material Symbols set — the one the site
// shows. The other families in this file are the legacy Material Icons.
const names = [...new Set(
  Object.keys(versions)
    .filter((key) => key.startsWith('symbols::'))
    .map((key) => key.slice('symbols::'.length)),
)].sort()

if (names.length < 3000) throw new Error(`Only ${names.length} symbols found — the index shape has changed.`)

// Wrapped at a sane width: one name per line would be a 4000-line diff every
// time Google adds an icon.
const lines = []
let line = ' '
for (const name of names) {
  const piece = ` '${name}',`
  if (line.length + piece.length > 96) { lines.push(line); line = ' ' }
  line += piece
}
if (line.trim()) lines.push(line)

await writeFile(OUT, `/**
 * Every Material Symbol on fonts.google.com/icons, as of the last run of
 * scripts/build-material-symbols.mjs. Generated — do not edit by hand.
 *
 * Bundled rather than fetched because Google's metadata endpoint sends no
 * CORS header. Only the geometry of a chosen icon is fetched at runtime.
 */

export const MATERIAL_SYMBOL_NAMES: readonly string[] = [
${lines.join('\n')}
]
`)

console.log(`Wrote ${names.length} symbol names to ${OUT}`)
