import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComenziDinMesajSheet } from '@/app/(dashboard)/comenzi/ComenziDinMesajSheet'
import type { ClientMatchSummary } from '@/lib/comenzi/ai-order-client'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const {
  fetchMock,
  pushMock,
  createCliențiMock,
  createComandaMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  pushMock: vi.fn(),
  createCliențiMock: vi.fn(),
  createComandaMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/comenzi',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

vi.mock('@/lib/supabase/queries/clienti', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/clienti')>()
  return {
    ...actual,
    createClienți: createCliențiMock,
  }
})

vi.mock('@/lib/supabase/queries/comenzi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/comenzi')>()
  return {
    ...actual,
    createComanda: createComandaMock,
  }
})

const existingClient: ClientMatchSummary = {
  id: 'client-1',
  nume_client: 'Maria Popescu',
  telefon: '0740123456',
  adresa: 'Burdujeni',
  tip: 'standard',
  pret_negociat_lei_kg: 23,
}

const duplicatePhoneClients: ClientMatchSummary[] = [
  existingClient,
  {
    id: 'client-2',
    nume_client: 'Maria Duplicat',
    telefon: '0740123456',
    adresa: 'Burdujeni 2',
    tip: 'standard',
    pret_negociat_lei_kg: null,
  },
]

const createdOrder: Comanda = {
  id: 'order-1',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_nume_manual: null,
  telefon: '0740123456',
  locatie_livrare: 'Str. Vișinilor 10, Burdujeni',
  data_comanda: '2026-06-19',
  data_livrare: '2026-06-20',
  cantitate_kg: 2,
  pret_per_kg: 23,
  total: 46,
  status: 'confirmata',
  observatii: 'Sună înainte',
  linked_vanzare_id: null,
  parent_comanda_id: null,
  created_at: '2026-06-19T09:00:00.000Z',
  updated_at: '2026-06-19T09:00:00.000Z',
  data_origin: null,
  client_nume: 'Maria Popescu',
}

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

function SheetHarness({
  clienti = [],
  onCreated,
}: {
  clienti?: ClientMatchSummary[]
  onCreated?: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Redeschide
      </button>
      <ComenziDinMesajSheet
        open={open}
        clienti={clienti}
        onOpenChange={setOpen}
        onComandaCreata={onCreated}
      />
    </div>
  )
}

async function analyzeMessage(response: Record<string, unknown>) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => response,
  })

  const user = userEvent.setup()

  await user.type(
    screen.getByPlaceholderText('Lipește mesajul clientului (WhatsApp, SMS, orice...)'),
    'Vreau comandă',
  )
  await user.click(screen.getByRole('button', { name: /Extrage datele/i }))

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  return user
}

describe('ComenziDinMesajSheet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    pushMock.mockReset()
    createCliențiMock.mockReset()
    createComandaMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
  })

  it('telefon existent la un singur client => preia numele din baza de date și creează comanda cu client_id', async () => {
    createComandaMock.mockResolvedValueOnce(createdOrder)

    renderWithClient(<SheetHarness clienti={[existingClient]} />)
    const user = await analyzeMessage({
      nume_client: 'Alt Nume Din AI',
      telefon: '0740123456',
      localitate: 'Burdujeni',
      adresa: 'Str. Vișinilor 10',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-20',
      observatii: 'Sună înainte',
      incredere: 'mare',
      campuri_lipsa: [],
    })

    expect(screen.getByText('Client existent găsit după telefon')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Client' })).toHaveValue('Maria Popescu')
    expect(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' })).toHaveValue(23)

    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() =>
      expect(createComandaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'client-1',
          client_nume_manual: null,
          telefon: '0740123456',
          locatie_livrare: 'Str. Vișinilor 10, Burdujeni',
          data_livrare: '2026-06-20',
          cantitate_kg: 2,
          pret_per_kg: 23,
          status: 'confirmata',
        }),
      ),
    )
    expect(createCliențiMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('telefon inexistent => permite editarea și creează client nou înainte de comandă', async () => {
    createCliențiMock.mockResolvedValueOnce({ id: 'client-new' })
    createComandaMock.mockResolvedValueOnce({
      ...createdOrder,
      id: 'order-new',
      client_id: 'client-new',
      client_nume: 'Client Nou',
      telefon: '0740111222',
    })

    renderWithClient(<SheetHarness clienti={[]} />)
    const user = await analyzeMessage({
      nume_client: 'Client Nou',
      telefon: '0740111222',
      localitate: 'Ipotești',
      adresa: 'Str. Florilor 4',
      cantitate: 4,
      unitate: 'caserole',
      data_livrare: '2026-06-21',
      observatii: null,
      incredere: 'medie',
      campuri_lipsa: [],
    })

    expect(screen.getByText('Client nou / negăsit')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Client' })).toHaveValue('Client Nou')
    expect(screen.getByRole('spinbutton', { name: 'Cantitate (kg)' })).toHaveValue(2)

    await user.type(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' }), '19')
    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() =>
      expect(createCliențiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nume_client: 'Client Nou',
          telefon: '0740111222',
          adresa: 'Str. Florilor 4, Ipotești',
        }),
      ),
    )
    await waitFor(() =>
      expect(createComandaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'client-new',
          telefon: '0740111222',
          locatie_livrare: 'Str. Florilor 4, Ipotești',
          pret_per_kg: 19,
        }),
      ),
    )
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('lipsă nume => câmpul rămâne editabil și blochează crearea până este completat', async () => {
    renderWithClient(<SheetHarness clienti={[]} />)
    const user = await analyzeMessage({
      nume_client: null,
      telefon: '0740111222',
      localitate: 'Suceava',
      adresa: 'Str. Florilor',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-21',
      observatii: null,
      incredere: 'medie',
      campuri_lipsa: ['nume_client'],
    })

    expect(screen.getByRole('textbox', { name: 'Client' })).toHaveValue('')
    await user.type(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' }), '20')
    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() =>
      expect(screen.getByText('Completează numele clientului.')).toBeInTheDocument(),
    )
    expect(createCliențiMock).not.toHaveBeenCalled()
    expect(createComandaMock).not.toHaveBeenCalled()
  })

  it('lipsă telefon => nu creează client sau comandă direct și afișează eroare clară', async () => {
    renderWithClient(<SheetHarness clienti={[]} />)
    const user = await analyzeMessage({
      nume_client: 'Client fără telefon',
      telefon: null,
      localitate: 'Suceava',
      adresa: 'Str. Florilor',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-21',
      observatii: null,
      incredere: 'medie',
      campuri_lipsa: ['telefon'],
    })

    await user.type(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' }), '20')
    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() =>
      expect(screen.getByText('Completează telefonul clientului.')).toBeInTheDocument(),
    )
    expect(createCliențiMock).not.toHaveBeenCalled()
    expect(createComandaMock).not.toHaveBeenCalled()
  })

  it('telefon asociat cu mai mulți clienți => nu alege automat primul client și blochează salvarea directă', async () => {
    renderWithClient(<SheetHarness clienti={duplicatePhoneClients} />)
    const user = await analyzeMessage({
      nume_client: 'Client Ambiguu',
      telefon: '0740123456',
      localitate: 'Burdujeni',
      adresa: 'Str. Vișinilor 10',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-20',
      observatii: null,
      incredere: 'medie',
      campuri_lipsa: [],
    })

    expect(screen.getByText('Client neclar — verifică manual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deschide formularul complet' })).toBeInTheDocument()

    await user.type(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' }), '20')
    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() =>
      expect(
        screen.getByText('Telefonul este asociat cu mai mulți clienți. Alege clientul manual din formularul complet.'),
      ).toBeInTheDocument(),
    )
    expect(createCliențiMock).not.toHaveBeenCalled()
    expect(createComandaMock).not.toHaveBeenCalled()
  })

  it('după creare reușită închide sheet-ul, resetează starea și la redeschidere textarea este goală', async () => {
    const onCreated = vi.fn()
    createCliențiMock.mockResolvedValueOnce({ id: 'client-new' })
    createComandaMock.mockResolvedValueOnce({
      ...createdOrder,
      id: 'order-created',
      client_id: 'client-new',
      telefon: '0740111222',
    })

    renderWithClient(<SheetHarness clienti={[]} onCreated={onCreated} />)
    const user = await analyzeMessage({
      nume_client: 'Client Nou',
      telefon: '0740111222',
      localitate: 'Ipotești',
      adresa: 'Str. Florilor 4',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-21',
      observatii: null,
      incredere: 'mare',
      campuri_lipsa: [],
    })

    await user.type(screen.getByRole('spinbutton', { name: 'Preț (lei/kg)' }), '18')
    await user.click(screen.getByRole('button', { name: 'Creează comanda' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('order-created'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Lipește mesajul clientului (WhatsApp, SMS, orice...)')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Redeschide' }))

    const textarea = await screen.findByPlaceholderText('Lipește mesajul clientului (WhatsApp, SMS, orice...)')
    expect(textarea).toHaveValue('')
    expect(screen.queryByText('AI-ul a extras datele cu încredere mare')).not.toBeInTheDocument()
  })

  it('butonul principal după extracție este Creează comanda și fluxul normal nu pune PII în URL', async () => {
    renderWithClient(<SheetHarness clienti={[existingClient]} />)
    await analyzeMessage({
      nume_client: 'Maria Popescu',
      telefon: '0740123456',
      localitate: 'Burdujeni',
      adresa: 'Str. Vișinilor 10',
      cantitate: 2,
      unitate: 'kg',
      data_livrare: '2026-06-20',
      observatii: 'Sună înainte',
      incredere: 'mare',
      campuri_lipsa: [],
    })

    expect(screen.getByRole('button', { name: 'Creează comanda' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continuă în formular/i })).not.toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('păstrează mesajele pentru încredere și câmpuri lipsă în mini-formular', async () => {
    renderWithClient(<SheetHarness clienti={[]} />)
    await analyzeMessage({
      nume_client: null,
      telefon: null,
      localitate: null,
      adresa: null,
      cantitate: null,
      unitate: null,
      data_livrare: null,
      observatii: null,
      incredere: 'mica',
      campuri_lipsa: ['telefon', 'localitate', 'data_livrare'],
    })

    expect(
      screen.getByText('Date incomplete sau nesigure. Completează manual înainte de salvare.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Lipsește telefonul/)).toBeInTheDocument()
    expect(screen.getByText(/Lipsește localitatea/)).toBeInTheDocument()
    expect(screen.getByText(/Lipsește data la care clientul vrea livrarea/)).toBeInTheDocument()
  })

  it('afișează mesaj clar pentru RATE_LIMITED și păstrează textul lipit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Ai făcut prea multe încercări. Așteaptă puțin și încearcă din nou.',
        },
      }),
    })

    const user = userEvent.setup()

    renderWithClient(<SheetHarness clienti={[]} />)

    const textarea = screen.getByPlaceholderText('Lipește mesajul clientului (WhatsApp, SMS, orice...)')
    await user.type(textarea, 'Mesaj care trebuie păstrat')
    await user.click(screen.getByRole('button', { name: /Extrage datele/i }))

    await waitFor(() =>
      expect(
        screen.getByText('Ai făcut prea multe încercări. Așteaptă puțin și încearcă din nou.'),
      ).toBeInTheDocument(),
    )
    expect(textarea).toHaveValue('Mesaj care trebuie păstrat')
    expect(screen.queryByText('Date extrase')).not.toBeInTheDocument()
  })
})
