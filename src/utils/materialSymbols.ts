/**
 * Google Material Symbols, fetched on demand.
 *
 * The bundled library in `assets/icons/library.ts` is the primary source and
 * always works offline; this is the optional second one. Two things shape how
 * it is done:
 *
 *  - Google's icon *metadata* endpoint (fonts.google.com/metadata/icons) is not
 *    reliably reachable and is not CORS-open, so search runs against the name
 *    list below rather than a live index. Every name here was verified to
 *    resolve against the SVG endpoint.
 *  - The SVG endpoint on fonts.gstatic.com answers with
 *    `access-control-allow-origin: *`, so the browser can fetch it directly —
 *    no proxy, no server. That host is already in the desktop shell's CSP for
 *    web fonts.
 *
 * Fetched symbols are stored on the layer as raw path data, so a project that
 * travels to another machine, or into the headless exporter, renders the icon
 * without needing the network again.
 */

const SVG_ENDPOINT = 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined'

/** Verified to resolve against the endpoint above. */
export const MATERIAL_SYMBOL_NAMES: string[] = [
  'ac_unit', 'accessibility', 'account_circle', 'add', 'analytics', 'attach_money',
  'auto_awesome', 'backup', 'bar_chart', 'battery_full', 'bluetooth', 'bolt',
  'bookmark', 'brush', 'calendar_month', 'call', 'campaign', 'chat',
  'check_circle', 'close', 'cloud', 'cloud_queue', 'cloud_upload', 'collections',
  'content_copy', 'credit_card', 'dark_mode', 'dashboard', 'database', 'delete',
  'description', 'devices', 'directions_bike', 'directions_car', 'directions_run', 'done',
  'download', 'eco', 'edit', 'emoji_events', 'encrypted', 'explore',
  'fastfood', 'favorite', 'favorite_border', 'filter_alt', 'fingerprint', 'fitness_center',
  'flag', 'flight', 'folder', 'format_paint', 'forum', 'gpp_good',
  'grid_view', 'group', 'headphones', 'health_and_safety', 'history', 'home',
  'image', 'inventory_2', 'key', 'language', 'laptop', 'lightbulb',
  'link', 'list', 'local_bar', 'local_cafe', 'local_offer', 'local_pizza',
  'local_shipping', 'location_on', 'lock', 'lock_open', 'login', 'logout',
  'magic_button', 'mail', 'map', 'medical_services', 'menu', 'menu_book',
  'mic', 'military_tech', 'monitor_heart', 'movie', 'music_note', 'navigation',
  'notifications', 'palette', 'park', 'pause', 'payments', 'percent',
  'person', 'pets', 'photo_camera', 'pie_chart', 'play_arrow', 'print',
  'privacy_tip', 'psychology', 'public', 'qr_code', 'receipt_long', 'recycling',
  'redo', 'refresh', 'remove', 'restaurant', 'rocket_launch', 'save',
  'savings', 'schedule', 'school', 'science', 'search', 'security',
  'sell', 'send', 'settings', 'share', 'shield', 'shopping_bag',
  'shopping_cart', 'show_chart', 'smartphone', 'sort', 'spa', 'speed',
  'star', 'storage', 'store', 'sunny', 'support_agent', 'sync',
  'tablet', 'task_alt', 'thermostat', 'thumb_up', 'timer', 'translate',
  'trending_up', 'tv', 'undo', 'upload', 'verified_user', 'videocam',
  'view_module', 'visibility', 'visibility_off', 'volume_up', 'wallet', 'watch',
  'water_drop', 'wifi', 'workspace_premium',
]

export interface FetchedSymbol {
  /** Raw path data, in the symbol's own coordinate space. */
  d: string
  /** The symbol's viewBox — Material uses `0 -960 960 960`, not `0 0 24 24`. */
  viewBox: string
  /** Material Symbols are filled shapes, unlike the stroked bundled library. */
  filled: true
}

/** Underscores read as spaces, so "rocket launch" finds `rocket_launch`. */
export function searchMaterialSymbols(query: string): string[] {
  const terms = query.toLowerCase().split(/[\s_-]+/).filter(Boolean)
  if (terms.length === 0) return MATERIAL_SYMBOL_NAMES
  return MATERIAL_SYMBOL_NAMES.filter((name) => {
    const haystack = name.replace(/_/g, ' ')
    return terms.every((term) => haystack.includes(term))
  })
}

/** Parsed symbols, so re-picking one never refetches. */
const cache = new Map<string, FetchedSymbol>()

/**
 * Pull one symbol's geometry.
 *
 * Parsed with DOMParser rather than a regex: the response is a real SVG
 * document, and reading `getAttribute` off it is both simpler and safe against
 * attribute-order changes. Nothing from the response is ever inserted into the
 * page — only the `d` and `viewBox` strings are kept.
 */
export async function fetchMaterialSymbol(name: string): Promise<FetchedSymbol> {
  const cached = cache.get(name)
  if (cached) return cached

  const response = await fetch(`${SVG_ENDPOINT}/${encodeURIComponent(name)}/default/24px.svg`)
  if (!response.ok) throw new Error(`Material symbol "${name}" returned ${response.status}.`)
  const markup = await response.text()

  const document_ = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const svg = document_.querySelector('svg')
  const paths = [...document_.querySelectorAll('path')]
  if (!svg || paths.length === 0) throw new Error(`Material symbol "${name}" had no path data.`)

  // Several <path> elements concatenate into one `d` as independent subpaths,
  // which keeps a fetched icon to a single Konva node like a bundled one.
  const d = paths.map((path) => path.getAttribute('d') ?? '').filter(Boolean).join(' ')
  if (!d) throw new Error(`Material symbol "${name}" had no path data.`)

  const symbol: FetchedSymbol = {
    d,
    viewBox: svg.getAttribute('viewBox') ?? '0 -960 960 960',
    filled: true,
  }
  cache.set(name, symbol)
  return symbol
}

/** `viewBox` as four numbers, falling back to Material's own box. */
export function parseViewBox(viewBox: string | undefined): [number, number, number, number] {
  const parts = (viewBox ?? '').split(/[\s,]+/).map(Number)
  if (parts.length === 4 && parts.every((value) => Number.isFinite(value)) && parts[2] > 0 && parts[3] > 0) {
    return [parts[0], parts[1], parts[2], parts[3]]
  }
  return [0, 0, 24, 24]
}
