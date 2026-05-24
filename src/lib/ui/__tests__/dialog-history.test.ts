import { afterEach, describe, expect, it, vi } from 'vitest'

import { DIALOG_HISTORY_MARKER, stripDialogHistoryMarker } from '@/lib/ui/dialog-history'

describe('stripDialogHistoryMarker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes the dialog marker via replaceState without navigating', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      history: {
        state: { [DIALOG_HISTORY_MARKER]: true, foo: 'bar' },
        replaceState,
      },
    })

    stripDialogHistoryMarker()

    expect(replaceState).toHaveBeenCalledWith({ foo: 'bar' }, '')
  })

  it('is a no-op when the marker is absent', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      history: {
        state: { foo: 'bar' },
        replaceState,
      },
    })

    stripDialogHistoryMarker()

    expect(replaceState).not.toHaveBeenCalled()
  })
})
