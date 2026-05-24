import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ParcelaTratamenteMobileHub } from '@/components/tratamente/ParcelaTratamenteMobileHub'

const baseProps = {
  an: 2026,
  aplicateCount: 0,
  aplicariCount: 0,
  aplicariEfectuate: [],
  capcaneActive: [],
  capcaneError: null,
  capcaneLoading: false,
  configurareSezon: null,
  createPlanHref: '/tratamente/planuri/nou',
  detailsHref: null,
  dualStageState: null,
  editPlanHref: null,
  grupBiologic: 'rubus' as const,
  interventiiRelevante: [],
  isRubusMixt: false,
  onApplyTreatment: vi.fn(),
  onAssignPlan: vi.fn(),
  onMountCapcana: vi.fn(),
  onPlanificaInterventie: vi.fn(),
  onRecordStadiu: vi.fn(),
  onReloadCapcane: vi.fn(),
  onVerifyCapcana: vi.fn(),
  parcelaId: 'parcela-1',
  parcelaNume: 'Parcela Nord',
  planLinii: [],
  planName: null,
  pendingInterventieId: null,
  planActiv: null,
  produseFitosanitare: [],
  singleStageState: null,
  urmatoareleAplicari: [],
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('ParcelaTratamenteMobileHub', () => {
  it('nu afișează cardul de onboarding cu 3 pași când nu există plan', () => {
    render(<ParcelaTratamenteMobileHub {...baseProps} />)

    expect(screen.queryByText('Începe modulul de protecție și nutriție pentru această parcelă')).not.toBeInTheDocument()
    expect(screen.queryByText('Creează primul plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Asociază planul')).not.toBeInTheDocument()
    expect(screen.queryByText('Înregistrează fenofaza')).not.toBeInTheDocument()
  })

  it('afișează cele două acțiuni principale', () => {
    render(<ParcelaTratamenteMobileHub {...baseProps} />)

    expect(screen.getByRole('button', { name: /Am aplicat un tratament/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Verificare capcană/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('apelează handler-ele pentru acțiunile principale', async () => {
    const user = userEvent.setup()
    const onApplyTreatment = vi.fn()
    const onVerifyCapcana = vi.fn()

    render(
      <ParcelaTratamenteMobileHub
        {...baseProps}
        onApplyTreatment={onApplyTreatment}
        onVerifyCapcana={onVerifyCapcana}
      />
    )

    await user.click(screen.getByRole('button', { name: /Am aplicat un tratament/i }))
    await user.click(screen.getAllByRole('button', { name: /Verificare capcană/i })[0]!)

    expect(onApplyTreatment).toHaveBeenCalledTimes(1)
    expect(onVerifyCapcana).toHaveBeenCalledTimes(1)
  })

  it('afișează empty state scurt pentru jurnal gol', () => {
    render(<ParcelaTratamenteMobileHub {...baseProps} />)

    expect(screen.getByText(/Încă nu ai înregistrat tratamente/i)).toBeInTheDocument()
  })

  it('retrogradează planurile într-un punct de acces colapsat', () => {
    render(<ParcelaTratamenteMobileHub {...baseProps} />)

    expect(screen.getByRole('button', { name: /Planuri și conformitate/i })).toBeInTheDocument()
    expect(screen.queryByText('INTERVENȚII')).not.toBeInTheDocument()
  })
})
