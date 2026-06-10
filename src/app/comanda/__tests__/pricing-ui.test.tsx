import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShopClient } from '@/app/comanda/ShopClient'
import { CAMPAIGN_DATA } from '@/lib/shop/campaign-mock'

describe('ShopClient volume pricing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('actualizează live totalul pentru stepper și cantitățile rapide', async () => {
    const user = userEvent.setup()

    render(
      <ShopClient
        loadError={null}
        products={[
          {
            id: 'zmeura',
            name: 'Zmeură',
            description: 'Zmeură proaspătă',
            unit_label: 'Caserolă 500 g',
            price_lei: 18,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    expect(screen.getAllByText('1 caserolă · 0,5 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('18 lei').length).toBeGreaterThan(0)
    expect(screen.getByText('1 caserolă · 500 g')).toBeInTheDocument()
    expect(screen.getByText('2 caserole · 1 kg')).toBeInTheDocument()
    expect(screen.getByText('-1 leu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Alege 2 caserole' }))
    expect(screen.getAllByText('2 caserole · 1 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('35 lei').length).toBeGreaterThan(0)
    expect(screen.queryByText(/economisești/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Crește cantitatea' }))
    expect(screen.getAllByText('3 caserole · 1,5 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('53 lei').length).toBeGreaterThan(0)
  })

  it('blochează submit-ul pentru identitate invalidă și afișează detaliile de ridicare', async () => {
    const user = userEvent.setup()

    render(
      <ShopClient
        loadError={null}
        products={[
          {
            id: 'zmeura',
            name: 'Zmeură',
            description: 'Zmeură proaspătă',
            unit_label: 'Caserolă 500 g',
            price_lei: 18,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Precomandă acum' }))

    expect(
      screen.getByText(
        'Aceasta este o precomandă. Vei fi contactat telefonic pentru confirmare. Plata se face cash la livrare, nu în avans.',
      ),
    ).toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: 'Trimite precomanda' })
    expect(submitButton).toBeDisabled()

    const phoneInput = screen.getByPlaceholderText('07xx xxx xxx')
    expect(phoneInput).toHaveFocus()
    expect(screen.getByText('Dacă ai mai comandat, completăm datele automat.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Nume' }), 'Ion Popescu')
    await user.type(phoneInput, '0622123456')
    expect(screen.getByText('Introdu un număr de telefon valid (07xxxxxxxx)')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await user.clear(phoneInput)
    await user.type(phoneInput, '+40 722 123 456')
    expect(submitButton).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Ridicare' }))
    expect(screen.queryByRole('textbox', { name: 'Adresă livrare' })).not.toBeInTheDocument()
    expect(screen.getByText('Ridicare zilnic 9:00–18:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vezi pe hartă' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/?api=1&query='),
    )
  })

  it('trimite campaign_id și afișează felicitarea din răspunsul API', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/shop/b2c/order')) {
          return new Response(
            JSON.stringify({
              success: true,
              order_id: 'order-1',
              total_lei: 35,
              hit_milestone: true,
              milestone_threshold: 500,
              milestone_reward: 'un coș cu produse locale',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        return new Response(JSON.stringify({ found: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    )
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(window, 'open').mockReturnValue(null)

    render(
      <ShopClient
        loadError={null}
        products={[
          {
            id: 'zmeura',
            name: 'Zmeură',
            description: 'Zmeură proaspătă',
            unit_label: 'Caserolă 500 g',
            price_lei: 18,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Alege 2 caserole' }))
    await user.click(screen.getByRole('button', { name: 'Precomandă acum' }))
    await user.type(screen.getByRole('textbox', { name: 'Nume' }), 'Ion Popescu')
    await user.type(screen.getByPlaceholderText('07xx xxx xxx'), '0722123456')
    await user.click(screen.getByRole('button', { name: 'Ridicare' }))
    await user.click(screen.getByRole('button', { name: 'Trimite precomanda' }))

    expect(await screen.findByText('Felicitări!')).toBeInTheDocument()
    const checkoutSheet = screen.getByRole('dialog')
    expect(within(checkoutSheet).getByText(/Comanda ta a trecut pragul de/)).toBeInTheDocument()
    expect(within(checkoutSheet).getByText('un coș cu produse locale')).toBeInTheDocument()

    const orderCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes('/api/shop/b2c/order'),
    )
    expect(JSON.parse(String(orderCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        campaign_id: CAMPAIGN_DATA.campaignId,
      }),
    )
  })
})
