import type { BackgroundLayer, Layer, SlideGroup } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { touchProject } from '../helpers'

/** A generated slide: the layers to place, and the background to place them on. */
export interface GeneratedSlide {
  layers: Layer[]
  background?: BackgroundLayer['fill']
}

export const createGenerateSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<EditorStore, 'applyGeneratedSlide'> => ({
  /**
   * Put a generated slide on the canvas.
   *
   * One `set`, so the whole slide is a single undo step — a person who does
   * not like what the AI produced presses Ctrl+Z once, not once per layer.
   *
   * `replace` is the default because that is what "design me this slide"
   * means; keeping the existing layers is the opt-in, for building on top of
   * something already there. The background layer is never removed either way
   * — it is the one layer the editor requires — so it is patched instead.
   */
  applyGeneratedSlide: (slide, options) => {
    const { activeSlideGroupId } = get()
    const replace = options?.replace ?? true

    set((state) => ({
      project: touchProject(state.project, {
        slideGroups: state.project.slideGroups.map((group): SlideGroup => {
          if (group.id !== activeSlideGroupId) return group
          const background = group.layers.find((layer) => layer.type === 'background') as BackgroundLayer | undefined
          const kept = replace
            ? group.layers.filter((layer) => layer.type === 'background')
            : group.layers
          const withBackground = slide.background && background
            ? kept.map((layer) => (layer.id === background.id
              ? { ...layer, fill: slide.background } as BackgroundLayer
              : layer))
            : kept
          return { ...group, layers: [...withBackground, ...slide.layers] }
        }),
      }),
      // Nothing from the old slide is selected any more, and pointing the
      // selection at a layer that was just removed leaves an empty panel.
      selection: null,
      selectedLayerIds: [],
      editingGroupId: null,
    }))
  },
})
