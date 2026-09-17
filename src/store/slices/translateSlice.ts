import type { Layer, TextMark } from '@/types'
import { getProjectBaseFormat } from '@/utils/canvasFormats'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { patchLayerForFormat, patchLayerForLocale, touchProject } from '../helpers'

/** One rewritten string, addressed the way `collectCanvasTexts` found it. */
export interface CanvasTranslationPatch {
  slideGroupId: string
  layerId: string
  text: string
  marks?: TextMark[]
}

export const createTranslateSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<EditorStore, 'applyCanvasTranslations'> => ({
  /**
   * Write a whole translation pass back to the canvas.
   *
   * One `set`, so the entire pass is a single undo step: translating forty
   * strings and then wanting the English back is one Ctrl+Z, not forty. It
   * reaches into every slide group rather than only the active one, because
   * the action offers to do the whole project at once.
   *
   * Locale routing matches `updateLayer`: on the default locale the text is
   * the layer's own, and on any other locale it belongs in that locale's
   * content instead — which is what keeps "translate this design" from
   * overwriting the source language you are translating *from*.
   */
  applyCanvasTranslations: (patches) => {
    if (patches.length === 0) return
    const { project, activeLocale, activeCanvasFormat } = get()
    const baseFormat = getProjectBaseFormat(project)
    const defaultLocale = project.settings.defaultLocale

    const byGroup = new Map<string, Map<string, CanvasTranslationPatch>>()
    for (const patch of patches) {
      let group = byGroup.get(patch.slideGroupId)
      if (!group) { group = new Map(); byGroup.set(patch.slideGroupId, group) }
      group.set(patch.layerId, patch)
    }

    const applyOne = (layer: Layer, patch: CanvasTranslationPatch): Layer => {
      // A chip carries no marks; passing an undefined `marks` to a text layer
      // is how the AI path says "this translation has no formatting left".
      const content: Partial<Layer> = layer.type === 'chip'
        ? { text: patch.text } as Partial<Layer>
        : { text: patch.text, marks: patch.marks } as Partial<Layer>
      const { layer: localized, rest } = patchLayerForLocale(layer, content, activeLocale, defaultLocale)
      if (activeLocale === defaultLocale) {
        return patchLayerForFormat(localized, rest, activeCanvasFormat, baseFormat)
      }
      // Text is locale content, so `patchLayerForLocale` has already taken
      // everything; there is no layout in this patch to fork per format.
      return localized
    }

    set((state) => ({
      project: touchProject(state.project, {
        slideGroups: state.project.slideGroups.map((group) => {
          const patchesForGroup = byGroup.get(group.id)
          if (!patchesForGroup) return group
          const visit = (layer: Layer): Layer => {
            if (layer.type === 'group') {
              return { ...layer, children: layer.children.map(visit) }
            }
            const patch = patchesForGroup.get(layer.id)
            return patch ? applyOne(layer, patch) : layer
          }
          return { ...group, layers: group.layers.map(visit) }
        }),
      }),
    }))
  },
})
