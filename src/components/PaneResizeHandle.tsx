import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const KEYBOARD_STEP_PX = 16

type PaneResizeHandleProps = {
  ariaLabel: string
  edge?: 'start' | 'end'
  onDrag: (deltaX: number) => void
  onReset: () => void
}

export function PaneResizeHandle({
  ariaLabel,
  edge = 'end',
  onDrag,
  onReset,
}: PaneResizeHandleProps) {
  const lastXRef = useRef(0)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    lastXRef.current = event.clientX
    draggingRef.current = true
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const deltaX = event.clientX - lastXRef.current
    lastXRef.current = event.clientX
    if (deltaX !== 0) onDrag(deltaX)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onDrag(-KEYBOARD_STEP_PX)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      onDrag(KEYBOARD_STEP_PX)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onReset()
    }
  }

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      className={`pane-resize-handle no-drag${dragging ? ' is-dragging' : ''}`}
      data-edge={edge}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      tabIndex={0}
    />
  )
}
