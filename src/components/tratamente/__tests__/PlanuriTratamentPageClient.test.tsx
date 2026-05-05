import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlanuriTratamentPageClient } from '@/components/tratamente/PlanuriTratamentPageClient'
import type { PlanTratamentListItem } from '@/lib/supabase/queries/tratamente'

const {
  arhiveazaPlanTratamentActionMock,
  dezarhiveazaPlanTratamentActionMock,
  getPlanDeleteInfoActionMock,
  hardDeletePlanActionMock,
  listPlanuriTratamentCompletActionMock,
} = vi.hoisted(() => ({
  arhiveazaPlanTratamentActionMock: vi.fn(),
  dezarhiveazaPlanTratamentActionMock: vi.fn(),
  getPlanDeleteInfoActionMock: vi.fn(),
  hardDeletePlanActionMock: vi.fn(),
  listPlanuriTratamentCompletActionMock: vi.fn(),
}))

const replaceMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/tratamente/planuri',
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/(dashboard)/tratamente/planuri/actions', () => ({
  arhiveazaPlanTratamentAction: (...args: unknown[]) => arhiveazaPlanTratamentActionMock(...args),
  dezarhiveazaPlanTratamentAction: (...args: unknown[]) => dezarhiveazaPlanTratamentActionMock(...args),
  getPlanDeleteInfoAction: (...args: unknown[]) => getPlanDeleteInfoActionMock(...args),
  hardDeletePlanAction: (...args: unknown[]) => hardDeletePlanActionMock(...args),
  listPlanuriTratamentCompletAction: (...args: unknown[]) => listPlanuriTratamentCompletActionMock(...args),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ title, subtitle, rightSlot }: { title: string; subtitle?: string; rightSlot?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {rightSlot}
    </div>
  ),
}))

vi.mock('@/components/ui/ResponsiveDataView', () => ({
  ResponsiveDataView: ({
    data,
    renderCard,
  }: {
    data: PlanTratamentListItem[]
    renderCard: (item: PlanTratamentListItem) => ReactNode
  }) => (
    <div>
      {data.map((item) => (
        <div key={item.id}>{renderCard(item)}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/ui/desktop', () => ({
  DesktopSplitPane: ({ master, detail }: { master: ReactNode; detail: ReactNode }) => (
    <div>
      {master}
      {detail}
    </div>
  ),
  DesktopToolbar: ({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) => (
    <div>
      {children}
      {trailing}
    </div>
  ),
  DesktopInspectorPanel: ({
    title,
    description,
    children,
    footer,
  }: {
    title: ReactNode
    description: ReactNode
    children: ReactNode
    footer?: ReactNode
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
      {footer}
    </section>
  ),
  DesktopInspectorSection: ({ label, children }: { label: ReactNode; children: ReactNode }) => (
    <div>
      <h3>{label}</h3>
      {children}
    </div>
  ),
}))

function createPlan(overrides: Partial<PlanTratamentListItem> = {}): PlanTratamentListItem {
  return {
    id: overrides.id ?? 'plan-1',
    tenant_id: 'tenant-1',
    nume: overrides.nume ?? 'Plan test',
    cultura_tip: overrides.cultura_tip ?? 'zmeur',
    descriere: overrides.descriere ?? null,
    activ: overrides.activ ?? true,
    arhivat: overrides.arhivat ?? false,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    linii_count: overrides.linii_count ?? 1,
    nr_produse: overrides.nr_produse ?? 1,
    tipuri_interventie: overrides.tipuri_interventie ?? ['protectie'],
    nr_aplicate: overrides.nr_aplicate ?? 0,
    parcele_asociate: overrides.parcele_asociate ?? [],
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PlanuriTratamentPageClient />
    </QueryClientProvider>
  )
}

describe('PlanuriTratamentPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPlanuriTratamentCompletActionMock.mockResolvedValue([createPlan()])
    getPlanDeleteInfoActionMock.mockResolvedValue({ countAplicari: 0 })
    hardDeletePlanActionMock.mockResolvedValue({ ok: true })
    arhiveazaPlanTratamentActionMock.mockResolvedValue(createPlan())
    dezarhiveazaPlanTratamentActionMock.mockResolvedValue(createPlan())
  })

  it('expune CTA-ul de ștergere în listă și deschide dialogul de confirmare', async () => {
    const user = userEvent.setup()

    renderPage()

    const deleteButtons = await screen.findAllByRole('button', { name: 'Șterge' })
    await user.click(deleteButtons[0]!)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Șterge' })).toBeEnabled()
  })

  it('blochează ștergerea completă pentru planurile cu aplicări istorice', async () => {
    const user = userEvent.setup()
    getPlanDeleteInfoActionMock.mockResolvedValueOnce({ countAplicari: 2 })

    renderPage()

    const deleteButtons = await screen.findAllByRole('button', { name: 'Șterge' })
    await user.click(deleteButtons[0]!)

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Acest plan are 2 aplicări asociate și nu poate fi șters complet\./i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Șterge' })).toBeDisabled()
    expect(hardDeletePlanActionMock).not.toHaveBeenCalled()
  })
})
