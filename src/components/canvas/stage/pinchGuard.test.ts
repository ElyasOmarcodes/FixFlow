import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  cancelDragForPinch, consumeDragCancelledByPinch, isPinchTap, resetPinchGuard, startPinchTapGrace,
} from './pinchGuard'

beforeEach(() => resetPinchGuard())
afterEach(() => vi.useRealTimers())

describe('pinch guard', () => {
  it('reports no cancellation for an ordinary drag', () => {
    expect(consumeDragCancelledByPinch()).toBe(false)
  })

  it('marks a drag that a second finger took over', () => {
    cancelDragForPinch()
    expect(consumeDragCancelledByPinch()).toBe(true)
  })

  it('clears on read, so the next real drag still commits', () => {
    // dragend arrives once; a flag left set would abandon the following move.
    cancelDragForPinch()
    consumeDragCancelledByPinch()
    expect(consumeDragCancelledByPinch()).toBe(false)
  })

  it('swallows the tap that ends a pinch, then stops', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(isPinchTap()).toBe(false)
    startPinchTapGrace()
    expect(isPinchTap()).toBe(true)
    // Long enough to cover lifting two fingers, short enough that a genuine
    // tap a moment later still selects.
    vi.setSystemTime(new Date('2026-01-01T00:00:00.200Z'))
    expect(isPinchTap()).toBe(true)
    vi.setSystemTime(new Date('2026-01-01T00:00:00.400Z'))
    expect(isPinchTap()).toBe(false)
  })
})
