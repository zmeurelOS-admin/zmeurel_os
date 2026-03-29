function canVibrate() {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

function vibrate(pattern: number | number[]) {
  if (canVibrate()) {
    navigator.vibrate(pattern)
  }
}

export function hapticSuccess() {
  vibrate(10)
}

export function hapticConfirm() {
  vibrate(10)
}

export function hapticError() {
  vibrate([10, 24, 10])
}

