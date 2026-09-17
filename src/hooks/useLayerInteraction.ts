import { useRef } from 'react'
import type Konva from 'konva'
import type { RefObject } from 'react'
import { consumeDragCancelledByPinch, isPinchTap } from '@/components/canvas/stage/pinchGuard'

interface LayerInteractionOptions<TNode extends Konva.Node> {
  nodeRef: RefObject<TNode | null>
  locked: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  getDragPosition: (node: TNode) => { x: number; y: number }
}

/** Common click/tap/drag selection behavior for canvas layers. */
export function useLayerInteraction<TNode extends Konva.Node>({
  nodeRef,
  locked,
  onSelect,
  onDragEnd,
  getDragPosition,
}: LayerInteractionOptions<TNode>) {
  // Where the node sat when the drag began, so a drag the pinch takes over
  // can be put back. Captured here rather than asked of every call site: a
  // rule that has to be remembered at nine nodes is a rule that will be
  // missed at some of them.
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const selectIfUnlocked = () => {
    if (locked) return
    // Lifting the fingers that ended a pinch is not a tap on whatever was
    // under them.
    if (isPinchTap()) return
    onSelect()
  }

  return {
    onClick: selectIfUnlocked,
    onTap: selectIfUnlocked,
    onDragStart: () => {
      const node = nodeRef.current
      if (node) dragOrigin.current = { x: node.x(), y: node.y() }
      selectIfUnlocked()
    },
    onDragEnd: () => {
      const node = nodeRef.current
      if (!node) return
      // A drag that a second finger turned into a pinch is abandoned, not
      // committed: the reported position is wherever the finger happened to
      // be when the pinch began, which is not a move the user asked for. The
      // node is put back from the store, which still holds the pre-drag
      // values because a drag only commits here.
      const origin = dragOrigin.current
      dragOrigin.current = null
      if (consumeDragCancelledByPinch()) {
        if (origin) {
          node.position(origin)
          node.getLayer()?.batchDraw()
        }
        return
      }
      const position = getDragPosition(node)
      onDragEnd(position.x, position.y)
    },
  }
}
