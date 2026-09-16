import { describe, expect, it } from 'vitest'
import { canvasSnapLines, computeSnap, type SnapBox } from '@/utils/smartSnap'

const box = (x: number, y: number, width = 100, height = 50): SnapBox => ({ x, y, width, height })

describe('computeSnap', () => {
  it('leaves a box alone when nothing is within reach', () => {
    const result = computeSnap(box(500, 500), { boxes: [box(0, 0)] }, 8)
    expect(result).toEqual({ dx: 0, dy: 0, vertical: [], horizontal: [] })
  })

  it('latches a left edge onto a neighbour’s left edge', () => {
    // Target occupies x 200..300. Moving box starts at 204 — 4 away.
    const result = computeSnap(box(204, 500), { boxes: [box(200, 0)] }, 8)
    expect(result.dx).toBe(-4)
    expect(result.vertical).toContain(200)
  })

  it('latches a right edge onto a neighbour’s left edge', () => {
    // Moving box spans 97..197; the target's left edge is at 200.
    const result = computeSnap(box(97, 500), { boxes: [box(200, 0)] }, 8)
    expect(result.dx).toBe(3)
  })

  it('prefers centre alignment when an edge is equally close', () => {
    // Moving box 0..100 (centre 50). Candidate lines at 46 and 54 are both 4
    // away — from the centre and from the left edge respectively.
    const result = computeSnap(box(0, 500), { boxes: [], verticalLines: [46, 54] }, 8)
    // Centre is tried first, so the centre→46 delta (-4) wins the tie.
    expect(result.dx).toBe(-4)
    expect(result.vertical).toContain(46)
  })

  it('takes the nearest candidate when several are in range', () => {
    const result = computeSnap(box(100, 500), { boxes: [], verticalLines: [98, 106] }, 10)
    expect(result.dx).toBe(-2)
  })

  it('resolves the two axes independently', () => {
    // Horizontally near a neighbour, vertically nowhere near anything.
    const result = computeSnap(box(203, 900), { boxes: [box(200, 0)] }, 8)
    expect(result.dx).toBe(-3)
    expect(result.dy).toBe(0)
    expect(result.horizontal).toEqual([])
  })

  it('reports every line the box settles on, not just the one that snapped it', () => {
    // After moving 2px left the box spans 200..300: its left edge meets 200
    // and its right edge meets 300, both supplied as candidates.
    const result = computeSnap(box(202, 500), { boxes: [], verticalLines: [200, 300] }, 8)
    expect(result.dx).toBe(-2)
    expect(result.vertical).toEqual(expect.arrayContaining([200, 300]))
  })

  it('does not report a duplicate guide when two targets share a line', () => {
    const result = computeSnap(box(202, 500), { boxes: [box(200, 0), box(200, 600)] }, 8)
    expect(result.vertical.filter((line) => line === 200)).toHaveLength(1)
  })

  it('centres a box on the canvas', () => {
    const { verticalLines, horizontalLines } = canvasSnapLines(1000, 2000)
    // Box 100x50 centred would sit at x=450, y=975. Start 3px off on both axes.
    const result = computeSnap(box(453, 978), { boxes: [], verticalLines, horizontalLines }, 8)
    expect(result.dx).toBe(-3)
    expect(result.dy).toBe(-3)
    expect(result.vertical).toContain(500)
    expect(result.horizontal).toContain(1000)
  })

  it('snaps to a pano slide seam, not only to the whole strip', () => {
    const { verticalLines } = canvasSnapLines(3000, 2000, [1000, 2000])
    const result = computeSnap(box(996, 500), { boxes: [], verticalLines }, 8)
    expect(result.dx).toBe(4)
    expect(result.vertical).toContain(1000)
  })

  it('honours the threshold as a hard limit', () => {
    expect(computeSnap(box(209, 500), { boxes: [box(200, 0)] }, 8).dx).toBe(0)
    expect(computeSnap(box(208, 500), { boxes: [box(200, 0)] }, 8).dx).toBe(-8)
  })

  it('is inert when snapping is effectively switched off', () => {
    expect(computeSnap(box(201, 500), { boxes: [box(200, 0)] }, 0)).toEqual({
      dx: 0, dy: 0, vertical: [], horizontal: [],
    })
  })

  it('aligns two boxes by their centres', () => {
    // Target centre x = 250. Moving box is 60 wide, so centred it starts at 220.
    const result = computeSnap(box(223, 500, 60), { boxes: [box(200, 0)] }, 8)
    expect(result.dx).toBe(-3)
    expect(result.vertical).toContain(250)
  })
})

describe('canvasSnapLines', () => {
  it('offers both edges and the centre on each axis', () => {
    expect(canvasSnapLines(1290, 2796)).toEqual({
      verticalLines: [0, 645, 1290],
      horizontalLines: [0, 1398, 2796],
    })
  })

  it('does not repeat a seam that already coincides with an edge or the centre', () => {
    expect(canvasSnapLines(2000, 1000, [1000, 2000]).verticalLines).toEqual([0, 1000, 2000])
  })
})
