/** History marker pushed by `Dialog` (and some mobile sheets) for Android back handling. */
export const DIALOG_HISTORY_MARKER = '__zmeurelDialog' as const

/**
 * Removes the dialog history marker from the current entry without navigating.
 * Use before programmatic close (Cancel / X) so cleanup does not call `history.back()`
 * and pop parent routes (e.g. parcel sheet or parcel list).
 */
export function stripDialogHistoryMarker(): void {
  if (typeof window === 'undefined') return
  const state = window.history.state
  if (!state?.[DIALOG_HISTORY_MARKER]) return

  const cleanedState = { ...state }
  delete cleanedState[DIALOG_HISTORY_MARKER]
  window.history.replaceState(cleanedState, '')
}

/**
 * Închide un overlay (Dialog / sheet cu history) fără navigare accidentală.
 * Apelează strip înainte de `onOpenChange(false)` ca să nu rămână marker pe stack.
 */
export function closeOverlay(onOpenChange?: (open: boolean) => void): void {
  stripDialogHistoryMarker()
  onOpenChange?.(false)
}
