import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface VirtualIconGridProps<T> {
  items: readonly T[]
  /** Height of one row in pixels — every cell is the same height by design. */
  rowHeight: number
  /** Narrowest a cell may get before the grid drops to fewer columns. */
  minCellWidth: number
  renderCell: (item: T) => ReactNode
  keyOf: (item: T) => string
  /** Shown in place of the grid when there is nothing to draw. */
  emptyState?: ReactNode
  className?: string
}

/** Rows drawn beyond the viewport, so a flick does not reveal empty space. */
const OVERSCAN_ROWS = 3

/**
 * A scroller that only mounts the rows you can see.
 *
 * The icon picker lists 4,403 symbols. Mounting them all is 4,403 DOM nodes
 * and a visibly janky scroll on a phone; capping the list means a person
 * cannot browse the catalogue at all. Virtualising is what lets both be true:
 * the scrollbar reflects the real count, and about thirty cells exist.
 *
 * Deliberately not a library. The whole behaviour is a scroll offset, a row
 * height and a slice — a dependency for that would cost more to carry than
 * to write.
 */
export function VirtualIconGrid<T>({
  items, rowHeight, minCellWidth, renderCell, keyOf, emptyState, className,
}: VirtualIconGridProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [metrics, setMetrics] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)

  // Measured rather than assumed: the picker is in a modal that changes width
  // with the viewport, and a phone rotating is a resize, not a remount.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setMetrics({ width: box.width, height: box.height })
    })
    observer.observe(element)
    setMetrics({ width: element.clientWidth, height: element.clientHeight })
    return () => observer.disconnect()
  }, [])

  // A new result set starts at the top; staying at the old offset would show
  // a blank screen when the new list is shorter than the scroll position.
  // Derived in render rather than in an effect so the first frame of the new
  // list is already at the top — an effect would paint one frame of blank.
  const [lastItems, setLastItems] = useState(items)
  if (lastItems !== items) {
    setLastItems(items)
    setScrollTop(0)
  }
  // The element's own scroll position is the DOM's, not React's, so it is
  // reset here rather than in render.
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0
  }, [items])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const columns = Math.max(1, Math.floor(metrics.width / minCellWidth) || 1)
  const rows = Math.ceil(items.length / columns)
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS)
  const visibleRows = Math.ceil(metrics.height / rowHeight) + OVERSCAN_ROWS * 2
  const lastRow = Math.min(rows, firstRow + visibleRows)
  const slice = items.slice(firstRow * columns, lastRow * columns)

  return (
    <div ref={viewportRef} className={className ? `pd-vgrid ${className}` : 'pd-vgrid'} onScroll={handleScroll}>
      {items.length === 0 ? emptyState : (
        // The spacer carries the full height so the scrollbar tells the truth
        // about how much catalogue is left; the grid rides on top of it.
        <div className="pd-vgrid-spacer" style={{ height: rows * rowHeight }}>
          <div
            className="pd-vgrid-rows"
            style={{
              transform: `translateY(${firstRow * rowHeight}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridAutoRows: `${rowHeight}px`,
            }}
          >
            {slice.map((item) => <div key={keyOf(item)} className="pd-vgrid-cell">{renderCell(item)}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
