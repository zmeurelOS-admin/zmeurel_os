import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShopClient } from '@/app/comanda/ShopClient'
import { CAMPAIGN_DATA } from '@/lib/shop/campaign-mock'

describe('ShopClient volume pricing', () => {
  afterEach(() => {
    window.localStorage.clear()
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
            price_lei: 20,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    expect(screen.getAllByText('1 caserolă · 0,5 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20 lei').length).toBeGreaterThan(0)
    expect(screen.getByText('1 caserolă · 500 g')).toBeInTheDocument()
    expect(screen.getByText('2 caserole · 1 kg')).toBeInTheDocument()
    expect(screen.queryByText('-1 leu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Alege 2 caserole' }))
    expect(screen.getAllByText('2 caserole · 1 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('40 lei').length).toBeGreaterThan(0)
    expect(screen.queryByText(/economisești/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Crește cantitatea' }))
    expect(screen.getAllByText('3 caserole · 1,5 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('60 lei').length).toBeGreaterThan(0)
  })

  it('acceptă cantități introduse direct și normalizează valorile goale la blur', async () => {
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
            price_lei: 20,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    const qtyInput = screen.getByRole('spinbutton', { name: 'Cantitate caserole' })
    await user.clear(qtyInput)
    await user.type(qtyInput, '60')

    expect(qtyInput).toHaveValue(60)
    expect(screen.getAllByText('60 caserole · 30 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1.200 lei').length).toBeGreaterThan(0)

    await user.clear(qtyInput)
    await user.tab()
    expect(qtyInput).toHaveValue(1)

    await user.click(qtyInput)
    await user.clear(qtyInput)
    await user.type(qtyInput, '0')
    expect(screen.getByRole('button', { name: 'Precomandă acum · 20 lei' })).toBeInTheDocument()
    await user.tab()
    expect(qtyInput).toHaveValue(0)
    expect(screen.getByRole('button', { name: 'Precomandă acum · 0 lei' })).toBeInTheDocument()

    await user.click(qtyInput)
    await user.clear(qtyInput)
    await user.type(qtyInput, '201')
    expect(
      screen.getByText(
        'Pentru comenzi mari (peste 200 caserole), te rugăm să ne contactezi telefonic pentru confirmare disponibilitate.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Alege 4 caserole' }))
    expect(qtyInput).toHaveValue(4)

    await user.click(screen.getByRole('button', { name: 'Crește cantitatea' }))
    expect(qtyInput).toHaveValue(5)
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
            price_lei: 20,
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
    expect(screen.getByText('Selectează zona de livrare.')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ridicare' }))
    expect(submitButton).toBeEnabled()
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
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init
        const url = String(input)
        if (url.includes('/api/shop/b2c/order')) {
          return new Response(
            JSON.stringify({
              success: true,
              order_id: 'order-1',
              total_lei: 40,
              current_count: 500,
              hit_milestone: true,
              milestone_threshold: 500,
              milestone_reward: '+2 caserole 500 g',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        return new Response(JSON.stringify({
          currentCount: 498,
          targetQty: CAMPAIGN_DATA.target,
          status: 'active',
          milestones: CAMPAIGN_DATA.milestones.map(({ threshold, rewardLabel, reached }) => ({
            threshold,
            rewardLabel,
            reached,
          })),
          leaderboard: [],
        }), {
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
            price_lei: 20,
            available: true,
            sort_order: 1,
          },
        ]}
      />,
    )

    expect(await screen.findByText('498')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Alege 2 caserole' }))
    await user.click(screen.getByRole('button', { name: 'Precomandă acum' }))
    await user.type(screen.getByRole('textbox', { name: 'Nume' }), 'Ion Popescu')
    await user.type(screen.getByPlaceholderText('07xx xxx xxx'), '0722123456')
    await user.click(screen.getByRole('button', { name: 'Ridicare' }))
    await user.click(screen.getByRole('button', { name: 'Trimite precomanda' }))

    expect(await screen.findByText('Felicitări!')).toBeInTheDocument()
    const checkoutSheet = screen.getByRole('dialog')
    expect(within(checkoutSheet).getByText(/Comanda ta a trecut pragul de/)).toBeInTheDocument()
    expect(within(checkoutSheet).getByText('+2 caserole 500 g')).toBeInTheDocument()
    expect(await screen.findByText('500')).toBeInTheDocument()
    expect(screen.getByText('250 caserole până la pragul 750')).toBeInTheDocument()

    const orderCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes('/api/shop/b2c/order'),
    )
    expect(JSON.parse(String(orderCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        campaign_id: CAMPAIGN_DATA.campaignId,
        idempotencyKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    )
    expect(JSON.parse(String(orderCall?.[1]?.body))).not.toHaveProperty('inSuceava')
  })

  it('aplică live minimul de cantitate pentru zona de livrare', async () => {
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
            price_lei: 20,
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
    await user.click(screen.getByRole('button', { name: 'Livrare' }))

    const submitButton = screen.getByRole('button', { name: 'Trimite precomanda' })
    expect(screen.getByText('Selectează zona de livrare.')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Suceava' }))
    expect(
      screen.queryByText('Comanda minimă pentru livrare în Suceava este de 2 caserole (1 kg).'),
    ).not.toBeInTheDocument()
    expect(submitButton).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'În afara Sucevei' }))
    expect(
      screen.getByText('Comanda minimă pentru livrare în afara Sucevei este de 4 caserole (2 kg).'),
    ).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('cere confirmare pentru o comandă recentă și păstrează aceeași cheie idempotentă', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init
      const url = String(input)
      if (url.includes('/api/shop/b2c/check-recent-order')) {
        return new Response(
          JSON.stringify({
            found: true,
            minutes_ago: 3.6,
            items: [{ qty: 2, label: 'Zmeură — Caserolă 500 g' }],
            total_lei: 40,
            order_kind: 'preorder',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/shop/b2c/order')) {
        return new Response(
          JSON.stringify({
            success: true,
            order_id: 'order-2',
            total_lei: 40,
            current_count: 502,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({
          currentCount: 500,
          targetQty: CAMPAIGN_DATA.target,
          status: 'active',
          milestones: CAMPAIGN_DATA.milestones,
          leaderboard: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
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
            price_lei: 20,
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

    expect(await screen.findByText('Ai mai plasat o comandă recent')).toBeInTheDocument()
    expect(
      screen.getByText('Acum 4 minute ai trimis o comandă de 2 × Zmeură — Caserolă 500 g în valoare de 40 lei.'),
    ).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/api/shop/b2c/order'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Renunț' }))
    expect(screen.queryByText('Ai mai plasat o comandă recent')).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/api/shop/b2c/order'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Trimite precomanda' }))
    expect(await screen.findByText('Ai mai plasat o comandă recent')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Da, trimite comandă nouă' }))

    expect(await screen.findByText('Precomandă înregistrată')).toBeInTheDocument()
    const orderCall = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/api/shop/b2c/order'))
    expect(JSON.parse(String(orderCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    )
  })
})
