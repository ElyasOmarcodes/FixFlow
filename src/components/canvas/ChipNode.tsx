import { useEffect, useRef } from 'react'
import { Group, Path, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { ChipLayer } from '@/types'
import { getIconGlyph } from '@/assets/icons/library'
import { parseViewBox } from '@/utils/materialSymbols'
import { layoutChip, measureChipText } from '@/utils/chipLayout'
import { resolveBrandColor } from '@/utils/brandColors'
import { layerFillToKonvaProps } from '@/utils/konvaFill'
import { useBrandColors } from '@/hooks/useBrandColors'
import { useLayerEffects } from '@/hooks/useLayerEffects'
import { useLayerInteraction } from '@/hooks/useLayerInteraction'
import { useLayerTransform } from '@/hooks/useLayerTransform'

interface ChipNodeProps {
  layer: ChipLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<ChipLayer>) => void
  forceNotDraggable?: boolean
}

/**
 * A chip: one pill whose box is derived from its own contents every render.
 *
 * Resizing scales the *type*, not a stored width — a chip has no width of its
 * own, so dragging a corner changes font and icon size and the pill follows.
 * That is what keeps the label from ever overflowing its background, which is
 * exactly what went wrong when a chip was a shape with a text layer on top.
 */
export function ChipNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: ChipNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const brandColors = useBrandColors()

  const textWidth = measureChipText(layer.text, layer.fontFamily, layer.fontSize, layer.fontWeight)
  const box = layoutChip({
    textWidth,
    fontSize: layer.fontSize,
    paddingX: layer.paddingX,
    paddingY: layer.paddingY,
    iconSize: layer.icon ? layer.iconSize : 0,
    iconGap: layer.iconGap,
    iconPosition: layer.iconPosition,
  })
  // A fetched symbol carries its own path and grid; a library one is looked
  // up by name and lives on the 24-grid the layout assumes.
  const iconPath = layer.iconPath ?? (layer.icon ? getIconGlyph(layer.icon)?.d : undefined)
  const iconFilled = layer.iconPath ? layer.iconFilled === true : false
  const [iconBoxX, iconBoxY, iconBoxW, iconBoxH] = parseViewBox(layer.iconPath ? layer.iconViewBox : undefined)
  const iconScale = layer.iconSize / Math.max(iconBoxW, iconBoxH, 1)

  const shadowProps = useLayerEffects(
    groupRef,
    layer,
    `chip:${layer.text}:${layer.icon ?? ''}:${layer.fontSize}:${box.width}x${box.height}:${iconFilled}`,
  )

  // Held in a ref because a live transform mutates the node without a re-render;
  // the commit at the end reads back from here.
  const scaleRef = useRef(1)
  useEffect(() => { scaleRef.current = 1 }, [layer.fontSize, layer.iconSize, layer.paddingX, layer.paddingY])

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
    buildPatch: (node): Partial<ChipLayer> => {
      const scale = scaleRef.current
      scaleRef.current = 1
      node.scaleX(1)
      node.scaleY(1)
      return {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        // Everything that contributes to the box scales together, so the pill
        // keeps its proportions instead of stretching the text inside a fixed
        // rectangle.
        fontSize: Math.max(6, layer.fontSize * scale),
        iconSize: Math.max(6, layer.iconSize * scale),
        paddingX: Math.max(0, layer.paddingX * scale),
        paddingY: Math.max(0, layer.paddingY * scale),
        cornerRadius: Math.max(0, layer.cornerRadius * scale),
        iconGap: Math.max(0, layer.iconGap * scale),
      }
    },
  })

  const iconColor = resolveBrandColor(layer.iconColor ?? layer.textColor, brandColors)

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
      onTransform={() => {
        const node = groupRef.current
        if (!node) return
        // Konva reports a scale per axis; a chip only has one size, so the two
        // are averaged and reset — the node never carries a scale of its own.
        scaleRef.current = (node.scaleX() + node.scaleY()) / 2
      }}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        x={0}
        y={0}
        width={box.width}
        height={box.height}
        cornerRadius={layer.cornerRadius}
        stroke={layer.stroke ? resolveBrandColor(layer.stroke, brandColors) : undefined}
        strokeWidth={layer.stroke ? layer.strokeWidth ?? 1 : undefined}
        {...layerFillToKonvaProps(layer.fill, brandColors, { width: box.width, height: box.height })}
        {...shadowProps}
      />
      {iconPath && box.iconX !== null && (
        <Path
          // The glyph's own box origin is subtracted so both grids land in the
          // same iconSize square the layout reserved for them.
          x={box.iconX - iconBoxX * iconScale}
          y={box.iconY - iconBoxY * iconScale}
          data={iconPath}
          scaleX={iconScale}
          scaleY={iconScale}
          {...(iconFilled
            ? { fill: iconColor }
            : {
                stroke: iconColor,
                // Divided by the scale so the stroke reads the same weight
                // whatever size the icon is drawn at.
                strokeWidth: 2 / iconScale,
                lineCap: 'round' as const,
                lineJoin: 'round' as const,
              })}
          listening={false}
        />
      )}
      <Text
        x={box.textX}
        y={box.textY}
        width={Math.max(1, textWidth)}
        height={box.textHeight}
        text={layer.text}
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSize}
        fontStyle={String(layer.fontWeight)}
        fill={resolveBrandColor(layer.textColor, brandColors)}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}
