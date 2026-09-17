import type { ChipLayer, Layer, Project, SlideGroup, TextLayer, TextMark } from '@/types'
import { translateGroupTexts, translateLayerText, type AiAuth, type TranslationResult } from './translateText'

/**
 * Translate everything written on the canvas, in one pass.
 *
 * The localisation view already translates text layers into *other locales*,
 * side by side, which is the right tool for shipping a screenshot set in nine
 * languages. It is the wrong tool for the far commoner job: "this design is in
 * English, make it Pashto". That used to mean opening every layer and
 * translating it by hand, one field at a time, and chips could not be
 * translated at all.
 *
 * So this collects every string a viewer can read — text layers, chip labels,
 * and both of those nested inside groups — translates them together in one
 * request per slide so the terminology stays consistent, and rewrites them in
 * place.
 */

/** One translatable string on the canvas, with enough to write it back. */
export interface CanvasTextTarget {
  slideGroupId: string
  slideGroupName: string
  /** Set when the layer is a child of a group layer. */
  parentGroupId?: string
  layerId: string
  type: 'text' | 'chip'
  text: string
  marks?: TextMark[]
}

/** Every readable string in one slide group, groups included, in paint order. */
export function collectCanvasTexts(group: SlideGroup): CanvasTextTarget[] {
  const found: CanvasTextTarget[] = []

  const visit = (layer: Layer, parentGroupId?: string) => {
    if (layer.type === 'group') {
      for (const child of layer.children) visit(child, layer.id)
      return
    }
    if (layer.type === 'text') {
      const text = (layer as TextLayer).text?.trim()
      if (text) {
        found.push({
          slideGroupId: group.id,
          slideGroupName: group.name,
          parentGroupId,
          layerId: layer.id,
          type: 'text',
          text: (layer as TextLayer).text,
          marks: (layer as TextLayer).marks,
        })
      }
      return
    }
    if (layer.type === 'chip') {
      const text = (layer as ChipLayer).text?.trim()
      if (text) {
        found.push({
          slideGroupId: group.id,
          slideGroupName: group.name,
          parentGroupId,
          layerId: layer.id,
          type: 'chip',
          text: (layer as ChipLayer).text,
        })
      }
    }
  }

  for (const layer of group.layers) visit(layer)
  return found
}

export interface CanvasTranslation {
  target: CanvasTextTarget
  text: string
  marks?: TextMark[]
  /** The source had formatting that could not be carried over. */
  formattingLost?: boolean
}

/**
 * Translate one slide's worth of targets.
 *
 * One batched request first, because a model that sees the whole slide keeps
 * its terminology consistent across a headline and its caption. A batch that
 * comes back malformed falls back to a request per string rather than
 * failing the slide — a partial translation is still progress the person can
 * finish by hand.
 */
export async function translateCanvasSlide(args: {
  auth: AiAuth
  project: Project
  slideGroup: SlideGroup
  targets: CanvasTextTarget[]
  targetLocale: string
  onProgress?: (done: number) => void
}): Promise<{ translations: CanvasTranslation[]; failed: CanvasTextTarget[] }> {
  const { auth, project, slideGroup, targets, targetLocale, onProgress } = args
  const translations: CanvasTranslation[] = []
  const failed: CanvasTextTarget[] = []
  if (targets.length === 0) return { translations, failed }

  const record = (target: CanvasTextTarget, result: TranslationResult) => {
    translations.push({
      target,
      text: result.text,
      // A chip is a single-run label, so a mark set has nothing to attach to.
      marks: target.type === 'text' ? result.marks : undefined,
      formattingLost: result.formattingLost,
    })
    onProgress?.(translations.length + failed.length)
  }

  try {
    const batch = await translateGroupTexts({
      auth,
      project,
      slideGroup,
      items: targets.map((target) => ({
        id: target.layerId,
        text: target.text,
        marks: target.type === 'text' ? target.marks : undefined,
      })),
      targetLocale,
    })
    for (const target of targets) {
      const result = batch[target.layerId]
      if (result) record(target, result)
      else failed.push(target)
    }
    if (failed.length === 0) return { translations, failed }
  } catch {
    // Fall through to the per-string path below.
  }

  // Whatever the batch missed, one at a time.
  const remaining = translations.length === 0 ? targets : [...failed]
  failed.length = 0
  for (const target of remaining) {
    try {
      const result = await translateLayerText({
        auth,
        project,
        slideGroup,
        layerId: target.layerId,
        text: target.text,
        marks: target.type === 'text' ? target.marks : undefined,
        targetLocale,
      })
      record(target, result)
    } catch {
      failed.push(target)
      onProgress?.(translations.length + failed.length)
    }
  }

  return { translations, failed }
}
