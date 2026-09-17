import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeHex } from '@/utils/color'

/**
 * The colours this person has actually used, most recent first.
 *
 * Solid colours only, and separate from the fill recents: a gradient belongs
 * with the gradient presets, and mixing the two gave a strip where half the
 * entries could not be applied to what was selected.
 */
const LIMIT = 24

interface RecentColorsState {
  colors: string[]
  remember: (color: string) => void
}

export const useRecentColors = create<RecentColorsState>()(
  persist(
    (set) => ({
      colors: [],
      remember: (color) => set((state) => {
        const hex = normalizeHex(color, '')
        if (!hex) return state
        if (state.colors[0] === hex) return state
        return { colors: [hex, ...state.colors.filter((item) => item !== hex)].slice(0, LIMIT) }
      }),
    }),
    { name: 'pixeldeck.recent-colors-v1' },
  ),
)
