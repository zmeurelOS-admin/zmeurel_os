import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import type { NotificareRand } from '@/components/notifications/RandNotificare'

function notification(id: string, read: boolean, title: string, body = 'Detalii notificare'): NotificareRand {
  return {
    id,
    user_id: '11111111-1111-4111-8111-111111111111',
    type: 'order_new',
    title,
    body,
    data: {},
    read,
    created_at: new Date().toISOString(),
    entity_type: 'order',
    entity_id: null,
  }
}

function renderPanel(notifications: NotificareRand[], extra: Partial<React.ComponentProps<typeof NotificationPanel>> = {}) {
  return render(
    <NotificationPanel
      notifications={notifications}
      onMarkAllRead={vi.fn(async () => undefined)}
      onMarkRead={vi.fn(async () => undefined)}
      onClose={vi.fn()}
      {...extra}
    />,
  )
}

describe('NotificationPanel (promptul 33, pe kit)', () => {
  it('pe telefon (în foaie) titlul „Notificări” nu se mai repetă în corp; pe desktop apare o dată', () => {
    const { unmount } = renderPanel([notification('n1', false, 'Comandă nouă')])
    expect(screen.queryByRole('heading', { name: 'Notificări' })).toBeNull()
    unmount()
    renderPanel([notification('n1', false, 'Comandă nouă')], { cuTitlu: true })
    expect(screen.getAllByRole('heading', { name: 'Notificări' })).toHaveLength(1)
  })

  it('rândul comun: necitita are punctul „Necitită”, citita nu', () => {
    renderPanel([notification('n1', false, 'Comandă nouă'), notification('n2', true, 'Comandă procesată')])
    const necitita = screen.getByText('Comandă nouă').closest('button') as HTMLElement
    const citita = screen.getByText('Comandă procesată').closest('button') as HTMLElement
    expect(within(necitita).getByText('Necitită')).toBeTruthy()
    expect(within(citita).queryByText('Necitită')).toBeNull()
    expect(screen.getByText('1 necitită')).toBeTruthy()
  })

  it('„Citește tot” marchează tot; apoi „Le-ai citit pe toate” și butonul dispare', async () => {
    const user = userEvent.setup()
    const onMarkAllRead = vi.fn(async () => undefined)
    function Harness() {
      const [lista, setLista] = useState([notification('a', false, 'Unu'), notification('b', false, 'Doi'), notification('c', true, 'Trei')])
      return (
        <NotificationPanel
          notifications={lista}
          onMarkAllRead={async () => {
            await onMarkAllRead()
            setLista((current) => current.map((item) => ({ ...item, read: true })))
          }}
          onMarkRead={vi.fn(async () => undefined)}
          onClose={vi.fn()}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByText('2 necitite')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Citește tot' }))
    expect(onMarkAllRead).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByText('Le-ai citit pe toate')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Citește tot' })).toBeNull()
    expect(screen.queryAllByText('Necitită')).toHaveLength(0)
  })

  it('atinsă: marchează citit, închide foaia și duce la destinație; „Vezi toate notificările” duce la pagină', async () => {
    const user = userEvent.setup()
    const onMarkRead = vi.fn(async () => undefined)
    const onClose = vi.fn()
    renderPanel([notification('n1', false, 'Comandă nouă')], { onMarkRead, onClose })
    await user.click(screen.getByText('Comandă nouă'))
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(onMarkRead).toHaveBeenCalledWith('n1')
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Vezi toate notificările' }).getAttribute('href')).toBe('/notificari')
  })
})
