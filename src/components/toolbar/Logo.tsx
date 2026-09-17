/**
 * The FixFlow mark and wordmark.
 *
 * The mark is one Material Symbol — `auto_awesome_mosaic`, rounded, filled —
 * on the brand gradient: three panels, one tall and two stacked, which is
 * what this app lays out. It is the same drawing as `public/brand-mark.svg`,
 * which `scripts/build-brand-assets.mjs` renders into the launcher icons, so
 * the thing in the toolbar and the thing on a home screen cannot drift apart.
 *
 * The gradient id is prefixed `ff-lc-` because several SVGs share the
 * document and a duplicate id would let one of them repaint the others.
 */
export function Logo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="ff-lc-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B7CFF" />
            <stop offset="55%" stopColor="#7C6EF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="7" fill="url(#ff-lc-mark)" />
        <g transform="translate(3.5, 28.5) scale(0.026042)" fill="#ffffff">
          <path d="M440-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240v720Zm80-400v-320h240q33 0 56.5 23.5T840-760v240H520Zm0 400v-320h320v240q0 33-23.5 56.5T760-120H520Z" />
        </g>
      </svg>

      <span
        style={{
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          fontWeight: 300,
          color: 'var(--pd-c-c8c8d8, #c8c8d8)',
          whiteSpace: 'nowrap',
        }}
      >
        Fix
        <span style={{ fontWeight: 700, color: '#a78bfa' }}>Flow</span>
      </span>
    </div>
  )
}
