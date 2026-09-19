import { useRef } from 'react'
import { Group, Path, Rect } from 'react-konva'
import type Konva from 'konva'
import type { IconLayer } from '@/types'
import { getIconGlyph } from '@/assets/icons/library'
import { parseViewBox } from '@/utils/materialSymbols'
import { resolveBrandColor } from '@/utils/brandColors'
import { layerFillToKonvaProps } from '@/utils/konvaFill'
import { useBrandColors } from '@/hooks/useBrandColors'
import { useLayerEffects } from '@/hooks/useLayerEffects'
import { useLayerInteraction } from '@/hooks/useLayerInteraction'
import { useLayerTransform } from '@/hooks/useLayerTransform'

interface IconNodeProps {
  layer: IconLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<IconLayer>) => void
  forceNotDraggable?: boolean
}

/**
 * A single glyph, drawn as vector geometry.
 *
 * Vector rather than a rasterised image so it stays sharp at export size —
 * a store screenshot is 1290px wide, where a 24px bitmap would be mush — and
 * so its colour and weight remain properties rather than baked pixels. The
 * bundled library is stroked on a 24-grid; a fetched Material Symbol is a
 * filled shape on its own, so both the paint mode and the grid are read off
 * the layer instead of assumed.
 */
export function IconNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: IconNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const brandColors = useBrandColors()

  // A fetched icon carries its own path; a library one is looked up by name.
  const pathData = layer.customPath ?? getIconGlyph(layer.icon)?.d
  const plate = layer.backgroundPadding * 2 + layer.size
  // A fetched glyph brings its own grid — Material's is `0 -960 960 960`, so
  // the path needs both a different scale and an origin shift to land inside
  // the same `size` box as a library glyph.
  const [boxX, boxY, boxW, boxH] = parseViewBox(layer.customPath ? layer.customViewBox : undefined)
  const scale = layer.size / Math.max(boxW, boxH, 1)
  const filled = layer.customPath ? layer.customFilled === true : false

  const shadowProps = useLayerEffects(groupRef, layer, `icon:${layer.icon}:${layer.size}:${plate}:${filled}`)

  const interactionProps = useLayerInteraction({
    nodeRef: groupRef,
    locked: layer.locked,
    onSelect,
    onDragEnd,
    getDragPosition: (node) => ({ x: node.x(), y: node.y() }),
  })

  const handleTransformEnd = useLayerTransform({
    nodeRef: groupRef,
    onChange: onTransformEnd,
    // Read from the node at the end of the gesture rather than from a ref held
    // across gestures — see the note in ChipNode for what a stale one does.
    buildPatch: (node, scale): Partial<IconLayer> => {
      const factor = (scale.scaleX + scale.scaleY) / 2
      return {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        size: Math.max(8, layer.size * factor),
        backgroundPadding: Math.max(0, layer.backgroundPadding * factor),
        backgroundRadius: Math.max(0, layer.backgroundRadius * factor),
      }
    },
  })

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      x={layer.x}
      y={layer.y}
      opacity={layer.opacity}
      visible={layer.visible}
      rotation={layer.rotation}
      draggable={!forceNotDraggable && !layer.locked}
      {...interactionProps}
      onTransformEnd={handleTransformEnd}
    >
      {layer.background && (
        <Rect
          // The plate grows *outward* from the glyph rather than the glyph
          // sitting inset within it. The layer's x,y is where the glyph is, so
          // adding a plate — or changing its padding or corner radius — cannot
          // move the icon, which is what made those controls look like they
          // were resizing and repositioning the layer.
          x={-layer.backgroundPadding}
          y={-layer.backgroundPadding}
          width={plate}
          height={plate}
          // A radius beyond half the plate has no more circle to give and
          // makes Konva draw a distorted shape.
          cornerRadius={Math.min(layer.backgroundRadius, plate / 2)}
          {...layerFillToKonvaProps(layer.background, brandColors, { width: plate, height: plate })}
          {...shadowProps}
        />
      )}
      {pathData && (
        <Path
          x={-boxX * scale}
          y={-boxY * scale}
          data={pathData}
          scaleX={scale}
          scaleY={scale}
          {...(filled
            ? { fill: resolveBrandColor(layer.color, brandColors) }
            : {
                stroke: resolveBrandColor(layer.color, brandColors),
                // Divided by the scale so the drawn weight is what the user
                // set, not what the glyph's own grid happens to produce here.
                strokeWidth: layer.strokeWidth / scale,
                lineCap: 'round' as const,
                lineJoin: 'round' as const,
              })}
          listening={false}
          {...(layer.background ? {} : shadowProps)}
        />
      )}
      {/* A glyph is thin strokes; without a transparent hit area, clicking
          anywhere but exactly on a line would miss the layer entirely. The
          area covers the plate when there is one, so the whole badge is
          grabbable, not just the glyph in its middle. */}
      <Rect
        x={layer.background ? -layer.backgroundPadding : 0}
        y={layer.background ? -layer.backgroundPadding : 0}
        width={layer.background ? plate : layer.size}
        height={layer.background ? plate : layer.size}
        fill="transparent"
      />
    </Group>
  )
}
