import { describe, expect, it } from 'vitest'
import { hasJoiningScript, textDirection } from './textDirection'
describe('paragraph direction', () => {
  it('ignores leading numbers and punctuation when finding Arabic-script text', () => {
    expect(textDirection('۱۲۳ — پښتو متن')).toBe('rtl')
    expect(textDirection('سلام دنیا 2026')).toBe('rtl')
  })
  it('keeps English-led mixed content left to right', () => {
    expect(textDirection('FixFlow سلام')).toBe('ltr')
    expect(textDirection('123 !')).toBe('ltr')
  })
})

it('preserves shaping for Arabic embedded in English-led paragraphs', () => {
  expect(textDirection('FixFlow سلام نړۍ')).toBe('ltr')
  expect(hasJoiningScript('FixFlow سلام نړۍ')).toBe(true)
  expect(hasJoiningScript('FixFlow 2026')).toBe(false)
})
