import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TabelDate, randuriCsv, type ColoanaTabel } from '@/components/kit/TabelDate'
import * as csv from '@/lib/export/csv'

type Rand = { id: string; client: string; kg: number; pret: number }
const RANDURI: Rand[] = [
  { id: '1', client: 'Mega Image', kg: 12, pret: 28 },
  { id: '2', client: 'Ana', kg: 4, pret: 30 },
  { id: '3', client: 'Selgros', kg: 15, pret: 26 },
]
const COLOANE: ColoanaTabel<Rand>[] = [
  { id: 'client', titlu: 'Client', valoare: (r) => r.client },
  { id: 'kg', titlu: 'kg', valoare: (r) => r.kg, aliniere: 'dreapta', total: (rs) => rs.reduce((s, r) => s + r.kg, 0) },
  { id: 'pret', titlu: 'lei/kg', valoare: (r) => r.pret, aliniere: 'dreapta' },
]

afterEach(() => vi.restoreAllMocks())

/** Clientul din fiecare rând de date (fără cap și fără totaluri). */
const clienti = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1, -1)
    .map((rand) => within(rand).getAllByRole('cell')[1]?.textContent)

describe('TabelDate (promptul 35, §4)', () => {
  it('sortează la clic pe capul coloanei și arată totalul', () => {
    render(<TabelDate coloane={COLOANE} randuri={RANDURI} cheie={(r) => r.id} eticheta="Comenzi" selectie />)
    expect(clienti()).toEqual(['Mega Image', 'Ana', 'Selgros'])
    fireEvent.click(screen.getByRole('button', { name: /^Client/ }))
    expect(clienti()).toEqual(['Ana', 'Mega Image', 'Selgros'])
    expect(screen.getByRole('columnheader', { name: /Client/ }).getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getByText('31')).toBeTruthy()
  })

  it('selecția arată acțiunile în bloc, cu rândurile bifate', () => {
    const actiuni = vi.fn(() => <button type="button">Pune în livrare</button>)
    render(<TabelDate coloane={COLOANE} randuri={RANDURI} cheie={(r) => r.id} eticheta="Comenzi" selectie actiuniBloc={actiuni} />)
    expect(screen.queryByRole('button', { name: 'Pune în livrare' })).toBeNull()
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selectează rândul' })[2])
    expect(screen.getByRole('button', { name: 'Pune în livrare' })).toBeTruthy()
    expect(actiuni).toHaveBeenLastCalledWith([RANDURI[2]], expect.any(Function))
    expect(screen.getByText('1 selectate')).toBeTruthy()
  })

  it('exportul: toate rândurile afișate sau doar cele bifate; coloanele cu `csv: false` nu intră', () => {
    const descarca = vi.spyOn(csv, 'descarcaCsv').mockImplementation(() => undefined)
    const fara: ColoanaTabel<Rand>[] = [...COLOANE.slice(0, 2), { ...COLOANE[2], csv: false }]
    render(<TabelDate coloane={fara} randuri={RANDURI} cheie={(r) => r.id} eticheta="Comenzi" selectie numeExport="comenzi" aziIso="2026-11-28" />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportă CSV' }))
    expect(descarca).toHaveBeenCalledWith('comenzi-2026-11-28.csv', '﻿Client;kg\r\nMega Image;12\r\nAna;4\r\nSelgros;15\r\n')
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selectează rândul' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Exportă selectatele' }))
    expect(descarca).toHaveBeenLastCalledWith('comenzi-2026-11-28.csv', '﻿Client;kg\r\nAna;4\r\n')
  })

  it('randuriCsv folosește `csv` când e dat', () => {
    const cuCsv: ColoanaTabel<Rand>[] = [{ id: 'total', titlu: 'Total', valoare: (r) => `${r.kg * r.pret} lei`, csv: (r) => r.kg * r.pret }]
    expect(randuriCsv(cuCsv, RANDURI.slice(0, 1))).toEqual({ cap: ['Total'], randuri: [[336]] })
  })
})
