import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddCheltuialaDialog } from '@/components/cheltuieli/AddCheltuialaDialog'

const {
  toastErrorMock,
  toastInfoMock,
  trackEventMock,
  hapticErrorMock,
  getFrequentCheltuieliSuppliersMock,
} = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  trackEventMock: vi.fn(),
  hapticErrorMock: vi.fn(),
  getFrequentCheltuieliSuppliersMock: vi.fn(),
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

vi.mock('@/components/ui/dialog-form-actions', () => ({
  DialogFormActions: ({
    onCancel,
    onSave,
    saving,
  }: {
    onCancel: () => void
    onSave: () => void
    saving?: boolean
  }) => (
    <div>
      <button type="button" onClick={onCancel}>
        Anulează
      </button>
      <button type="button" onClick={onSave} disabled={saving}>
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

vi.mock('@/components/cheltuieli/CheltuialaFormSummary', () => ({
  CheltuialaFormSummary: () => <div>Rezumat</div>,
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

vi.mock('@/lib/analytics/trackEvent', () => ({
  trackEvent: trackEventMock,
}))

vi.mock('@/lib/utils/haptic', () => ({
  hapticError: hapticErrorMock,
}))

vi.mock('@/lib/supabase/queries/cheltuieli', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/cheltuieli')>()
  return {
    ...actual,
    getFrequentCheltuieliSuppliers: getFrequentCheltuieliSuppliersMock,
  }
})

vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...actual,
    useForm: () => ({
      control: {},
      reset: vi.fn(),
      setValue: vi.fn(),
      register: (name: string) => ({
        name,
        onChange: vi.fn(),
        onBlur: vi.fn(),
        ref: vi.fn(),
      }),
      handleSubmit:
        (callback: (data: Record<string, string | undefined>) => Promise<void>) =>
        () =>
          callback({
            client_sync_id: undefined,
            data: '2026-07-11',
            categorie: 'Ambalaje',
            suma_lei: '150',
            furnizor: '',
            descriere: '',
          }),
      formState: {
        errors: {},
      },
    }),
    useWatch: ({ name }: { name: string }) => {
      switch (name) {
        case 'data':
          return '2026-07-11'
        case 'categorie':
          return 'Ambalaje'
        case 'suma_lei':
          return '150'
        case 'furnizor':
        case 'descriere':
          return ''
        default:
          return ''
      }
    },
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

describe('AddCheltuialaDialog', () => {
  it('păstrează dialogul deschis și afișează un singur toast la 23505', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "cheltuieli_diverse_id_cheltuiala_key"',
      details: 'Key (id_cheltuiala)=(CH777) already exists.',
      status: 409,
    })
    getFrequentCheltuieliSuppliersMock.mockResolvedValue([])

    renderWithClient(
      <AddCheltuialaDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
    )

    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1))

    expect(toastInfoMock).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('dialog', { name: 'Adaugă cheltuială' })).toBeInTheDocument()
  })
})
