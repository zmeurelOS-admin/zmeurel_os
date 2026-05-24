import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IntervenitiePickerSheet } from '@/components/tratamente/IntervenitiePickerSheet'

describe('IntervenitiePickerSheet', () => {
  it('afișează toate tile-urile când este deschis', () => {
    render(<IntervenitiePickerSheet open onOpenChange={vi.fn()} onPick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Foliar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fertirigare' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fertilizare bază' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Granulat sol' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pus capcane' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verificat capcane' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Altă intervenție' })).toBeInTheDocument()
  })

  it('apelează onPick pentru foliar', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()

    render(<IntervenitiePickerSheet open onOpenChange={vi.fn()} onPick={onPick} />)

    await user.click(screen.getByRole('button', { name: 'Foliar' }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('foliar')
  })

  it('apelează onPick pentru capcana_pus', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()

    render(<IntervenitiePickerSheet open onOpenChange={vi.fn()} onPick={onPick} />)

    await user.click(screen.getByRole('button', { name: 'Pus capcane' }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('capcana_pus')
  })

  it('apelează onOpenChange(false) la anulare', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<IntervenitiePickerSheet open onOpenChange={onOpenChange} onPick={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Anulează' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('expune aria-label pe fiecare tile', () => {
    render(<IntervenitiePickerSheet open onOpenChange={vi.fn()} onPick={vi.fn()} />)

    expect(screen.getByLabelText('Foliar')).toBeInTheDocument()
    expect(screen.getByLabelText('Fertirigare')).toBeInTheDocument()
    expect(screen.getByLabelText('Fertilizare bază')).toBeInTheDocument()
    expect(screen.getByLabelText('Granulat sol')).toBeInTheDocument()
    expect(screen.getByLabelText('Pus capcane')).toBeInTheDocument()
    expect(screen.getByLabelText('Verificat capcane')).toBeInTheDocument()
    expect(screen.getByLabelText('Altă intervenție')).toBeInTheDocument()
  })
})
