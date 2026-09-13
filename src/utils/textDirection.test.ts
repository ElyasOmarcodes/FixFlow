import { describe, expect, it } from 'vitest'
import { hasJoiningScript, textDirection } from './textDirection'
describe('paragraph direction', () => {
  it('ignores leading numbers and punctuation when finding Arabic-script text', () => {
    expect(textDirection('۱۲۳ — پښتو متن')).toBe('rtl')
    expect(textDirection('سلام دنیا 2026')).toBe('rtl')
  })
  it('keeps English-led mixed content left to right', () => {
    expect(textDirection('PixelDeck سلام')).toBe('ltr')
    expect(textDirection('123 !')).toBe('ltr')
  })
})

it('preserves shaping for Arabic embedded in English-led paragraphs', () => {
  expect(textDirection('PixelDeck سلام نړۍ')).toBe('ltr')
  expect(hasJoiningScript('PixelDeck سلام نړۍ')).toBe(true)
  expect(hasJoiningScript('PixelDeck 2026')).toBe(false)
})
