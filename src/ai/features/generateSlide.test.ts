import { describe, it, expect } from 'vitest'
import { buildSlidePrompt, parseSlidePlan } from './generateSlide'

const wrap = (plan: unknown) => JSON.stringify(plan)

const good = {
  backgroundFrom: '#101020', backgroundTo: '#2A1A5E',
  textColor: '#FFFFFF', accentColor: '#7C6EF6',
  layout: 'text-above-device',
  blocks: [
    { type: 'chip', text: 'New', icon: 'star' },
    { type: 'headline', text: 'Track every habit' },
    { type: 'phone' },
  ],
}

describe('parseSlidePlan', () => {
  it('reads the plan out of a clean response', () => {
    const plan = parseSlidePlan(wrap(good))
    expect(plan.layout).toBe('text-above-device')
    expect(plan.blocks.map((b) => b.type)).toEqual(['chip', 'headline', 'phone'])
  })

  it('finds the object inside a markdown fence or surrounding prose', () => {
    expect(parseSlidePlan('Here you go!\n```json\n' + wrap(good) + '\n```\nHope that helps.').blocks).toHaveLength(3)
  })

  it('drops an icon name the bundled library does not have', () => {
    const plan = parseSlidePlan(wrap({ ...good, blocks: [{ type: 'chip', text: 'New', icon: 'unicorn' }] }))
    expect(plan.blocks[0].icon).toBeUndefined()
  })

  it('drops an icon block with no usable glyph, rather than drawing a placeholder', () => {
    const plan = parseSlidePlan(wrap({
      ...good,
      blocks: [{ type: 'icon', icon: 'unicorn' }, { type: 'headline', text: 'Still here' }],
    }))
    expect(plan.blocks.map((b) => b.type)).toEqual(['headline'])
  })

  it('drops a text block with no words in it', () => {
    const plan = parseSlidePlan(wrap({
      ...good,
      blocks: [{ type: 'headline', text: '   ' }, { type: 'subhead', text: 'Kept' }],
    }))
    expect(plan.blocks.map((b) => b.type)).toEqual(['subhead'])
  })

  it('ignores a block type it does not know', () => {
    const plan = parseSlidePlan(wrap({ ...good, blocks: [{ type: 'carousel' }, { type: 'headline', text: 'Kept' }] }))
    expect(plan.blocks.map((b) => b.type)).toEqual(['headline'])
  })

  it('falls back to a sane layout when the model invents one', () => {
    expect(parseSlidePlan(wrap({ ...good, layout: 'diagonal' })).layout).toBe('text-above-device')
  })

  it('refuses a plan with no copy, so the caller can retry', () => {
    expect(() => parseSlidePlan(wrap({ ...good, blocks: [{ type: 'phone' }] }))).toThrow()
    expect(() => parseSlidePlan('I cannot help with that.')).toThrow()
  })
})

describe('buildSlidePrompt', () => {
  it('names the language the copy must come back in', () => {
    expect(buildSlidePrompt({ brief: 'a habit tracker', locale: 'ps' })).toContain('ps')
  })

  it('lists the glyphs the model is allowed to choose from', () => {
    // Without this the model invents names and every icon silently disappears.
    const prompt = buildSlidePrompt({ brief: 'x', locale: 'en' })
    expect(prompt).toContain('Allowed icon names:')
    expect(prompt).toContain('heart')
  })

  it('tells the model which slide of a set it is designing', () => {
    const prompt = buildSlidePrompt({ brief: 'x', locale: 'en', slideIndex: 2, slideCount: 5 })
    expect(prompt).toContain('slide 3 of 5')
  })

  it('shows what the slide already says, so a regenerate can build on it', () => {
    expect(buildSlidePrompt({ brief: 'x', locale: 'en', existingCopy: ['Old headline'] }))
      .toContain('Old headline')
  })
})
