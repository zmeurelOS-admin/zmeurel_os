import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddInvestitieDialog } from '@/components/investitii/AddInvestitieDialog'

const {
  createInvestitieMock,
  getParceleMock,
  toastErrorMock,
  toastInfoMock,
  hapticErrorMock,
} = vi.hoisted(() => ({
  createInvestitieMock: vi.fn(),
  getParceleMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  hapticErrorMock: vi.fn(),
}))

vi.mock('@/components/app/AppDrawer', () => ({
  AppDrawer: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}))

vi.mock('@/components/app/DialogInitialDataSkeleton', () => ({
  DialogInitialDataSkeleton: () => <div>Se încarcă</div>,
}))

vi.mock('@/components/ui/dialog-form-actions', () => ({
  DialogFormActions: ({
    onCancel,
    onSave,
    saving,
    disabled,
  }: {
    onCancel: () => void
    onSave: () => void
    saving?: boolean
    disabled?: boolean
  }) => (
    <div>
      <button type="button" onClick={onCancel}>
        Anulează
      </button>
      <button type="button" onClick={onSave} disabled={saving || disabled}>
        Salvează
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/form-dialog-layout', () => ({
  DesktopFormGrid: ({
    children,
    aside,
  }: {
    children: React.ReactNode
    aside?: React.ReactNode
  }) => (
    <div>
      <div>{children}</div>
      <div>{aside}</div>
    </div>
  ),
  FormDialogSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

vi.mock('@/components/investitii/InvestitieFormSummary', () => ({
  InvestitieFormSummary: () => <div>Rezumat</div>,
}))

vi.mock('@/components/ui/app-date-picker', () => ({
  AppDatePicker: ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string
    label?: string
    value: string
    onChange: (value: string) => void
  }) => (
    <label>
      {label ?? id}
      <input
        data-testid={id}
        aria-label={label ?? id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}))

vi.mock('@/components/ui/app-select', () => ({
  AppSelect: ({
    id,
    label,
    value,
    options,
    onChange,
  }: {
    id: string
    label?: string
    value: string
    options: Array<{ value: string; label: string }>
    onChange: (value: string) => void
  }) => (
    <label>
      {label ?? id}
      <select
        data-testid={id}
        aria-label={label ?? id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selectează</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    info: toastInfoMock,
    success: vi.fn(),
  },
}))

vi.mock('@/lib/utils/haptic', () => ({
  hapticError: hapticErrorMock,
  hapticSuccess: vi.fn(),
}))

vi.mock('@/lib/supabase/queries/parcele', () => ({
  getParcele: getParceleMock,
}))

vi.mock('@/lib/supabase/queries/investitii', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/investitii')>()
  return {
    ...actual,
    createInvestitie: createInvestitieMock,
  }
})

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('AddInvestitieDialog', () => {
  it('păstrează dialogul deschis și afișează un singur toast la 23505', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    getParceleMock.mockResolvedValue([])
    createInvestitieMock.mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "investitii_id_investitie_key"',
      details: 'Key (id_investitie)=(INV777) already exists.',
      status: 409,
    })

    renderWithClient(
      <AddInvestitieDialog open onOpenChange={onOpenChange} hideTrigger />,
    )

    await waitFor(() => expect(getParceleMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Se încarcă')).not.toBeInTheDocument())

    const amountInput = document.getElementById('inv_suma_lei')
    expect(amountInput).not.toBeNull()
    fireEvent.change(amountInput as HTMLInputElement, { target: { value: '2500' } })
    fireEvent.change(screen.getByTestId('inv_categorie'), {
      target: { value: 'Utilaje și echipamente' },
    })

    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    await waitFor(() => expect(createInvestitieMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1))

    expect(toastInfoMock).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('dialog', { name: 'Adaugă investitie (CAPEX)' })).toBeInTheDocument()
  })
})
