import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GustCheckoutForm } from '@/components/shop/association/cart/GustCheckoutForm'
import type { GustCartItem } from '@/components/shop/association/cart/gustCartTypes'

const postShopOrderWithRetry = vi.fn()
vi.mock('@/lib/shop/association/checkout-fetch', () => ({
  postShopOrderWithRetry: (body: object) => postShopOrderWithRetry(body),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const TID = 'aa000000-0000-4000-8000-000000000001'
const PID = 'aa000000-0000-4000-8000-000000000002'

const cartItems: GustCartItem[] = [
  {
    id: PID,
    name: 'Zmeură',
    price: 12,
    unit: 'kg',
    category: 'fruct',
    qty: 2,
    tenantId: TID,
    farmName: 'Ferma Test',
    moneda: 'RON',
  },
]

describe('GustCheckoutForm — flux checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submit trimite body cu channel association_shop și afișează succes la 200', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    postShopOrderWithRetry.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          orderIds: ['o1'],
          totalLei: 24,
          linesSubtotalLei: 24,
          cartDeliveryFeeLei: 15,
          deliveryDateIso: '2026-04-08',
          currency: 'RON',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(<GustCheckoutForm items={cartItems} onBack={vi.fn()} onComplete={onComplete} />)

    fireEvent.change(document.querySelector('input[autocomplete="name"]')!, {
      target: { value: 'Maria Ionescu' },
    })
    fireEvent.change(document.querySelector('input[autocomplete="tel"]')!, {
      target: { value: '0722123456' },
    })
    fireEvent.change(document.querySelector('input[autocomplete="street-address"]')!, {
      target: { value: 'Suceava, str. Principală 10' },
    })
    await user.click(screen.getByRole('radio', { name: /WhatsApp/i }))

    await user.click(screen.getByRole('button', { name: /Plaseaz[ăa] comanda cu obliga[țt]ie de plat[ăa]/i }))

    expect(postShopOrderWithRetry).toHaveBeenCalled()
    const body = postShopOrderWithRetry.mock.calls[0]?.[0] as {
      channel: string
      tenantId: string
      lines: { produsId: string; qty: number }[]
      cartSubtotalLei: number
      associationCheckoutPart: { farmIndex: number; farmCount: number }
      canal_confirmare: string
      save_consent: boolean
    }
    expect(body.channel).toBe('association_shop')
    expect(body.tenantId).toBe(TID)
    expect(body.lines).toEqual([{ produsId: PID, qty: 2 }])
    expect(body.cartSubtotalLei).toBe(24)
    expect(body.associationCheckoutPart).toEqual({ farmIndex: 0, farmCount: 1 })
    expect(body.canal_confirmare).toBe('whatsapp')
    expect(body.save_consent).toBe(true)

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        orderIds: ['o1'],
        totalLei: 24,
        deliveryFeeLei: 15,
        grandTotalLei: 39,
        currency: 'RON',
        farmCount: 1,
        canalComunicare: 'whatsapp',
      }),
    )
  })

  it('afișează eroare după răspuns eșuat (ex. 500)', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    postShopOrderWithRetry.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'Server indisponibil' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<GustCheckoutForm items={cartItems} onBack={vi.fn()} onComplete={onComplete} />)

    fireEvent.change(document.querySelector('input[autocomplete="name"]')!, {
      target: { value: 'Maria Ionescu' },
    })
    fireEvent.change(document.querySelector('input[autocomplete="tel"]')!, {
      target: { value: '0722123456' },
    })
    fireEvent.change(document.querySelector('input[autocomplete="street-address"]')!, {
      target: { value: 'Suceava, str. Principală 10' },
    })
    await user.click(screen.getByRole('radio', { name: /WhatsApp/i }))

    await user.click(screen.getByRole('button', { name: /Plaseaz[ăa] comanda cu obliga[țt]ie de plat[ăa]/i }))

    expect(await screen.findByText('Server indisponibil')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('butonul ramane dezactivat pana este ales un canal de comunicare', () => {
    render(<GustCheckoutForm items={cartItems} onBack={vi.fn()} onComplete={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: /Plaseaz[ăa] comanda cu obliga[țt]ie de plat[ăa]/i }),
    ).toBeDisabled()
  })
})
