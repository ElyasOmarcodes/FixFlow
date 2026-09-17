import { describe, it, expect } from 'vitest'
import { nextUntitledName } from './projectNames'

describe('nextUntitledName', () => {
  it('uses the base name when the library is empty', () => {
    expect(nextUntitledName([])).toBe('Untitled')
  })

  it('counts up past the base name', () => {
    expect(nextUntitledName([{ name: 'Untitled' }])).toBe('Untitled 2')
    expect(nextUntitledName([{ name: 'Untitled' }, { name: 'Untitled 2' }])).toBe('Untitled 3')
  })

  it('fills the first gap rather than always appending', () => {
    expect(nextUntitledName([{ name: 'Untitled' }, { name: 'Untitled 3' }])).toBe('Untitled 2')
  })

  it('matches the store’s own duplicate check — case and surrounding space', () => {
    // The store compares trimmed and lowercased, so a name that differs only
    // in case would be accepted here and then rejected on save.
    expect(nextUntitledName([{ name: '  UNTITLED ' }])).toBe('Untitled 2')
  })

  it('ignores unrelated names', () => {
    expect(nextUntitledName([{ name: 'Wanderlight' }, { name: 'Orbit Studio' }])).toBe('Untitled')
  })

  it('takes a different base', () => {
    expect(nextUntitledName([{ name: 'Draft' }], 'Draft')).toBe('Draft 2')
  })
})
