import { transportChat } from '@/ai/transport'
import { ICON_LIBRARY } from '@/assets/icons/library'
import type { SlideBlock, SlideBlockType, SlidePlan } from '@/utils/slidePlan'
import type { AiAuth } from './translateText'

/**
 * Design a whole slide from a sentence.
 *
 * The model is not asked for layers or for coordinates. It is asked for the
 * part it is actually good at — the words, the glyph that says "sync", a
 * palette that holds together — and `buildSlideLayers` owns the geometry. That
 * split is what makes the feature usable rather than a novelty: a plan the
 * model got wrong produces wording you disagree with, not a layout you have to
 * repair by hand.
 */

const BLOCK_TYPES: readonly SlideBlockType[] = ['chip', 'headline', 'subhead', 'body', 'icon', 'phone']
const LAYOUTS = ['text-above-device', 'text-below-device', 'text-only'] as const

/** The bundled glyph names, which are the only ones guaranteed to render. */
function iconNames(): string[] {
  return ICON_LIBRARY.map((glyph) => glyph.name)
}

export const SLIDE_SYSTEM_PROMPT = [
  'You design App Store and Google Play screenshot slides.',
  'A slide sells ONE idea: a short headline, an optional supporting line, and at most one device.',
  'Write marketing copy, not documentation. Headlines are 2–6 words. Never use a full stop in a headline.',
  'Answer with JSON only. No prose, no markdown fence.',
].join('\n')

export function buildSlidePrompt(args: {
  brief: string
  /** The interface language’s locale, so the copy comes back in the right one. */
  locale: string
  /** What is already on this slide, so a regenerate can build on it. */
  existingCopy?: string[]
  slideIndex?: number
  slideCount?: number
}): string {
  const lines = [
    `Design one store screenshot slide for: ${args.brief}`,
    '',
    `Write every piece of copy in this language (BCP-47): ${args.locale}`,
  ]
  if (args.slideCount && args.slideCount > 1) {
    lines.push(`This is slide ${(args.slideIndex ?? 0) + 1} of ${args.slideCount}; make it distinct from the others.`)
  }
  if (args.existingCopy?.length) {
    lines.push('', 'The slide currently says:', ...args.existingCopy.map((line) => `- ${line}`))
  }
  lines.push(
    '',
    'Reply with exactly this JSON shape:',
    '{',
    '  "backgroundFrom": "#RRGGBB",',
    '  "backgroundTo": "#RRGGBB",',
    '  "textColor": "#RRGGBB",',
    '  "accentColor": "#RRGGBB",',
    `  "layout": ${LAYOUTS.map((l) => `"${l}"`).join(' | ')},`,
    '  "blocks": [ { "type": …, "text": …, "icon": …, "iconPosition": "left" | "right" } ]',
    '}',
    '',
    'Rules:',
    `- "type" is one of: ${BLOCK_TYPES.join(', ')}.`,
    '- Use at most one headline, one subhead, one body and one phone.',
    '- "text" is required for chip, headline, subhead and body; omit it for icon and phone.',
    '- "icon" is required for icon, optional for chip, and MUST be one of the names listed below.',
    '- Include a "phone" block unless the idea is better told without a device; then use layout "text-only".',
    '- backgroundFrom/backgroundTo must have enough contrast against textColor to be readable.',
    '',
    'Allowed icon names:',
    iconNames().join(', '),
  )
  return lines.join('\n')
}

export function buildSlideRetryPrompt(): string {
  return [
    'That was not valid JSON in the required shape.',
    'Reply again with the JSON object only — no prose, no markdown fence, no trailing commas.',
  ].join('\n')
}

/**
 * Coerce whatever came back into a plan that `buildSlideLayers` can use.
 *
 * Deliberately forgiving about everything except structure: a missing colour
 * falls back, an unknown icon name is dropped rather than failing the slide,
 * and a block of an unknown type is ignored. The one thing that cannot be
 * salvaged is having no copy at all, which is what `parseSlidePlan` throws on
 * so the caller can retry.
 */
export function parseSlidePlan(raw: string): SlidePlan {
  const known = new Set(iconNames())
  for (const candidate of jsonObjects(raw)) {
    const record = candidate as Record<string, unknown>
    const rawBlocks = Array.isArray(record.blocks) ? record.blocks : []
    const blocks: SlideBlock[] = []
    for (const entry of rawBlocks) {
      if (typeof entry !== 'object' || entry === null) continue
      const item = entry as Record<string, unknown>
      const type = String(item.type ?? '') as SlideBlockType
      if (!BLOCK_TYPES.includes(type)) continue
      const text = typeof item.text === 'string' ? item.text.trim() : undefined
      // A text block with nothing in it would render as an empty box the user
      // then has to find and delete.
      if (type !== 'icon' && type !== 'phone' && !text) continue
      const icon = typeof item.icon === 'string' && known.has(item.icon) ? item.icon : undefined
      if (type === 'icon' && !icon) continue
      blocks.push({
        type,
        text,
        icon,
        iconPosition: item.iconPosition === 'right' ? 'right' : 'left',
      })
    }
    if (!blocks.some((block) => block.type !== 'phone')) continue

    const layout = LAYOUTS.includes(record.layout as typeof LAYOUTS[number])
      ? (record.layout as SlidePlan['layout'])
      : 'text-above-device'
    return {
      backgroundFrom: String(record.backgroundFrom ?? ''),
      backgroundTo: String(record.backgroundTo ?? ''),
      textColor: String(record.textColor ?? ''),
      accentColor: String(record.accentColor ?? ''),
      layout,
      blocks,
    }
  }
  throw new Error('The model did not return a slide plan with any copy in it.')
}

/** Ask for one slide, with a single repair attempt if the JSON comes back broken. */
export async function generateSlidePlan(args: {
  auth: AiAuth
  brief: string
  locale: string
  existingCopy?: string[]
  slideIndex?: number
  slideCount?: number
}): Promise<SlidePlan> {
  const messages = [
    { role: 'system' as const, content: SLIDE_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildSlidePrompt(args) },
  ]
  const raw = await transportChat({ ...args.auth, forceJsonMode: true, maxTokens: 2048, messages })
  try {
    return parseSlidePlan(raw)
  } catch (firstError) {
    const repaired = await transportChat({
      ...args.auth,
      forceJsonMode: true,
      maxTokens: 2048,
      messages: [
        ...messages,
        { role: 'assistant', content: raw.slice(0, 4000) },
        { role: 'user', content: buildSlideRetryPrompt() },
      ],
    })
    try {
      return parseSlidePlan(repaired)
    } catch {
      throw firstError
    }
  }
}

/**
 * Every balanced `{…}` in a response, parsed.
 *
 * Models wrap JSON in prose or a fence even when told not to, so the object is
 * found rather than assumed to be the whole reply.
 */
function jsonObjects(raw: string): unknown[] {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const found: unknown[] = []
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    const end = objectEnd(cleaned, start)
    if (end === -1) continue
    try { found.push(JSON.parse(cleaned.slice(start, end + 1))) } catch { /* keep scanning */ }
  }
  return found
}

function objectEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}
