import { StrictMode, useState } from 'react'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StepForm, useStepForm, type UseStepFormOptions } from '@/components/kit/StepForm'
import {
  createFormLifecycle,
  initialNavState,
  navBack,
  navCanGoBack,
  navGoTo,
  navNext,
  stepLabelRo,
  stepProgressPercent,
  type FormTrackEvent,
} from '@/components/kit/lib/step-form'

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  idCounter: { value: 0 },
}))

vi.mock('@/lib/analytics/trackEvent', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('@/lib/offline/generateClientId', () => ({
  generateClientId: () => {
    mocks.idCounter.value += 1
    return `cheie-${mocks.idCounter.value}`
  },
}))

const eventNames = () => mocks.trackEvent.mock.calls.map((call) => (call[0] as FormTrackEvent).eventName)

beforeEach(() => {
  mocks.trackEvent.mockClear()
  mocks.idCounter.value = 0
})

afterEach(async () => {
  // Demontarea cu formularul deschis trimite renunțarea cu un tick întârziere;
  // o lăsăm să treacă aici, ca să nu ajungă în testul următor.
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 5))
  window.history.replaceState(null, '')
})

// ─── Logica pură ───────────────────────────────────────────────────────────────

describe('StepForm — navigare (logică)', () => {
  const config = { steps: ['client', 'cantitate', 'data', 'verificare'], summaryKey: 'verificare' }

  it('merge înainte și înapoi, fără să iasă din listă', () => {
    let nav = initialNavState(config)
    expect(nav.index).toBe(0)
    expect(navCanGoBack(nav)).toBe(false)

    nav = navNext(nav, config)
    nav = navNext(nav, config)
    expect(nav.index).toBe(2)
    expect(navCanGoBack(nav)).toBe(true)

    nav = navBack(nav, config)
    expect(nav.index).toBe(1)

    nav = navBack(navBack(navBack(nav, config), config), config)
    expect(nav.index).toBe(0)

    nav = navNext(navNext(navNext(navNext(navNext(nav, config), config), config), config), config)
    expect(nav.index).toBe(3)
  })

  it('sare la un pas după cheie și ignoră cheile necunoscute', () => {
    const nav = initialNavState(config)
    expect(navGoTo(nav, config, 'data').index).toBe(2)
    expect(navGoTo(nav, config, 'nu-exista')).toBe(nav)
  })

  it('un pas deschis din recapitulare se întoarce în recapitulare, și la „mai departe”, și la „înapoi”', () => {
    const summary = navGoTo(initialNavState(config), config, 'verificare')

    const edit = navGoTo(summary, config, 'cantitate', true)
    expect(edit).toEqual({ index: 1, returnToSummary: true })
    expect(navCanGoBack(edit)).toBe(true)
    expect(navNext(edit, config)).toEqual({ index: 3, returnToSummary: false })
    expect(navBack(edit, config)).toEqual({ index: 3, returnToSummary: false })
  })

  it('eticheta numără pașii fără recapitulare', () => {
    expect(stepLabelRo(initialNavState(config), config)).toBe('Pasul 1 din 3')
    expect(stepLabelRo(navGoTo(initialNavState(config), config, 'data'), config)).toBe('Pasul 3 din 3')
    expect(stepLabelRo(navGoTo(initialNavState(config), config, 'verificare'), config)).toBe('Verificare')
  })

  it('progresul crește cu pasul și e 100 după salvare', () => {
    const nav = initialNavState(config)
    expect(stepProgressPercent(nav, config)).toBe(25)
    expect(stepProgressPercent(navGoTo(nav, config, 'verificare'), config)).toBe(100)
    expect(stepProgressPercent(nav, config, true)).toBe(100)
  })

  it('pornește de la pasul cerut (ex. recapitularea, la editare)', () => {
    expect(initialNavState(config, 'verificare').index).toBe(3)
    expect(initialNavState(config, 'nu-exista').index).toBe(0)
  })
})

describe('StepForm — ciclul de analytics (logică)', () => {
  it('deschidere → reușită: fără renunțare la închidere', () => {
    const track = vi.fn()
    const lifecycle = createFormLifecycle(track)

    lifecycle.opened('recoltari')
    lifecycle.opened('recoltari')
    lifecycle.succeeded({ kg: 27.35 })
    lifecycle.succeeded()
    lifecycle.closed()

    expect(track.mock.calls.map((call) => call[0])).toEqual([
      { eventName: 'open_create_form', status: 'started', moduleName: 'recoltari' },
      { eventName: 'create_success', status: 'success', moduleName: 'recoltari', metadata: { kg: 27.35 } },
    ])
  })

  it('deschidere → închidere fără salvare: o singură renunțare, cu pasul la care s-a oprit', () => {
    const track = vi.fn()
    const lifecycle = createFormLifecycle(track)

    lifecycle.opened('comenzi')
    lifecycle.closed({ step: 'cantitate' })
    lifecycle.closed({ step: 'cantitate' })

    expect(track.mock.calls.map((call) => call[0])).toEqual([
      { eventName: 'open_create_form', status: 'started', moduleName: 'comenzi' },
      { eventName: 'form_abandoned', status: 'abandoned', moduleName: 'comenzi', metadata: { step: 'cantitate' } },
    ])
  })

  it('eroare, apoi reușită la reîncercare', () => {
    const track = vi.fn()
    const lifecycle = createFormLifecycle(track)

    lifecycle.opened('comenzi')
    lifecycle.failed({ code: 'STOC_INSUFICIENT' })
    lifecycle.succeeded()
    lifecycle.closed()

    expect(track.mock.calls.map((call) => (call[0] as FormTrackEvent).eventName)).toEqual([
      'open_create_form',
      'create_failed',
      'create_success',
    ])
  })

  it('„încă una” după reușită pornește un formular nou', () => {
    const track = vi.fn()
    const lifecycle = createFormLifecycle(track)

    lifecycle.opened('recoltari')
    lifecycle.succeeded()
    lifecycle.restarted()
    lifecycle.closed()

    expect(track.mock.calls.map((call) => (call[0] as FormTrackEvent).eventName)).toEqual([
      'open_create_form',
      'create_success',
      'open_create_form',
      'form_abandoned',
    ])
  })

  it('fără modul (editare, pagini demonstrative) nu trimite nimic', () => {
    const track = vi.fn()
    const lifecycle = createFormLifecycle(track)

    lifecycle.opened(null)
    lifecycle.failed()
    lifecycle.succeeded()
    lifecycle.closed()

    expect(track).not.toHaveBeenCalled()
  })
})

// ─── Hook ──────────────────────────────────────────────────────────────────────

const baseOptions: UseStepFormOptions = {
  steps: ['culegator', 'kg', 'verificare'],
  summaryKey: 'verificare',
  open: true,
  analytics: { moduleName: 'recoltari' },
}

describe('useStepForm', () => {
  it('navighează între pași și întoarce din recapitulare', () => {
    const { result } = renderHook((props: UseStepFormOptions) => useStepForm(props), { initialProps: baseOptions })

    expect(result.current.stepKey).toBe('culegator')
    expect(result.current.label).toBe('Pasul 1 din 2')
    expect(result.current.canGoBack).toBe(false)

    act(() => result.current.next())
    expect(result.current.stepKey).toBe('kg')
    expect(result.current.canGoBack).toBe(true)

    act(() => result.current.next())
    expect(result.current.stepKey).toBe('verificare')
    expect(result.current.isSummary).toBe(true)
    expect(result.current.label).toBe('Verificare')

    act(() => result.current.editFromSummary('culegator'))
    expect(result.current.stepKey).toBe('culegator')
    expect(result.current.canGoBack).toBe(true)

    act(() => result.current.next())
    expect(result.current.stepKey).toBe('verificare')

    act(() => result.current.back())
    expect(result.current.stepKey).toBe('kg')

    act(() => result.current.goTo('culegator'))
    expect(result.current.stepKey).toBe('culegator')
  })

  it('trimite open_create_form o singură dată pe deschidere, oricâte randări ar fi', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
    })

    rerender({ ...baseOptions })
    act(() => result.current.next())
    rerender({ ...baseOptions, steps: ['culegator', 'kg', 'verificare'] })

    expect(eventNames()).toEqual(['open_create_form'])
    expect(mocks.trackEvent).toHaveBeenCalledWith({
      eventName: 'open_create_form',
      moduleName: 'recoltari',
      status: 'started',
    })
  })

  it('rămâne la un singur open_create_form și în StrictMode', () => {
    renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
      wrapper: StrictMode,
    })

    expect(eventNames()).toEqual(['open_create_form'])
  })

  it('închiderea fără salvare trimite form_abandoned o singură dată, cu pasul curent', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
    })

    act(() => result.current.next())
    rerender({ ...baseOptions, open: false })
    rerender({ ...baseOptions, open: false })

    expect(eventNames()).toEqual(['open_create_form', 'form_abandoned'])
    expect(mocks.trackEvent).toHaveBeenLastCalledWith({
      eventName: 'form_abandoned',
      moduleName: 'recoltari',
      status: 'abandoned',
      metadata: { step: 'kg' },
    })
  })

  it('după create_success, închiderea nu mai trimite form_abandoned', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
    })

    act(() => result.current.markSuccess({ kg: 27.35 }))
    expect(result.current.done).toBe(true)
    act(() => result.current.markSuccess())
    rerender({ ...baseOptions, open: false })

    expect(eventNames()).toEqual(['open_create_form', 'create_success'])
  })

  it('demontarea cu formularul deschis contează ca renunțare', async () => {
    const { unmount } = renderHook((props: UseStepFormOptions) => useStepForm(props), { initialProps: baseOptions })

    unmount()
    await waitFor(() => expect(eventNames()).toEqual(['open_create_form', 'form_abandoned']))
  })

  it('la editare nu trimite niciun eveniment și pornește din recapitulare', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: { ...baseOptions, mode: 'edit', initialStep: 'verificare' } as UseStepFormOptions,
    })

    expect(result.current.stepKey).toBe('verificare')
    expect(result.current.label).toBe('Editare')
    expect(result.current.canGoBack).toBe(false)

    act(() => result.current.editFromSummary('kg'))
    expect(result.current.canGoBack).toBe(true)
    act(() => result.current.back())
    expect(result.current.stepKey).toBe('verificare')

    act(() => result.current.markSuccess())
    rerender({ ...baseOptions, mode: 'edit', initialStep: 'verificare', open: false })

    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('fără analytics nu trimite nimic', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: { ...baseOptions, analytics: false } as UseStepFormOptions,
    })

    act(() => result.current.markFailed())
    rerender({ ...baseOptions, analytics: false, open: false })

    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('cheia de idempotență e stabilă pe o deschidere, inclusiv după eroare', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
    })

    const key = result.current.clientSyncId
    expect(key).toMatch(/^cheie-\d+$/)

    act(() => result.current.next())
    rerender({ ...baseOptions })
    act(() => result.current.markFailed({ code: 'RETEA' }))
    act(() => result.current.back())

    expect(result.current.clientSyncId).toBe(key)
    expect(eventNames()).toEqual(['open_create_form', 'create_failed'])
  })

  it('cheia de idempotență e alta la redeschidere, iar formularul pornește de la primul pas', () => {
    const { result, rerender } = renderHook((props: UseStepFormOptions) => useStepForm(props), {
      initialProps: baseOptions,
    })

    const first = result.current.clientSyncId
    act(() => result.current.next())

    rerender({ ...baseOptions, open: false })
    expect(result.current.stepKey).toBe('kg')

    rerender({ ...baseOptions, open: true })
    expect(result.current.clientSyncId).not.toBe(first)
    expect(result.current.stepKey).toBe('culegator')
    expect(result.current.done).toBe(false)
    expect(eventNames()).toEqual(['open_create_form', 'form_abandoned', 'open_create_form'])
  })

  it('restart dă o cheie nouă și pornește un formular nou, fără închidere', () => {
    const { result } = renderHook((props: UseStepFormOptions) => useStepForm(props), { initialProps: baseOptions })

    const first = result.current.clientSyncId
    act(() => result.current.next())
    act(() => result.current.markSuccess())
    act(() => result.current.restart())

    expect(result.current.clientSyncId).not.toBe(first)
    expect(result.current.stepKey).toBe('culegator')
    expect(result.current.done).toBe(false)
    expect(eventNames()).toEqual(['open_create_form', 'create_success', 'open_create_form'])
  })
})

// ─── Carcasa ───────────────────────────────────────────────────────────────────

function Formular({ onSave }: { onSave: (clientSyncId: string) => void }) {
  const [open, setOpen] = useState(false)
  const form = useStepForm({ steps: ['culegator', 'kg'], open, analytics: { moduleName: 'recoltari' } })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Adaugă kg
      </button>
      <StepForm
        form={form}
        open={open}
        onOpenChange={setOpen}
        title="Adaugă kilograme"
        success={<p>Salvat</p>}
        dock={form.stepKey === 'kg' ? <p>Tastatura</p> : null}
        footer={
          form.stepKey === 'kg'
            ? {
                primary: {
                  label: 'Salvează',
                  onClick: () => {
                    onSave(form.clientSyncId)
                    form.markSuccess()
                  },
                },
                secondary: { label: 'Salvează + următorul', onClick: () => form.restart() },
              }
            : null
        }
      >
        {form.stepKey === 'culegator' ? (
          <button type="button" onClick={form.next}>
            Ana
          </button>
        ) : (
          <p>Câte kilograme?</p>
        )}
      </StepForm>
    </>
  )
}

describe('StepForm — carcasa', () => {
  it('arată pasul, ascunde „înapoi” la primul pas și zona de jos când pasul nu are butoane', async () => {
    const user = userEvent.setup()
    render(<Formular onSave={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    const dialog = await screen.findByRole('dialog', { name: 'Adaugă kilograme' })

    expect(dialog).toHaveTextContent('Pasul 1 din 2')
    expect(screen.getByRole('button', { name: 'Înapoi', hidden: true })).toHaveClass('invisible')
    expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresul formularului' })).toHaveAttribute('aria-valuenow', '50')
  })

  it('trece la pasul următor, arată cele două butoane și se întoarce cu „înapoi”', async () => {
    const user = userEvent.setup()
    render(<Formular onSave={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await user.click(await screen.findByRole('button', { name: 'Ana' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Pasul 2 din 2')
    expect(screen.getByText('Câte kilograme?')).toBeInTheDocument()
    expect(screen.getByText('Tastatura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvează + următorul' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Înapoi' }))
    expect(screen.getByRole('button', { name: 'Ana' })).toBeInTheDocument()
  })

  it('după salvare arată ecranul de reușită, fără butoanele de jos, și trimite ciclul complet', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Formular onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await user.click(await screen.findByRole('button', { name: 'Ana' }))
    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    expect(screen.getByText('Salvat')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
    expect(screen.queryByText('Tastatura')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith(expect.stringMatching(/^cheie-\d+$/))

    await user.click(screen.getByRole('button', { name: 'Închide' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(eventNames()).toEqual(['open_create_form', 'create_success'])
  })

  it('închiderea din X fără salvare trimite form_abandoned', async () => {
    const user = userEvent.setup()
    render(<Formular onSave={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await user.click(await screen.findByRole('button', { name: 'Ana' }))
    await user.click(screen.getByRole('button', { name: 'Închide' }))

    await waitFor(() => expect(eventNames()).toEqual(['open_create_form', 'form_abandoned']))
  })
})

// ─── Garda de închidere ────────────────────────────────────────────────────────

function FormularCuGarda({ guard }: { guard: () => boolean }) {
  const [open, setOpen] = useState(false)
  const form = useStepForm({ steps: ['kg'], open })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Adaugă kg
      </button>
      <StepForm form={form} open={open} onOpenChange={setOpen} title="Adaugă kilograme" closeGuard={guard}>
        <button type="button" onClick={() => setOpen(false)}>
          Renunță
        </button>
      </StepForm>
    </>
  )
}

const pressBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

describe('StepForm — garda de închidere', () => {
  it('X nu închide formularul cât garda spune că e ceva nesalvat', async () => {
    const user = userEvent.setup()
    const guard = vi.fn(() => true)
    render(<FormularCuGarda guard={guard} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Închide' }))

    expect(guard).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fără nimic nesalvat, X închide direct', async () => {
    const user = userEvent.setup()
    const guard = vi.fn(() => false)
    render(<FormularCuGarda guard={guard} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Închide' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('„înapoi” oprit de gardă lasă formularul deschis și pune la loc intrarea din istoric', async () => {
    const user = userEvent.setup()
    const guard = vi.fn(() => true)
    render(<FormularCuGarda guard={guard} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await screen.findByRole('dialog')
    const lengthWhileOpen = window.history.length

    pressBack()

    expect(guard).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(window.history.length).toBe(lengthWhileOpen + 1)
    expect(window.history.state?.__zmeurelDialog).toBe(true)
  })

  it('al doilea „înapoi” întreabă din nou garda (ui/dialog nu mai ascultă după primul)', async () => {
    const user = userEvent.setup()
    const guard = vi.fn(() => true)
    render(<FormularCuGarda guard={guard} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await screen.findByRole('dialog')

    pressBack()
    pressBack()
    expect(guard).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Când nu mai e nimic nesalvat, „înapoi” închide.
    guard.mockReturnValue(false)
    pressBack()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('închiderea hotărâtă de modul după un „înapoi” oprit scoate marcajul din istoric', async () => {
    const user = userEvent.setup()
    render(<FormularCuGarda guard={() => true} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă kg' }))
    await screen.findByRole('dialog')
    pressBack()
    expect(window.history.state?.__zmeurelDialog).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Renunță' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.history.state?.__zmeurelDialog).toBeUndefined()
  })
})
