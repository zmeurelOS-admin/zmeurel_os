import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VedereListaDetaliu, elementAles } from '@/components/kit/VedereListaDetaliu'

type El = { id: string; nume: string }
const ELEMENTE: El[] = [
  { id: 'a', nume: 'Ana' },
  { id: 'b', nume: 'Bogdan' },
  { id: 'c', nume: 'Cristina' },
]

function Harness({ initial = null, onAlege }: { initial?: string | null; onAlege?: (id: string, push: boolean) => void }) {
  const [id, setId] = useState<string | null>(initial)
  return (
    <VedereListaDetaliu<El>
      elemente={ELEMENTE}
      cheie={(el) => el.id}
      idAles={id}
      onAlege={(next, { push }) => {
        onAlege?.(next, push)
        setId(next)
      }}
      randeazaRand={(el) => el.nume}
      randeazaFisa={(el) => <h2>Fișa {el.nume}</h2>}
      etichetaLista="Oameni"
    />
  )
}

describe('VedereListaDetaliu (promptul 35, §4)', () => {
  it('elementAles: cel din adresă dacă există, altfel primul', () => {
    expect(elementAles(ELEMENTE, (el) => el.id, 'b')?.nume).toBe('Bogdan')
    expect(elementAles(ELEMENTE, (el) => el.id, 'sters')?.nume).toBe('Ana')
    expect(elementAles(ELEMENTE, (el) => el.id, null)?.nume).toBe('Ana')
    expect(elementAles([], (el: El) => el.id, 'a')).toBeNull()
  })

  it('arată fișa elementului din adresă; fără adresă (sau șters), primul', () => {
    const { unmount } = render(<Harness initial="c" />)
    expect(screen.getByRole('heading', { name: 'Fișa Cristina' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Cristina' }).getAttribute('aria-selected')).toBe('true')
    unmount()
    render(<Harness initial="nu-exista" />)
    expect(screen.getByRole('heading', { name: 'Fișa Ana' })).toBeTruthy()
  })

  it('clicul alege cu push (intră în istoric)', () => {
    const onAlege = vi.fn()
    render(<Harness onAlege={onAlege} />)
    fireEvent.click(screen.getByRole('option', { name: 'Bogdan' }))
    expect(onAlege).toHaveBeenCalledWith('b', true)
    expect(screen.getByRole('heading', { name: 'Fișa Bogdan' })).toBeTruthy()
  })

  it('săgețile mută selecția fără push și nu trec de capete', () => {
    const onAlege = vi.fn()
    render(<Harness initial="a" onAlege={onAlege} />)
    const lista = screen.getByRole('listbox', { name: 'Oameni' })
    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    expect(onAlege).toHaveBeenLastCalledWith('b', false)
    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    expect(onAlege).toHaveBeenLastCalledWith('c', false)
    fireEvent.keyDown(lista, { key: 'ArrowUp' })
    expect(onAlege).toHaveBeenLastCalledWith('b', false)
    expect(lista.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Bogdan' }).id)
  })
})
