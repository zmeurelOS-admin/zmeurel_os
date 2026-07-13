export type ViewportDropdownLayout = {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

type AnchorRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>

type VisibleViewport = {
  top: number
  left: number
  height: number
  width: number
  layoutHeight: number
}

export function calculateViewportDropdownLayout(
  anchor: AnchorRect,
  viewport: VisibleViewport,
  options: {
    flipBelow?: number
    safetyMargin?: number
    sideOffset?: number
  } = {},
): ViewportDropdownLayout {
  const flipBelow = options.flipBelow ?? 250
  const safetyMargin = options.safetyMargin ?? 16
  const sideOffset = options.sideOffset ?? 4
  const viewportBottom = viewport.top + viewport.height
  const viewportRight = viewport.left + viewport.width
  const availableAbove = Math.max(0, anchor.top - viewport.top)
  const availableBelow = Math.max(0, viewportBottom - anchor.bottom)
  const openAbove = availableBelow < flipBelow
  const maxHeight = Math.max(
    0,
    Math.floor((openAbove ? availableAbove : availableBelow) - safetyMargin),
  )
  const width = Math.max(0, Math.min(anchor.width, viewport.width - safetyMargin * 2))
  const left = Math.min(
    Math.max(anchor.left, viewport.left + safetyMargin),
    Math.max(viewport.left + safetyMargin, viewportRight - safetyMargin - width),
  )

  return openAbove
    ? {
        left,
        width,
        maxHeight,
        bottom: Math.max(0, viewport.layoutHeight - anchor.top + sideOffset),
      }
    : {
        left,
        width,
        maxHeight,
        top: anchor.bottom + sideOffset,
      }
}
