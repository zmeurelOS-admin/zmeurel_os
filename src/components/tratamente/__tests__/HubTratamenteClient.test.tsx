import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HubTratamenteClient } from '@/components/tratamente/HubTratamenteClient'
import type {
  JurnalAplicareItem,
  PlanTratament,
  SugestieAstazi,
} from '@/lib/supabase/queries/tratamente'

const {
  createManualInterventieActionMock,
  fetchAplicareEditActionMock,
  registerAddActionMock,
} = vi.hoisted(() => ({
  createManualInterventieActionMock: vi.fn(),
  fetchAplicareEditActionMock: vi.fn(),
  registerAddActionMock: vi.fn(() => vi.fn()),
}))

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock('@/app/(dashboard)/tratamente/actions', () => ({
  createManualInterventieAction: (...args: unknown[]) => createManualInterventieActionMock(...args),
  fetchAplicareEditAction: (...args: unknown[]) => fetchAplicareEditActionMock(...args),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

vi.mock('@/contexts/AddActionContext', () => ({
  useAddAction: () => ({
    registerAddAction: registerAddActionMock,
    triggerAddAction: vi.fn(),
    currentLabel: '+ Stropit acum',
    hasAction: true,
  }),
}))

vi.mock('@/components/tratamente/AddInterventieFAB', () => ({
  AddInterventieFAB: () => <div data-testid="add-interventie-fab" />,
}))

vi.mock('@/components/tratamente/IntervenitiePickerSheet', () => ({
  IntervenitiePickerSheet: ({
    open,
    onPick,
  }: {
    open: boolean
    onPick: (metoda: string) => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Alege metoda">
        <button type="button" onClick={() => onPick('foliar')}>
          Foliar
        </button>
      </div>
    ) : null,
}))

vi.mock('@/components/tratamente/MarkAplicataSheet', () => ({
  MarkAplicataSheet: ({
    open,
    mode,
    defaultMetoda,
    aplicareExistenta,
  }: {
    open: boolean
    mode?: string
    defaultMetoda?: string | null
    aplicareExistenta?: { id: string } | null
  }) =>
    open ? (
      <div
        data-testid="mark-aplicata-sheet"
        data-mode={mode ?? ''}
        data-default-metoda={defaultMetoda ?? ''}
        data-aplicare-id={aplicareExistenta?.id ?? ''}
      >
        {mode === 'edit' ? 'Editează aplicare' : 'Stropit acum'}
      </div>
    ) : null,
}))

function makeSugestie(): SugestieAstazi {
  return {
    parcela: { id: 'parcela-1', nume: 'Maravilla' },
    fenofazaCurenta: 'inflorit',
    metoda: 'foliar',
    titlu: 'Botritis preventiv',
    produs: { nume: 'Switch 62.5 WG', dozaText: '0.6 kg/ha' },
    sursa: 'plan',
  }
}

function makeJurnalItem(overrides: Partial<JurnalAplicareItem> = {}): JurnalAplicareItem {
  return {
    aplicareId: overrides.aplicareId ?? 'aplicare-1',
    dataAplicata: overrides.dataAplicata ?? '2026-05-09',
    parcelaId: overrides.parcelaId ?? 'parcela-1',
    parcelaNume: overrides.parcelaNume ?? 'Maravilla',
    metodaAplicare: overrides.metodaAplicare ?? 'foliar',
    produse: overrides.produse ?? [{ nume: 'Movento', dozaText: '0.75 L/ha' }],
    status: overrides.status ?? 'aplicata',
  }
}

function makePlan(overrides: Partial<PlanTratament> = {}): PlanTratament {
  return {
    id: overrides.id ?? 'plan-1',
    tenant_id: 'tenant-1',
    nume: overrides.nume ?? 'Plan Maravilla 2026',
    cultura_tip: overrides.cultura_tip ?? 'zmeur',
    descriere: null,
    activ: true,
    arhivat: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

describe('HubTratamenteClient', () => {
  beforeEach(() => {
    pushMock.mockClear()
    refreshMock.mockClear()
    createManualInterventieActionMock.mockReset()
    fetchAplicareEditActionMock.mockReset()
    registerAddActionMock.mockClear()
    registerAddActionMock.mockReturnValue(vi.fn())
  })

  it('afișează cardul Astăzi, jurnalul și planurile active', () => {
    render(
      <HubTratamenteClient
        sugestieAstazi={makeSugestie()}
        jurnalAplicari={[makeJurnalItem()]}
        planuriActive={[makePlan()]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Tratamente' })).toBeInTheDocument()
    expect(screen.getByText('Switch 62.5 WG — 0.6 kg/ha')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jurnal stropit' })).toBeInTheDocument()
    expect(screen.getByText('Movento')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planurile tale' })).toBeInTheDocument()
    expect(screen.getByText('Plan Maravilla 2026')).toBeInTheDocument()
  })

  it('afișează empty states când jurnalul și planurile lipsesc', () => {
    render(<HubTratamenteClient jurnalAplicari={[]} planuriActive={[]} />)

    expect(screen.getByText('Jurnalul este gol')).toBeInTheDocument()
    expect(screen.getByText('Nu ai planuri active')).toBeInTheDocument()
  })

  it('înregistrează acțiunea globală + Stropit acum și deschide flow-ul manual', async () => {
    const user = userEvent.setup()

    render(<HubTratamenteClient sugestieAstazi={makeSugestie()} />)

    await waitFor(() => {
      expect(registerAddActionMock).toHaveBeenCalledWith(expect.any(Function), '+ Stropit acum')
    })

    await user.click(screen.getAllByRole('button', { name: 'Stropit acum' })[0]!)
    await user.click(await screen.findByRole('button', { name: 'Foliar' }))

    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-mode', 'manual')
    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-default-metoda', 'foliar')
  })

  it('încarcă o aplicare din jurnal și deschide MarkAplicataSheet în mode edit', async () => {
    const user = userEvent.setup()
    fetchAplicareEditActionMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'aplicare-1',
        parcelaId: 'parcela-1',
        parcelaNume: 'Maravilla',
        metodaAplicare: 'foliar',
        dataAplicata: '2026-05-09',
        produse: [],
        observatii: null,
        operator: null,
        stadiuLaAplicare: null,
      },
    })

    render(<HubTratamenteClient jurnalAplicari={[makeJurnalItem()]} />)

    await user.click(screen.getByRole('button', { name: /Maravilla/i }))

    await waitFor(() => {
      expect(fetchAplicareEditActionMock).toHaveBeenCalledWith('aplicare-1')
    })
    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-mode', 'edit')
    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-aplicare-id', 'aplicare-1')
  })
})
