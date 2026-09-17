import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BACK_PRIORITY, backStackDepth, clearBackStack, handleBack, pushBackHandler } from './backStack'

beforeEach(() => clearBackStack())

describe('back stack', () => {
  it('reports nothing to dismiss when empty, so the shell can act', () => {
    expect(handleBack()).toBe(false)
  })

  it('dismisses the most recently opened surface first', () => {
    const order: string[] = []
    pushBackHandler(() => order.push('panel'))
    pushBackHandler(() => order.push('sheet'))
    expect(handleBack()).toBe(true)
    expect(handleBack()).toBe(true)
    expect(order).toEqual(['sheet', 'panel'])
  })

  it('pops one surface per press, never two', () => {
    pushBackHandler(() => {})
    pushBackHandler(() => {})
    handleBack()
    expect(backStackDepth()).toBe(1)
  })

  it('lets a dialog beat a panel that was opened after it', () => {
    // A dialog opened from a panel may mount in either order; Back must still
    // close the dialog rather than the panel behind it.
    const order: string[] = []
    pushBackHandler(() => order.push('modal'), BACK_PRIORITY.modal)
    pushBackHandler(() => order.push('panel'), BACK_PRIORITY.panel)
    handleBack()
    handleBack()
    expect(order).toEqual(['modal', 'panel'])
  })

  it('puts a confirmation above the dialog that raised it', () => {
    const order: string[] = []
    pushBackHandler(() => order.push('modal'), BACK_PRIORITY.modal)
    pushBackHandler(() => order.push('confirm'), BACK_PRIORITY.confirm)
    handleBack()
    expect(order).toEqual(['confirm'])
  })

  it('unregisters on close, so a shut surface never answers Back', () => {
    const handler = vi.fn()
    const release = pushBackHandler(handler)
    release()
    expect(handleBack()).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('survives a double release', () => {
    const release = pushBackHandler(() => {})
    release()
    expect(() => release()).not.toThrow()
    expect(backStackDepth()).toBe(0)
  })
})
