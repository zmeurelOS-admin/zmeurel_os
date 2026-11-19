import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { BottomSheet } from '@/components/kit/BottomSheet'
import { DIALOG_HISTORY_MARKER } from '@/lib/ui/dialog-history'

function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Deschide
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Confirmă livrarea" footer={<button type="button">Da, livrat</button>}>
        <p>Conținutul foii</p>
      </BottomSheet>
    </>
  )
}

afterEach(() => {
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

  it('pune un marcaj în istoric, iar „înapoi” închide foaia', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    expect(window.history.state?.[DIALOG_HISTORY_MARKER]).toBe(true)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('la închiderea din buton, marcajul din istoric e scos fără navigare înapoi', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Deschide' }))
    await screen.findByRole('dialog')
    const lengthWhileOpen = window.history.length

    await user.click(screen.getByRole('button', { name: 'Închide' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.history.state?.[DIALOG_HISTORY_MARKER]).toBeUndefined()
    expect(window.history.length).toBe(lengthWhileOpen)
  })

  it('Esc închide foaia', async () => {
    const user = userEvent.setup()
    render(<Harness initialOpen />)

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
