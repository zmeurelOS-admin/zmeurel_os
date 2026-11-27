import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BottomSheet } from '@/components/kit/BottomSheet'
import { CloseWatcherSimulat, apasaInapoi, dezinstaleazaCloseWatcher, instaleazaCloseWatcher } from '@/test/helpers/close-watcher'

function Harness({ initialOpen = false, inline = false }: { initialOpen?: boolean; inline?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const [, setTick] = useState(0)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Deschide
      </button>
      <button type="button" onClick={() => setTick((value) => value + 1)}>
        Redesenează
      </button>
      <BottomSheet open={open} onOpenChange={inline ? (next) => setOpen(next) : setOpen} title="Confirmă livrarea" footer={<button type="button">Da, livrat</button>}>
        <p>Conținutul foii</p>
      </BottomSheet>
    </>
  )
}

beforeEach(() => {
  instaleazaCloseWatcher()
})

afterEach(() => {
  dezinstaleazaCloseWatcher()
  window.history.replaceState(null, '')
  document.documentElement.removeAttribute('data-modal-open')
  document.documentElement.removeAttribute('data-modal-count')
})

describe('BottomSheet', () => {
  it('se deschide ca fereastră cu titlu, conținut și zonă de jos', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deschide' }))

    const dialog = await screen.findByRole('dialog', { name: 'Confirmă livrarea' })
    expect(dialog).toHaveTextContent('Conținutul foii')
    expect(screen.getByRole('button', { name: 'Da, livrat' })).toBeInTheDocument()
  })

  it('cât e deschisă, marchează pagina (butonul plutitor se ascunde) și curăță la închidere', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(document.documentElement).not.toHaveAttribute('data-modal-open')
    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    expect(document.documentElement).toHaveAttribute('data-modal-open', 'true')

    await user.click(screen.getByRole('button', { name: 'Închide' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.documentElement).not.toHaveAttribute('data-modal-open')
  })

  it('nu scrie în istoric, iar „înapoi” (CloseWatcher) închide foaia', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const lungime = window.history.length

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    expect(window.history.length).toBe(lungime)
    expect(CloseWatcherSimulat.active).toHaveLength(1)

    act(() => {
      apasaInapoi()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.history.length).toBe(lungime)
  })

  it('închiderea din buton nu atinge istoricul și scoate watcher-ul', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const lungime = window.history.length

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Închide' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.history.length).toBe(lungime)
    expect(CloseWatcherSimulat.active).toHaveLength(0)
  })

  it('„înapoi” merge și când pagina dă o funcție nouă la fiecare desenare', async () => {
    const user = userEvent.setup()
    render(<Harness inline />)

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    // Redesenarea dă foii alt `onOpenChange`; înainte, ascultătorul se pierdea aici.
    act(() => {
      ;(screen.getByRole('button', { name: 'Redesenează', hidden: true }) as HTMLButtonElement).click()
    })
    expect(CloseWatcherSimulat.active).toHaveLength(1)
    act(() => {
      apasaInapoi()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('fără CloseWatcher (Safari, Firefox): nimic în istoric, Esc și X închid normal', async () => {
    dezinstaleazaCloseWatcher()
    const user = userEvent.setup()
    render(<Harness />)
    const lungime = window.history.length

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    expect(window.history.length).toBe(lungime)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Închide' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.history.length).toBe(lungime)
  })

  it('Esc închide foaia', async () => {
    const user = userEvent.setup()
    render(<Harness initialOpen />)

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
