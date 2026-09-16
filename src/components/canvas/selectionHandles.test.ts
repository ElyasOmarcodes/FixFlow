import { describe, expect, it } from 'vitest'
import {
  ROTATION_SNAP_DEGREES,
  angleFromCentre,
  captureSizeValues,
  normaliseRotation,
  resizeKeysFor,
  resolveResizeFactor,
  resolveRotation,
  scaledSizePatch,
} from './selectionHandles'
import type { Layer } from '@/types'

const layer = (patch: Record<string, unknown>) => ({
  id: 'l', name: 'L', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
  ...patch,
}) as unknown as Layer

describe('angleFromCentre', () => {
  it('measures clockwise from the positive x axis', () => {
    expect(angleFromCentre(0, 0, 10, 0)).toBe(0)
    expect(angleFromCentre(0, 0, 0, 10)).toBe(90)
    expect(angleFromCentre(0, 0, -10, 0)).toBe(180)
  })
})

describe('normaliseRotation', () => {
  it('wraps into [0, 360)', () => {
    expect(normaliseRotation(0)).toBe(0)
    expect(normaliseRotation(360)).toBe(0)
    expect(normaliseRotation(-90)).toBe(270)
    expect(normaliseRotation(450)).toBe(90)
  })
})

describe('resolveRotation', () => {
  it('adds the swept angle to where the layer started', () => {
    expect(resolveRotation(10, 0, 30, false)).toBe(40)
  })

  it('wraps past a full turn', () => {
    expect(resolveRotation(350, 0, 30, false)).toBe(20)
  })

  it('quantises to 45 degrees when snapping', () => {
    expect(resolveRotation(0, 0, 20, true)).toBe(0)
    expect(resolveRotation(0, 0, 25, true)).toBe(ROTATION_SNAP_DEGREES)
    expect(resolveRotation(0, 0, 100, true)).toBe(90)
  })

  it('snaps to zero rather than 360 at the wrap point', () => {
    expect(resolveRotation(0, 0, 359, true)).toBe(0)
  })
})

describe('resolveResizeFactor', () => {
  it('is the ratio of pointer distances', () => {
    expect(resolveResizeFactor(100, 200)).toBe(2)
    expect(resolveResizeFactor(100, 50)).toBe(0.5)
  })

  it('clamps so a layer can never vanish or explode', () => {
    expect(resolveResizeFactor(100, 0)).toBe(0.05)
    expect(resolveResizeFactor(1, 100000)).toBe(20)
  })

  it('is inert when the drag started on the anchor', () => {
    expect(resolveResizeFactor(0, 40)).toBe(1)
  })
})

describe('resizeKeysFor', () => {
  it('scales groups and phones as a unit', () => {
    expect(resizeKeysFor('group')).toEqual(['scale'])
    expect(resizeKeysFor('phone')).toEqual(['scale'])
  })

  it('grows text and emoji by font size as well as box', () => {
    expect(resizeKeysFor('text')).toEqual(['fontSize', 'width', 'height'])
    expect(resizeKeysFor('emoji')).toEqual(['fontSize', 'width', 'height'])
  })

  it('resizes everything else by its box', () => {
    expect(resizeKeysFor('shape')).toEqual(['width', 'height'])
    expect(resizeKeysFor('image')).toEqual(['width', 'height'])
  })
})

describe('captureSizeValues', () => {
  it('reads the properties the type actually uses', () => {
    expect(captureSizeValues(layer({ type: 'shape', width: 100, height: 40 })))
      .toEqual({ width: 100, height: 40 })
  })

  it('defaults a missing group scale to 1, as older projects have none', () => {
    expect(captureSizeValues(layer({ type: 'group', children: [] }))).toEqual({ scale: 1 })
  })
})

describe('scaledSizePatch', () => {
  it('scales from the captured start, not from the live value', () => {
    const shape = layer({ type: 'shape', width: 100, height: 40 })
    const start = captureSizeValues(shape)
    expect(scaledSizePatch(shape, start, 1.5)).toEqual({ width: 150, height: 60 })
    // A second call with the same start does not compound.
    expect(scaledSizePatch(shape, start, 2)).toEqual({ width: 200, height: 80 })
  })

  it('scales a text layer by font size and box together', () => {
    const text = layer({ type: 'text', fontSize: 40, width: 200, height: 60 })
    expect(scaledSizePatch(text, captureSizeValues(text), 0.5))
      .toEqual({ fontSize: 20, width: 100, height: 30 })
  })

  it('skips keys the layer does not carry', () => {
    const odd = layer({ type: 'shape', width: 100 })
    expect(scaledSizePatch(odd, captureSizeValues(odd), 2)).toEqual({ width: 200 })
  })
})
