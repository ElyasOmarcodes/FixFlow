/**
 * Canvas icon library.
 *
 * Deliberately separate from `components/ui/Icon.tsx`: that sprite is the
 * editor's own chrome and is tuned for 11–16px. These are *content* — they go
 * into the design and get exported at 1290px wide, so they are drawn on the
 * same 24×24 grid but are chosen for what an app-store screenshot needs to say
 * ("secure", "offline", "sync", "analytics") rather than for what a toolbar
 * button needs to do.
 *
 * Each glyph is one SVG path `d` string. Several visually separate strokes are
 * concatenated as subpaths of that one string, so a glyph maps to exactly one
 * `Konva.Path` — no grouping, no per-shape transform bookkeeping when the layer
 * is scaled or rotated. Circles are written as two arc halves for the same
 * reason.
 *
 * Rules for adding one:
 *  - 24×24 viewBox, stroke-drawn, no fills, no hard-coded colour.
 *  - Keep to the grid: 2px margins, 4px increments where the shape allows.
 *  - Give it keywords a non-English speaker would reach for; search matches
 *    name and keywords both.
 */

export type IconCategory =
  | 'interface'
  | 'communication'
  | 'media'
  | 'commerce'
  | 'finance'
  | 'data'
  | 'health'
  | 'productivity'
  | 'social'
  | 'device'
  | 'weather'
  | 'file'
  | 'security'
  | 'travel'
  | 'food'
  | 'education'
  | 'nature'

export interface IconGlyph {
  /** Stable id, referenced by icon and chip layers. */
  name: string
  category: IconCategory
  /** One SVG path `d`; separate strokes are subpaths of the same string. */
  d: string
  /** Extra search terms beyond the name's own words. */
  keywords?: string[]
}

/** A circle as two arcs — keeps every glyph to a single path. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

export const ICON_LIBRARY: IconGlyph[] = [
  // ── Interface ────────────────────────────────────────────────────────────
  { name: 'home', category: 'interface', d: 'M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6', keywords: ['house', 'start', 'main'] },
  { name: 'search', category: 'interface', d: `${circle(11, 11, 7)}M21 21l-4.3-4.3`, keywords: ['find', 'magnify', 'lookup'] },
  { name: 'settings-gear', category: 'interface', d: `${circle(12, 12, 3)}M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9`, keywords: ['preferences', 'options', 'config'] },
  { name: 'menu', category: 'interface', d: 'M3 6h18M3 12h18M3 18h18', keywords: ['hamburger', 'list', 'nav'] },
  { name: 'filter', category: 'interface', d: 'M3 5h18l-7 8v6l-4 2v-8z', keywords: ['sort', 'funnel', 'refine'] },
  { name: 'check-circle', category: 'interface', d: `${circle(12, 12, 9)}M8 12.5l2.7 2.7L16.5 9.5`, keywords: ['done', 'success', 'complete', 'tick'] },
  { name: 'x-circle', category: 'interface', d: `${circle(12, 12, 9)}M15 9l-6 6M9 9l6 6`, keywords: ['error', 'cancel', 'fail', 'close'] },
  { name: 'plus-circle', category: 'interface', d: `${circle(12, 12, 9)}M12 8v8M8 12h8`, keywords: ['add', 'new', 'create'] },
  { name: 'minus-circle', category: 'interface', d: `${circle(12, 12, 9)}M8 12h8`, keywords: ['remove', 'subtract'] },
  { name: 'refresh-cw', category: 'interface', d: 'M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3M18 3v4h-4M6 21v-4h4', keywords: ['reload', 'sync', 'update', 'again'] },
  { name: 'toggle-on', category: 'interface', d: `M2 12a6 6 0 0 1 6-6h8a6 6 0 0 1 0 12H8a6 6 0 0 1-6-6z${circle(16, 12, 3)}`, keywords: ['switch', 'enabled', 'active'] },
  { name: 'sliders', category: 'interface', d: `M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3${circle(5, 12, 2)}${circle(12, 10, 2)}${circle(19, 14, 2)}`, keywords: ['controls', 'adjust', 'equalizer', 'tune'] },
  { name: 'layout-grid', category: 'interface', d: 'M3 3h7.5v7.5H3zM13.5 3H21v7.5h-7.5zM3 13.5h7.5V21H3zM13.5 13.5H21V21h-7.5z', keywords: ['dashboard', 'tiles', 'apps'] },
  { name: 'list', category: 'interface', d: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', keywords: ['items', 'bullets', 'feed'] },
  { name: 'external-link', category: 'interface', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3', keywords: ['open', 'new tab', 'launch'] },
  { name: 'share', category: 'interface', d: `${circle(18, 5, 3)}${circle(6, 12, 3)}${circle(18, 19, 3)}M8.6 13.5l6.8 4M15.4 6.5l-6.8 4`, keywords: ['send', 'social', 'invite'] },
  { name: 'link', category: 'interface', d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', keywords: ['url', 'chain', 'connect'] },
  { name: 'bell', category: 'interface', d: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', keywords: ['notification', 'alert', 'reminder', 'ring'] },
  { name: 'bookmark', category: 'interface', d: 'M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', keywords: ['save', 'favourite', 'read later'] },
  { name: 'star', category: 'interface', d: 'm12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z', keywords: ['favourite', 'rating', 'review', 'best'] },
  { name: 'heart', category: 'interface', d: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.7 7.8-7.7 1-1a5.5 5.5 0 0 0 0-7.8z', keywords: ['like', 'love', 'favourite', 'wishlist'] },
  { name: 'eye', category: 'interface', d: `M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z${circle(12, 12, 3)}`, keywords: ['view', 'preview', 'visible', 'watch'] },
  { name: 'trash', category: 'interface', d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 5v6m4-6v6', keywords: ['delete', 'remove', 'bin'] },
  { name: 'edit', category: 'interface', d: 'M17.5 3.5a2.12 2.12 0 0 1 3 3L7.5 19.5 3 21l1.5-4.5zM15 5l4 4', keywords: ['pencil', 'write', 'compose', 'change'] },
  { name: 'copy', category: 'interface', d: 'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1', keywords: ['duplicate', 'clone'] },
  { name: 'expand', category: 'interface', d: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3', keywords: ['fullscreen', 'maximize', 'resize'] },
  { name: 'drag-handle', category: 'interface', d: `${circle(9, 6, 1.2)}${circle(15, 6, 1.2)}${circle(9, 12, 1.2)}${circle(15, 12, 1.2)}${circle(9, 18, 1.2)}${circle(15, 18, 1.2)}`, keywords: ['move', 'reorder', 'grip'] },

  // ── Communication ────────────────────────────────────────────────────────
  { name: 'message', category: 'communication', d: 'M21 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-4-.9L3 20l1.4-4.2A8 8 0 0 1 12.5 3.5a8 8 0 0 1 8.5 8z', keywords: ['chat', 'comment', 'talk', 'sms'] },
  { name: 'messages', category: 'communication', d: 'M18 12.5a7 7 0 0 1-7.5 7 8 8 0 0 1-3.4-.8L3 20l1.3-3.7A7 7 0 0 1 10.5 5.5a7 7 0 0 1 7.5 7zM16 5.5a6 6 0 0 1 5 5.9', keywords: ['chats', 'conversations', 'inbox'] },
  { name: 'mail', category: 'communication', d: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3.5 6.5 12 13l8.5-6.5', keywords: ['email', 'envelope', 'inbox', 'letter'] },
  { name: 'send', category: 'communication', d: 'M21.5 2.5 2.5 10l8 3.5 3.5 8z M10.5 13.5 21.5 2.5', keywords: ['submit', 'paper plane', 'message'] },
  { name: 'phone-call', category: 'communication', d: 'M21.5 17v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.5 4.7 2 2 0 0 1 3.5 2.5h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L7.6 10.4a16 16 0 0 0 6 6l1.4-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z', keywords: ['call', 'ring', 'contact', 'support'] },
  { name: 'video-call', category: 'communication', d: 'M22 8.5 16 12l6 3.5zM2 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z', keywords: ['meeting', 'camera', 'conference', 'zoom'] },
  { name: 'at-sign', category: 'communication', d: `${circle(12, 12, 4)}M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8`, keywords: ['email', 'mention', 'handle', 'username'] },
  { name: 'megaphone', category: 'communication', d: 'M3 11v2a2 2 0 0 0 2 2h2l7 5V4L7 9H5a2 2 0 0 0-2 2zM17.5 9a4 4 0 0 1 0 6M20 6.5a8 8 0 0 1 0 11', keywords: ['announce', 'marketing', 'broadcast', 'promo'] },
  { name: 'inbox', category: 'communication', d: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 4.5h13a2 2 0 0 1 1.8 1.1L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.7-6.4a2 2 0 0 1 1.8-1.1z', keywords: ['mail', 'received', 'archive'] },

  // ── Media ────────────────────────────────────────────────────────────────
  { name: 'play', category: 'media', d: 'M6 3.5 20 12 6 20.5z', keywords: ['start', 'video', 'watch', 'run'] },
  { name: 'play-circle', category: 'media', d: `${circle(12, 12, 9)}M10 8.5 16 12l-6 3.5z`, keywords: ['video', 'watch', 'tutorial'] },
  { name: 'pause', category: 'media', d: 'M8 4v16M16 4v16', keywords: ['stop', 'hold'] },
  { name: 'skip-forward', category: 'media', d: 'M4 4.5 14 12 4 19.5zM19 4.5v15', keywords: ['next', 'forward'] },
  { name: 'skip-back', category: 'media', d: 'M20 4.5 10 12l10 7.5zM5 4.5v15', keywords: ['previous', 'back', 'rewind'] },
  { name: 'volume', category: 'media', d: 'M11 4.5 6 9H2v6h4l5 4.5zM15.5 9a4 4 0 0 1 0 6M18.5 6a8 8 0 0 1 0 12', keywords: ['sound', 'audio', 'speaker', 'loud'] },
  { name: 'volume-off', category: 'media', d: 'M11 4.5 6 9H2v6h4l5 4.5zM22 9l-5 6M17 9l5 6', keywords: ['mute', 'silent', 'quiet'] },
  { name: 'music', category: 'media', d: `M9 18V5l12-2v13${circle(6, 18, 3)}${circle(18, 16, 3)}`, keywords: ['song', 'audio', 'playlist', 'sound'] },
  { name: 'headphones', category: 'media', d: 'M3 17v-5a9 9 0 0 1 18 0v5M3 16h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM21 16h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z', keywords: ['audio', 'listen', 'podcast', 'support'] },
  { name: 'camera', category: 'media', d: `M3 8a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z${circle(12, 12.5, 3.5)}`, keywords: ['photo', 'picture', 'shot', 'snap'] },
  { name: 'image', category: 'media', d: `M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z${circle(8.5, 8.5, 1.8)}M21 16l-4.5-4.5L6 21`, keywords: ['photo', 'picture', 'gallery', 'media'] },
  { name: 'gallery', category: 'media', d: `M7 3h14a2 2 0 0 1 2 2v12M3 7v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z${circle(8.5, 12, 1.5)}M19 17l-4-4-8 8`, keywords: ['photos', 'album', 'library', 'images'] },
  { name: 'film', category: 'media', d: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4', keywords: ['movie', 'video', 'cinema', 'clip'] },
  { name: 'mic', category: 'media', d: 'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V22M8.5 22h7', keywords: ['record', 'voice', 'audio', 'podcast'] },

  // ── Commerce ─────────────────────────────────────────────────────────────
  { name: 'shopping-cart', category: 'commerce', d: `${circle(9.5, 20, 1.6)}${circle(18, 20, 1.6)}M2 3h3l2.7 12.6a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21.5 8H6`, keywords: ['buy', 'store', 'basket', 'shop', 'order'] },
  { name: 'shopping-bag', category: 'commerce', d: 'M5.5 7h13l1.2 13a1 1 0 0 1-1 1.1H5.3a1 1 0 0 1-1-1.1zM8.5 10V6a3.5 3.5 0 0 1 7 0v4', keywords: ['shop', 'purchase', 'retail', 'store'] },
  { name: 'tag', category: 'commerce', d: `M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z${circle(7.3, 7.3, 1.1)}`, keywords: ['price', 'label', 'discount', 'sale', 'offer'] },
  { name: 'gift', category: 'commerce', d: 'M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM2.5 7.5h19V11h-19zM12 7.5V21M12 7.5S10.5 3 8 3a2.5 2.5 0 0 0 0 4.5zM12 7.5S13.5 3 16 3a2.5 2.5 0 0 1 0 4.5z', keywords: ['present', 'reward', 'bonus', 'free'] },
  { name: 'percent', category: 'commerce', d: `M19 5 5 19${circle(7, 7, 2.5)}${circle(17, 17, 2.5)}`, keywords: ['discount', 'sale', 'off', 'deal'] },
  { name: 'receipt', category: 'commerce', d: 'M5 2h14v20l-2.3-1.6L14.3 22 12 20.4 9.7 22l-2.4-1.6L5 22zM9 8h6M9 12h6M9 16h3', keywords: ['invoice', 'bill', 'order', 'purchase'] },
  { name: 'truck', category: 'commerce', d: `M2 6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v10H2zM15 9h3.6a1 1 0 0 1 .8.4l2.4 3.2a1 1 0 0 1 .2.6V16h-7z${circle(7, 18.5, 2)}${circle(18, 18.5, 2)}`, keywords: ['delivery', 'shipping', 'order', 'transport'] },
  { name: 'package', category: 'commerce', d: 'M21 8.5 12 3.5l-9 5v7l9 5 9-5zM3 8.5l9 5 9-5M12 13.5V21M7.5 6l9 5', keywords: ['box', 'parcel', 'shipping', 'product'] },
  { name: 'store', category: 'commerce', d: 'M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM2 9l2-5.5h16L22 9M9 21v-6h6v6', keywords: ['shop', 'business', 'market', 'retail'] },

  // ── Finance ──────────────────────────────────────────────────────────────
  { name: 'credit-card', category: 'finance', d: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h3', keywords: ['pay', 'payment', 'card', 'checkout', 'billing'] },
  { name: 'wallet', category: 'finance', d: `M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z${circle(16.5, 13.5, 1.2)}`, keywords: ['money', 'balance', 'pay', 'account'] },
  { name: 'dollar', category: 'finance', d: 'M12 1.5v21M17 6.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', keywords: ['money', 'price', 'cost', 'currency', 'usd'] },
  { name: 'coins', category: 'finance', d: `${circle(8, 8, 5.5)}M13.5 9.8a5.5 5.5 0 1 1-3.8 7.9M8 5.5v5M6.3 7h3.4`, keywords: ['money', 'savings', 'cash', 'earn'] },
  { name: 'bank', category: 'finance', d: 'M3 9.5 12 4l9 5.5M4.5 9.5V18M9.5 9.5V18M14.5 9.5V18M19.5 9.5V18M2.5 21h19', keywords: ['finance', 'institution', 'account', 'savings'] },
  { name: 'trending-up', category: 'finance', d: 'M2.5 17.5 9 11l4 4 8.5-8.5M15.5 6.5H22V13', keywords: ['growth', 'increase', 'profit', 'up', 'chart'] },
  { name: 'trending-down', category: 'finance', d: 'M2.5 6.5 9 13l4-4 8.5 8.5M15.5 17.5H22V11', keywords: ['loss', 'decrease', 'down', 'decline'] },
  { name: 'safe-box', category: 'finance', d: `M3 4h18v16H3zM6 7h12v10H6z${circle(12, 12, 2.5)}M12 9.5V7M21 9v6`, keywords: ['vault', 'savings', 'secure', 'deposit'] },

  // ── Data ─────────────────────────────────────────────────────────────────
  { name: 'bar-chart', category: 'data', d: 'M4 21V10M10 21V4M16 21v-8M22 21H2', keywords: ['analytics', 'stats', 'report', 'graph', 'metrics'] },
  { name: 'line-chart', category: 'data', d: 'M3 3v18h18M7 15l4-5 3.5 3L21 6', keywords: ['analytics', 'trend', 'graph', 'stats'] },
  { name: 'pie-chart', category: 'data', d: 'M12 2.5A9.5 9.5 0 1 0 21.5 12H12z M14.5 2.9A9.5 9.5 0 0 1 21.1 9.5H14.5z', keywords: ['analytics', 'share', 'breakdown', 'stats'] },
  { name: 'activity', category: 'data', d: 'M22 12h-4l-3 9-6-18-3 9H2', keywords: ['pulse', 'monitor', 'live', 'health', 'realtime'] },
  { name: 'database', category: 'data', d: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', keywords: ['storage', 'data', 'server', 'records'] },
  { name: 'server', category: 'data', d: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01', keywords: ['hosting', 'cloud', 'backend', 'infra'] },
  { name: 'cloud', category: 'data', d: 'M17.5 19a4.5 4.5 0 0 0 .5-9 6.5 6.5 0 0 0-12.6 1.5A4 4 0 0 0 6 19z', keywords: ['sync', 'backup', 'online', 'storage'] },
  { name: 'cloud-sync', category: 'data', d: 'M17.5 18a4.5 4.5 0 0 0 .5-9 6.5 6.5 0 0 0-12.6 1.5A4 4 0 0 0 6 18M9 14.5l3 3 3-3M12 17.5V22', keywords: ['backup', 'upload', 'sync', 'cloud'] },
  { name: 'wifi', category: 'data', d: 'M2 8.8a16 16 0 0 1 20 0M5.5 12.4a11 11 0 0 1 13 0M9 16a6 6 0 0 1 6 0M12 20h.01', keywords: ['network', 'online', 'internet', 'signal'] },
  { name: 'offline', category: 'data', d: 'M2 8.8a16 16 0 0 1 6-3.6M16 5.2a16 16 0 0 1 6 3.6M5.5 12.4a11 11 0 0 1 3-1.8M12 20h.01M2 2l20 20', keywords: ['no signal', 'disconnected', 'local', 'airplane'] },
  { name: 'zap', category: 'data', d: 'M13 2 4 14h7l-1 8 9-12h-7z', keywords: ['fast', 'speed', 'power', 'instant', 'energy'] },
  { name: 'gauge', category: 'data', d: `M4 18a9 9 0 1 1 16 0${circle(12, 18, 1.6)}M12 16.5 16 9`, keywords: ['speed', 'performance', 'meter', 'dashboard'] },

  // ── Health ───────────────────────────────────────────────────────────────
  { name: 'heart-pulse', category: 'health', d: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.7 8.8-8.7a5.5 5.5 0 0 0 0-7.8zM2.5 12.5h4l2-3 2.5 5.5 2-4 1.5 1.5h5', keywords: ['fitness', 'health', 'beat', 'cardio', 'wellness'] },
  { name: 'stethoscope', category: 'health', d: `M5 3v6a4.5 4.5 0 0 0 9 0V3M4 3h2M13 3h2${circle(18, 13, 2.5)}M9.5 13.5v2a5 5 0 0 0 8.5 3.5V15.5`, keywords: ['doctor', 'medical', 'clinic', 'health'] },
  { name: 'pill', category: 'health', d: 'M10.5 2.5a5.5 5.5 0 0 1 8 7.5l-8 8a5.5 5.5 0 0 1-7.8-7.8zM7 7l10 10', keywords: ['medicine', 'pharmacy', 'drug', 'treatment'] },
  { name: 'dumbbell', category: 'health', d: 'M2 10v4M5 7v10M19 7v10M22 10v4M5 12h14', keywords: ['gym', 'fitness', 'workout', 'exercise', 'training'] },
  { name: 'running', category: 'health', d: `${circle(16, 4, 2)}M13.5 21l1.5-6-3-2.5 1-5 3.5 3 3 1M8 13l-1.5 2.5M11 21l-3-4`, keywords: ['exercise', 'run', 'activity', 'steps', 'sport'] },
  { name: 'moon-sleep', category: 'health', d: 'M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z', keywords: ['sleep', 'night', 'rest', 'dark mode', 'bedtime'] },
  { name: 'leaf', category: 'health', d: 'M11 20A7 7 0 0 1 4 13c0-6 6-10 16-10 0 10-5 15-11 15M4.5 20.5 11 14', keywords: ['nature', 'eco', 'green', 'organic', 'wellness'] },

  // ── Productivity ─────────────────────────────────────────────────────────
  { name: 'calendar', category: 'productivity', d: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9.5h18M8 2v4M16 2v4', keywords: ['date', 'schedule', 'planner', 'event', 'month'] },
  { name: 'calendar-check', category: 'productivity', d: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9.5h18M8 2v4M16 2v4M8.5 15l2.5 2.5L15.5 13', keywords: ['booked', 'scheduled', 'done', 'appointment'] },
  { name: 'clock', category: 'productivity', d: `${circle(12, 12, 9)}M12 6.5V12l4 2.5`, keywords: ['time', 'schedule', 'timer', 'hours', 'fast'] },
  { name: 'timer', category: 'productivity', d: `${circle(12, 13.5, 8)}M12 9.5v4l2.5 2M9 2h6M12 5.5v-3.5M18.5 7l1.5-1.5`, keywords: ['stopwatch', 'countdown', 'focus', 'pomodoro'] },
  { name: 'check-square', category: 'productivity', d: 'M9 11l2.5 2.5L16 9M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', keywords: ['task', 'todo', 'done', 'complete', 'checkbox'] },
  { name: 'clipboard', category: 'productivity', d: 'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8.5 12h7M8.5 16h4', keywords: ['tasks', 'notes', 'list', 'todo'] },
  { name: 'target', category: 'productivity', d: `${circle(12, 12, 9)}${circle(12, 12, 5)}${circle(12, 12, 1.4)}`, keywords: ['goal', 'aim', 'focus', 'objective'] },
  { name: 'flag', category: 'productivity', d: 'M4 21V3.5M4 4h13l-2.5 4.5L17 13H4', keywords: ['milestone', 'goal', 'report', 'priority'] },
  { name: 'notes', category: 'productivity', d: 'M5 3h14a1 1 0 0 1 1 1v12l-5 5H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM20 16h-4a1 1 0 0 0-1 1v4M8 8h8M8 12h5', keywords: ['note', 'memo', 'write', 'document'] },
  { name: 'folder', category: 'productivity', d: 'M3 6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', keywords: ['files', 'directory', 'organise', 'group'] },
  { name: 'layers-stack', category: 'productivity', d: 'm12 2.5 9.5 5-9.5 5-9.5-5zM2.5 12.5 12 17.5l9.5-5M2.5 17l9.5 5 9.5-5', keywords: ['stack', 'organise', 'group', 'levels'] },

  // ── Social ───────────────────────────────────────────────────────────────
  { name: 'user', category: 'social', d: `${circle(12, 8, 4)}M4 21a8 8 0 0 1 16 0`, keywords: ['person', 'profile', 'account', 'avatar'] },
  { name: 'users', category: 'social', d: `${circle(9, 8, 3.5)}M2 21a7 7 0 0 1 14 0M17 4.3a3.5 3.5 0 0 1 0 7.4M18 14.5a7 7 0 0 1 4 6.5`, keywords: ['team', 'group', 'community', 'people', 'members'] },
  { name: 'user-plus', category: 'social', d: `${circle(9, 8, 4)}M2 21a7 7 0 0 1 14 0M19 8v6M22 11h-6`, keywords: ['invite', 'add friend', 'signup', 'follow'] },
  { name: 'user-check', category: 'social', d: `${circle(9, 8, 4)}M2 21a7 7 0 0 1 14 0M16.5 12.5l2 2 4-4`, keywords: ['verified', 'approved', 'confirmed', 'member'] },
  { name: 'thumbs-up', category: 'social', d: 'M7 22V10l5-8a2.5 2.5 0 0 1 2.5 2.5V9h5a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 18 21H7zM7 10H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3', keywords: ['like', 'approve', 'vote', 'rating'] },
  { name: 'award', category: 'social', d: `${circle(12, 9, 6)}M8.5 14.3 7 22l5-3 5 3-1.5-7.7`, keywords: ['prize', 'winner', 'badge', 'achievement', 'top'] },
  { name: 'globe', category: 'social', d: `${circle(12, 12, 9)}M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z`, keywords: ['world', 'language', 'international', 'web', 'global'] },
  { name: 'chat-bubbles', category: 'social', d: 'M8 13.5a5.5 5.5 0 0 1 5.5-5.5h4A5.5 5.5 0 0 1 23 13.5 5.5 5.5 0 0 1 17.5 19h-1L13 22v-3a5.5 5.5 0 0 1-5-5.5zM5 12.5A5 5 0 0 1 1 8a5 5 0 0 1 5-5h3.5a5 5 0 0 1 4.3 2.5', keywords: ['community', 'forum', 'discussion', 'social'] },

  // ── Device ───────────────────────────────────────────────────────────────
  { name: 'smartphone', category: 'device', d: 'M6.5 2h11a1.5 1.5 0 0 1 1.5 1.5v17a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-17A1.5 1.5 0 0 1 6.5 2zM10.5 18.5h3', keywords: ['phone', 'mobile', 'app', 'ios', 'android'] },
  { name: 'tablet', category: 'device', d: 'M5 3h14a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 5 3zM11 18h2', keywords: ['ipad', 'device', 'screen'] },
  { name: 'laptop', category: 'device', d: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v11H4zM2 16h20l-1.5 3.5h-17z', keywords: ['computer', 'desktop', 'mac', 'work'] },
  { name: 'monitor', category: 'device', d: 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 21h8M12 17v4', keywords: ['desktop', 'screen', 'display', 'computer'] },
  { name: 'watch', category: 'device', d: `${circle(12, 12, 6)}M9 6.2 9.5 2h5l.5 4.2M9 17.8 9.5 22h5l.5-4.2M12 9.5V12l1.8 1.2`, keywords: ['wearable', 'smartwatch', 'time', 'fitness'] },
  { name: 'battery', category: 'device', d: 'M2 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM22 10.5v3M5 9.5h7v5H5z', keywords: ['power', 'charge', 'energy', 'life'] },
  { name: 'bluetooth', category: 'device', d: 'm7 7.5 10 9-5 4.5V2.5l5 4.5-10 9', keywords: ['connect', 'wireless', 'pair', 'device'] },
  { name: 'qr-code', category: 'device', d: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z', keywords: ['scan', 'code', 'share', 'link'] },
  { name: 'fingerprint', category: 'device', d: 'M12 11v2a9 9 0 0 1-1.5 5M8 8.5a5 5 0 0 1 8 4v1a13 13 0 0 1-1 5M5 11a7 7 0 0 1 3-5.8M19 11a7 7 0 0 0-3-5.8M2.5 9.5A10 10 0 0 1 12 2a10 10 0 0 1 9.5 7.5M15.5 20.5a16 16 0 0 0 1-6.5', keywords: ['biometric', 'touch id', 'secure', 'login', 'identity'] },

  // ── Weather ──────────────────────────────────────────────────────────────
  { name: 'sun', category: 'weather', d: `${circle(12, 12, 4.5)}M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8`, keywords: ['light', 'day', 'bright', 'summer', 'light mode'] },
  { name: 'moon', category: 'weather', d: 'M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z', keywords: ['night', 'dark mode', 'sleep', 'evening'] },
  { name: 'cloud-rain', category: 'weather', d: 'M17.5 16a4.5 4.5 0 0 0 .5-9 6.5 6.5 0 0 0-12.6 1.5A4 4 0 0 0 6 16M8 19v2.5M12 19v3M16 19v2.5', keywords: ['rain', 'weather', 'forecast', 'wet'] },
  { name: 'snowflake', category: 'weather', d: 'M12 2v20M3.5 7 20.5 17M20.5 7 3.5 17M12 6l-2.5-2.5M12 6l2.5-2.5M12 18l-2.5 2.5M12 18l2.5 2.5', keywords: ['snow', 'winter', 'cold', 'freeze'] },
  { name: 'droplet', category: 'weather', d: 'M12 2.5 6.5 9.5a7 7 0 1 0 11 0z', keywords: ['water', 'hydration', 'liquid', 'humidity'] },
  { name: 'thermometer', category: 'weather', d: `M14 14.8V4a2 2 0 0 0-4 0v10.8a5 5 0 1 0 4 0z${circle(12, 18, 1.6)}`, keywords: ['temperature', 'weather', 'heat', 'climate'] },

  // ── File ─────────────────────────────────────────────────────────────────
  { name: 'file', category: 'file', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', keywords: ['document', 'page', 'paper'] },
  { name: 'file-text', category: 'file', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', keywords: ['document', 'article', 'report', 'doc'] },
  { name: 'download', category: 'file', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5m-5 5V3', keywords: ['save', 'export', 'get', 'install'] },
  { name: 'upload', category: 'file', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5m5-5v12', keywords: ['import', 'send', 'share', 'publish'] },
  { name: 'archive', category: 'file', d: 'M3 4h18v4H3zM4.5 8v12a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8M9.5 12h5', keywords: ['box', 'storage', 'backup', 'old'] },
  { name: 'printer', category: 'file', d: 'M6 9V3h12v6M6 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z', keywords: ['print', 'paper', 'output'] },

  // ── Security ─────────────────────────────────────────────────────────────
  { name: 'lock', category: 'security', d: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4M12 15v2.5', keywords: ['secure', 'private', 'password', 'protected', 'safe'] },
  { name: 'unlock', category: 'security', d: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 7.9-.9M12 15v2.5', keywords: ['open', 'access', 'unlocked'] },
  { name: 'shield', category: 'security', d: 'M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z', keywords: ['secure', 'protect', 'safety', 'privacy', 'guard'] },
  { name: 'shield-check', category: 'security', d: 'M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6zM8.5 11.5l2.5 2.5 4.5-4.5', keywords: ['verified', 'protected', 'trusted', 'safe', 'secure'] },
  { name: 'key', category: 'security', d: `${circle(7.5, 15.5, 4)}M10.5 12.5 21 2l1.5 1.5-2 2 1.5 1.5-2 2-1.5-1.5-3 3`, keywords: ['password', 'access', 'login', 'unlock', 'api'] },
  { name: 'eye-off', category: 'security', d: 'M10.7 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.1 3M6.3 6.8A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 4.3-1M14.1 14.1a3 3 0 1 1-4.2-4.2M3 3l18 18', keywords: ['hidden', 'private', 'invisible', 'incognito'] },
  { name: 'verified', category: 'security', d: 'M12 2.2 14.4 5l3.6.3.3 3.6L21 11.3l-1.8 2.9.6 3.6-3.5.8L14.4 22 12 20.2 9.6 22l-1.9-3.4-3.5-.8.6-3.6L3 11.3l2.7-2.4.3-3.6L9.6 5zM8.8 12l2.2 2.2 4.2-4.4', keywords: ['badge', 'trusted', 'official', 'approved', 'check'] },

  // ── Travel ───────────────────────────────────────────────────────────────
  { name: 'map-pin', category: 'travel', d: `M12 22s8-6 8-12a8 8 0 1 0-16 0c0 6 8 12 8 12z${circle(12, 10, 3)}`, keywords: ['location', 'place', 'address', 'gps', 'near'] },
  { name: 'map', category: 'travel', d: 'M1.5 5.5 8 3v15.5L1.5 21zM8 3l8 2.5v15.5L8 18.5zM16 5.5 22.5 3v15.5L16 21z', keywords: ['navigation', 'directions', 'travel', 'route'] },
  { name: 'navigation', category: 'travel', d: 'M3 11 21 3l-8 18-2-7z', keywords: ['gps', 'direction', 'compass', 'route'] },
  { name: 'plane', category: 'travel', d: 'M21.5 15.5 13 12V5a1.5 1.5 0 0 0-3 0v7l-8.5 3.5V18l8.5-2.5V20l-2.5 1.5V23l4-1 4 1v-1.5L13 20v-4.5l8.5 2.5z', keywords: ['flight', 'travel', 'airplane', 'trip', 'airport'] },
  { name: 'car', category: 'travel', d: `M3 12.5 5 7h14l2 5.5v5H3zM3 12.5h18${circle(7, 17.5, 1.8)}${circle(17, 17.5, 1.8)}`, keywords: ['drive', 'ride', 'taxi', 'vehicle', 'transport'] },
  { name: 'bike', category: 'travel', d: `${circle(5.5, 17, 3.5)}${circle(18.5, 17, 3.5)}M5.5 17 10 8h4l4.5 9M9 8h6M14 8l1.5-3h2`, keywords: ['cycle', 'ride', 'bicycle', 'eco'] },
  { name: 'compass', category: 'travel', d: `${circle(12, 12, 9)}m15.5 8.5-2 5.5-5.5 2 2-5.5z`, keywords: ['explore', 'discover', 'navigate', 'direction'] },
  { name: 'ticket', category: 'travel', d: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2', keywords: ['event', 'booking', 'pass', 'entry'] },

  // ── Food ─────────────────────────────────────────────────────────────────
  { name: 'coffee', category: 'food', d: 'M3 8h15v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM18 9.5h1.5a2.5 2.5 0 0 1 0 5H18M6 2.5V5M10 2.5V5M14 2.5V5', keywords: ['cafe', 'drink', 'break', 'morning'] },
  { name: 'utensils', category: 'food', d: 'M4 2.5v7a2.5 2.5 0 0 0 5 0v-7M6.5 12V22M16 2.5c-1.5 1.5-2 3.5-2 6s.5 3.5 2 3.5V22M16 2.5c1.5 1.5 2 3.5 2 6s-.5 3.5-2 3.5', keywords: ['food', 'restaurant', 'eat', 'meal', 'dining'] },
  { name: 'pizza', category: 'food', d: `M12 2.5 22 20a24 24 0 0 1-20 0zM5 13.5a19 19 0 0 0 14 0${circle(10.5, 9, 1)}${circle(14, 14, 1)}`, keywords: ['food', 'delivery', 'restaurant', 'meal'] },
  { name: 'apple-fruit', category: 'food', d: 'M12 7c-2-2-6-2-7.5 1.5S5 20 9 21c1.5.4 2-.5 3-.5s1.5.9 3 .5c4-1 6-9 4.5-12.5S14 5 12 7zM12 7c0-2 1-4 3.5-4.5', keywords: ['fruit', 'healthy', 'food', 'nutrition', 'diet'] },
  { name: 'cup-drink', category: 'food', d: 'M5 3h14l-1.5 17a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8zM5.8 10h12.4', keywords: ['drink', 'water', 'juice', 'beverage'] },

  // ── Education ────────────────────────────────────────────────────────────
  { name: 'book', category: 'education', d: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5z', keywords: ['read', 'learn', 'guide', 'docs', 'manual'] },
  { name: 'graduation-cap', category: 'education', d: 'M2 8.5 12 4l10 4.5-10 4.5zM6.5 10.5V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.5M21 9v6', keywords: ['learn', 'course', 'school', 'student', 'education'] },
  { name: 'lightbulb', category: 'education', d: 'M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 1 4 11.6V18H8v-3.9A6.5 6.5 0 0 1 12 2.5z', keywords: ['idea', 'tip', 'learn', 'insight', 'smart'] },
  { name: 'puzzle', category: 'education', d: 'M9 3.5a2 2 0 0 1 4 0V5h3.5a1 1 0 0 1 1 1v3.5h1.5a2 2 0 0 1 0 4H17.5V17a1 1 0 0 1-1 1H13v-1.5a2 2 0 0 0-4 0V18H5.5a1 1 0 0 1-1-1v-3.5H3a2 2 0 0 1 0-4h1.5V6a1 1 0 0 1 1-1H9z', keywords: ['integration', 'plugin', 'extension', 'add-on', 'fit'] },
  { name: 'brain', category: 'education', d: 'M12 4.5a3 3 0 0 0-5.7-1.3A3 3 0 0 0 3 6a3 3 0 0 0 .6 1.8A3 3 0 0 0 3.5 13a3 3 0 0 0 1.4 2.5A3 3 0 0 0 9 20a3 3 0 0 0 3-1.5zM12 4.5a3 3 0 0 1 5.7-1.3A3 3 0 0 1 21 6a3 3 0 0 1-.6 1.8 3 3 0 0 1 .1 5.2 3 3 0 0 1-1.4 2.5A3 3 0 0 1 15 20a3 3 0 0 1-3-1.5zM12 4.5v14', keywords: ['ai', 'smart', 'think', 'intelligence', 'learn'] },

  // ── Nature ───────────────────────────────────────────────────────────────
  { name: 'tree', category: 'nature', d: 'M12 2 6 11h3l-4 6h5v5h4v-5h5l-4-6h3z', keywords: ['nature', 'eco', 'forest', 'green', 'environment'] },
  { name: 'flower', category: 'nature', d: `${circle(12, 12, 2.5)}M12 9.5a2.8 2.8 0 1 0 0-5.5 2.8 2.8 0 0 0 0 5.5zM12 14.5a2.8 2.8 0 1 1 0 5.5 2.8 2.8 0 0 1 0-5.5zM9.5 12a2.8 2.8 0 1 1-5.5 0 2.8 2.8 0 0 1 5.5 0zM14.5 12a2.8 2.8 0 1 0 5.5 0 2.8 2.8 0 0 0-5.5 0z`, keywords: ['nature', 'bloom', 'spring', 'garden'] },
  { name: 'recycle', category: 'nature', d: 'M7 19H4.5a2 2 0 0 1-1.7-3l2-3.4M12 5l1.3-2.2a2 2 0 0 1 3.4 0L18.6 6M17 19h2.5a2 2 0 0 0 1.7-3l-2.6-4.4M9.3 8.6 6.6 4.2M4.8 12.6l-2 3.4M9.5 21.5 7 19l2.5-2.5M14 6.5 18.6 6l-.6 4.6M2.8 16 6.6 15l1 3.8', keywords: ['eco', 'sustainable', 'green', 'reuse', 'environment'] },
  { name: 'paw', category: 'nature', d: `${circle(6, 11, 2.2)}${circle(10, 7, 2.2)}${circle(14, 7, 2.2)}${circle(18, 11, 2.2)}M12 12.5c3 0 5 2.2 5 4.5s-2 4-5 4-5-1.7-5-4 2-4.5 5-4.5z`, keywords: ['pet', 'animal', 'dog', 'cat'] },
]

/** Fast lookup by name, built once. */
const BY_NAME = new Map(ICON_LIBRARY.map((glyph) => [glyph.name, glyph]))

export function getIconGlyph(name: string): IconGlyph | undefined {
  return BY_NAME.get(name)
}

export const ICON_CATEGORIES: IconCategory[] = [
  'interface', 'communication', 'media', 'commerce', 'finance', 'data',
  'health', 'productivity', 'social', 'device', 'weather', 'file',
  'security', 'travel', 'food', 'education', 'nature',
]

/**
 * Search by name and keywords. Hyphens are treated as spaces so "map pin"
 * finds `map-pin`, and every term must match somewhere — typing more words
 * narrows rather than widens, which is what people expect from a picker.
 */
export function searchIcons(query: string, category?: IconCategory | 'all'): IconGlyph[] {
  const pool = !category || category === 'all'
    ? ICON_LIBRARY
    : ICON_LIBRARY.filter((glyph) => glyph.category === category)
  const terms = query.toLowerCase().split(/[\s-]+/).filter(Boolean)
  if (terms.length === 0) return pool
  return pool.filter((glyph) => {
    const haystack = `${glyph.name.replace(/-/g, ' ')} ${glyph.category} ${(glyph.keywords ?? []).join(' ')}`
    return terms.every((term) => haystack.includes(term))
  })
}
