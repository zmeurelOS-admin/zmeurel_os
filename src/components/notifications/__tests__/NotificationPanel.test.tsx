import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import type { Database } from '@/types/supabase'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

type NotificationRow = Database['public']['Tables']['notifications']['Row']

function notification(
  id: string,
  read: boolean,
  title: string,
  body = 'Detalii notificare',
): NotificationRow {
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

function renderPanel(notifications: NotificationRow[]) {
  return render(
    <NotificationPanel
      notifications={notifications}
      onMarkAllRead={vi.fn(async () => undefined)}
      onMarkRead={vi.fn(async () => undefined)}
      onClose={vi.fn()}
    />,
  )
}

describe('NotificationPanel', () => {
  it('evidențiază notificarea necitită cu bară, punct, titlu bold și oră accentuată', () => {
    renderPanel([notification('unread-1', false, 'Comandă nouă')])

    const title = screen.getByText('Comandă nouă')
    const row = title.closest('button')
    expect(row).toHaveClass('border-l-4', 'border-l-[var(--primary)]')
    expect(row?.querySelector('[data-unread-indicator]')).toBeInTheDocument()
    expect(title).toHaveClass('font-bold', 'text-[var(--text-primary)]')
    expect(within(row as HTMLElement).getByText('acum')).toHaveClass(
      'font-medium',
      'text-[var(--primary)]',
    )
  })

  it('estompează notificarea citită și elimină indicatorii de necitit', () => {
    renderPanel([notification('read-1', true, 'Comandă procesată')])

    const title = screen.getByText('Comandă procesată')
    const row = title.closest('button')
    expect(row).toHaveClass('border-l-4', 'border-l-transparent')
    expect(row).not.toHaveClass('border-l-[var(--primary)]')
    expect(row?.querySelector('[data-unread-indicator]')).not.toBeInTheDocument()
    expect(title).toHaveClass('font-medium', 'text-[var(--text-muted)]')
    expect(screen.getByText('Detalii notificare')).toHaveClass(
      'text-[var(--text-muted)]',
      'opacity-70',
    )
    expect(within(row as HTMLElement).getByText('acum')).toHaveClass('text-[var(--text-muted)]')
  })

  it('calculează subtitlul din notificările vizibile cu pluralizare corectă', () => {
    renderPanel([
      notification('unread-1', false, 'Necitită 1'),
      notification('unread-2', false, 'Necitită 2'),
      notification('read-1', true, 'Citită'),
    ])

    expect(screen.getByText('2 necitite · 1 citită')).toBeInTheDocument()
  })

  it('actualizează subtitlul și stilurile după marcarea tuturor ca citite', async () => {
    const user = userEvent.setup()
    const onMarkAllRead = vi.fn(async () => undefined)
    const initialNotifications = [
      notification('unread-1', false, 'Necitită 1'),
      notification('unread-2', false, 'Necitită 2'),
      notification('read-1', true, 'Citită'),
    ]

    function Harness() {
      const [notifications, setNotifications] = useState(initialNotifications)

      return (
        <NotificationPanel
          notifications={notifications}
          onMarkAllRead={async () => {
            await onMarkAllRead()
            setNotifications((current) =>
              current.map((notificationItem) => ({ ...notificationItem, read: true })),
            )
          }}
          onMarkRead={vi.fn(async () => undefined)}
          onClose={vi.fn()}
        />
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Marchează toate ca citite' }))

    expect(onMarkAllRead).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.getByText('0 necitite · 3 citite')).toBeInTheDocument()
    })
    expect(document.querySelectorAll('[data-unread-indicator]')).toHaveLength(0)
    for (const title of ['Necitită 1', 'Necitită 2', 'Citită']) {
      expect(screen.getByText(title)).toHaveClass('font-medium', 'text-[var(--text-muted)]')
    }
  })
})
