import { describe, expect, it } from 'vitest'
import { textDirection } from './textDirection'
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
