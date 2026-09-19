import { useEffect, useState } from 'react'
import { useAssistantStore } from '@/store/assistant'
import { estimateLayerBox } from './GroupNode.geometry'
import { findLayerInTree } from '@/utils/layerTree'
import type { Layer, SlideGroup } from '@/types'

/**
 * Where the assistant just worked.
 *
 * A turn can touch four layers when one was asked for, and reading four ids
 * out of the transcript is not how a person finds them — so the canvas outlines
 * them for a moment. Drawn in the DOM, above the stage, exactly like the seam
 * guides and for the same reason: anything drawn *inside* the Konva stage can
 * be caught by a thumbnail capture or an export, and a screenshot with a purple
 * box around the headline is a bug nobody would trace back to here.
 */

const FLASH_MS = 1600

interface AgentHighlightProps {
  group: SlideGroup
  zoom: number
  viewportX: number
  viewportY: number
}

export function AgentHighlight({ group, zoom, viewportX, viewportY }: AgentHighlightProps) {
  const highlight = useAssistantStore((state) => state.highlight)
  const [now, setNow] = useState(() => Date.now())

  // One timer per flash rather than an interval: the overlay is idle almost
  // all of the time, and a running interval over the canvas is not free.
  useEffect(() => {
    if (!highlight) return
    // Never set state synchronously here: an already-expired highlight is
    // cleared on the next tick instead, which renders the same and does not
    // cascade a second render out of the effect body.
    const remaining = Math.max(0, FLASH_MS - (Date.now() - highlight.at))
    const timer = setTimeout(() => setNow(Date.now()), remaining)
    return () => clearTimeout(timer)
  }, [highlight])

  if (!highlight || now - highlight.at >= FLASH_MS) return null

  const boxes = highlight.ids
    .map((id) => findLayerInTree(group.layers, id))
    .filter((layer): layer is Layer => !!layer)
    .map((layer) => ({ id: layer.id, box: boxOf(group, layer) }))

  if (boxes.length === 0) return null

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {boxes.map(({ id, box }) => (
        <div
          key={id}
          className="pd-agent-flash"
          style={{
            position: 'absolute',
            left: viewportX + box.x * zoom,
            top: viewportY + box.y * zoom,
            width: Math.max(box.w * zoom, 8),
            height: Math.max(box.h * zoom, 8),
          }}
        />
      ))}
    </div>
  )
}

/**
 * A layer's box in canvas space.
 *
 * A child inside a group is stored in the group's local coordinates, so its own
 * box has to be offset by the group's origin before it means anything on the
 * canvas.
 */
function boxOf(group: SlideGroup, layer: Layer): { x: number; y: number; w: number; h: number } {
  const own = estimateLayerBox(layer)
  const parent = group.layers.find((entry) => entry.type === 'group' && entry.children.some((child) => child.id === layer.id))
  if (!parent || parent.type !== 'group') return own
  const scale = parent.scale ?? 1
  return { x: parent.x + own.x * scale, y: parent.y + own.y * scale, w: own.w * scale, h: own.h * scale }
}
