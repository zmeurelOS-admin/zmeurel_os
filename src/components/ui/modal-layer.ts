'use client'

import * as React from 'react'

const MODAL_OPEN_ATTR = 'data-modal-open'
const MODAL_COUNT_ATTR = 'data-modal-count'

function readModalCount(root: HTMLElement) {
  const value = Number(root.getAttribute(MODAL_COUNT_ATTR) ?? '0')
  return Number.isFinite(value) ? value : 0
}

function writeModalCount(root: HTMLElement, count: number) {
  if (count <= 0) {
    root.removeAttribute(MODAL_OPEN_ATTR)
    root.removeAttribute(MODAL_COUNT_ATTR)
    return
  }

  root.setAttribute(MODAL_OPEN_ATTR, 'true')
  root.setAttribute(MODAL_COUNT_ATTR, String(count))
}

function incrementModalCount() {
  const root = document.documentElement
  writeModalCount(root, readModalCount(root) + 1)
}

function decrementModalCount() {
  const root = document.documentElement
  writeModalCount(root, Math.max(0, readModalCount(root) - 1))
}

export function useDocumentModalState(open: boolean) {
  const isRegisteredRef = React.useRef(false)

  React.useEffect(() => {
    if (typeof document === 'undefined' || !open) return

    incrementModalCount()
    isRegisteredRef.current = true

    return () => {
      if (!isRegisteredRef.current) return
      decrementModalCount()
      isRegisteredRef.current = false
    }
  }, [open])
}
