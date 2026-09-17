import { useEffect, useState } from 'react'

const EXIT_DURATION_MS = 240

interface AppLoadingScreenProps {
  visible: boolean
}

export function AppLoadingScreen({ visible }: AppLoadingScreenProps) {
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    if (visible) return

    const timeoutId = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [visible])

  if (!mounted) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading FixFlow"
      className={`fixed inset-0 z-[var(--pd-z-splash)] flex items-center justify-center overflow-hidden bg-[var(--pd-c-0f0f13)] transition-opacity duration-200 ease-out ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 43%, rgba(124,110,246,0.13) 0, rgba(124,110,246,0.035) 24%, transparent 52%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--pd-line)]"
      />

      <div className="relative flex -translate-y-2 flex-col items-center">
        <div className="fixflow-loader-enter flex items-center gap-3.5">
          <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ filter: 'drop-shadow(0 14px 32px rgba(0,0,0,0.4)) drop-shadow(0 0 24px rgba(124,110,246,0.25))' }}
          >
            <defs>
              <linearGradient id="ff-loader-mark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8B7CFF" />
                <stop offset="55%" stopColor="#7C6EF6" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="7" fill="url(#ff-loader-mark)" />
            <g transform="translate(3.5, 28.5) scale(0.026042)" fill="#ffffff">
              <path d="M440-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240v720Zm80-400v-320h240q33 0 56.5 23.5T840-760v240H520Zm0 400v-320h320v240q0 33-23.5 56.5T760-120H520Z" />
            </g>
          </svg>
          <span className="text-[24px] font-semibold tracking-[-0.045em] text-[var(--pd-c-f0eff8)]">
            Fix<span className="text-[var(--pd-c-9b8fff)]">Flow</span>
          </span>
        </div>

        <div className="fixflow-loader-enter fixflow-loader-enter-delay mt-7 flex w-full flex-col items-center gap-[13px]">
          <div className="fixflow-loader-words" aria-hidden="true">
            <span className="fixflow-loader-label">loading</span>
            <span className="fixflow-loader-window">
              <span className="fixflow-loader-word-track">
                <span>assets</span>
                <span>layouts</span>
                <span>slides</span>
                <span>thumbnails</span>
                <span>formats</span>
                <span>locales</span>
                <span>assets</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
