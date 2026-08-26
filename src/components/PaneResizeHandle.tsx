import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const KEYBOARD_STEP_PX = 16
const DOUBLE_PRESS_MS = 400
const DOUBLE_PRESS_PX = 4

export const PANE_RESIZE_BODY_CLASS = 'is-pane-resizing'

type PaneResizeHandleProps = {
  ariaLabel: string
  edge?: 'start' | 'end'
  onDrag: (deltaX: number) => void
  onReset: () => void
}

function setPaneResizing(active: boolean) {
  document.body.classList.toggle(PANE_RESIZE_BODY_CLASS, active)
}

export function PaneResizeHandle({
  ariaLabel,
  edge = 'end',
  onDrag,
  onReset,
}: PaneResizeHandleProps) {
  const lastXRef = useRef(0)
  const draggingRef = useRef(false)
  const lastPressRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const stopResizing = useCallback((event?: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    setDragging(false)
    setPaneResizing(false)
    const node = event?.currentTarget
    if (node && event && node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId)
    }
  }, [])

  useEffect(() => {
    const onBlur = () => {
      draggingRef.current = false
      setDragging(false)
      setPaneResizing(false)
    }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      setPaneResizing(false)
    }
  }, [])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()

    const now = event.timeStamp
    const last = lastPressRef.current
    if (
      last &&
      now - last.time < DOUBLE_PRESS_MS &&
      Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_PRESS_PX
    ) {
      lastPressRef.current = null
      stopResizing(event)
      onReset()
      return
    }
    lastPressRef.current = { time: now, x: event.clientX, y: event.clientY }

    event.currentTarget.setPointerCapture(event.pointerId)
    lastXRef.current = event.clientX
    draggingRef.current = true
    setDragging(true)
    setPaneResizing(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const deltaX = event.clientX - lastXRef.current
    lastXRef.current = event.clientX
    if (deltaX !== 0) onDrag(deltaX)
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
      onKeyDown={onKeyDown}
      onLostPointerCapture={() => stopResizing()}
      onPointerCancel={stopResizing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopResizing}
      role="separator"
      tabIndex={0}
    />
  )
}
