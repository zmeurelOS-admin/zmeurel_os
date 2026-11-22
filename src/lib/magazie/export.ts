/**
 * Exportul „Magazia” din Rapoarte → Exportă (Excel): stocul de azi și mișcările din perioada aleasă. Funcție pură.
 */
import { dataRo, type DocumentExport } from '@/lib/rapoarte/export'

import type { StocProdus, TipMiscare } from './stoc'

const ETICHETA_MISCARE: Record<TipMiscare, string> = {
  intrare: 'Cumpărat',
  iesire_tratament: 'Tratament',
  corectie: 'Corecție (am numărat)',
}

const nr = (value: number | null | undefined, zecimale = 3) =>
  value === null || value === undefined || !Number.isFinite(value) ? '' : Number(value.toFixed(zecimale))

export function documentMagazie(input: {
  stoc: readonly StocProdus[]
  miscari: readonly {
    data: string
    nume: string
    tip: TipMiscare
    cantitate: number
    unitate: string | null
    pret_total_lei?: number | null
    furnizor?: string | null
    nota?: string | null
  }[]
  start: string
  end: string
}): DocumentExport {
  const miscari = input.miscari
    .filter((miscare) => miscare.data >= input.start && miscare.data <= input.end)
    .sort((a, b) => a.data.localeCompare(b.data) || a.nume.localeCompare(b.nume, 'ro-RO'))
  return {
    titlu: 'Magazia',
    subtitlu: `Stocul de azi și mișcările din ${dataRo(input.start)} – ${dataRo(input.end)}`,
    tabele: [
      {
        titlu: 'Stocul',
        coloane: ['Produs', 'Tip', 'În magazie', 'Unitate', 'Prag „pe terminate”', 'Ajunge pentru (aplicări)', 'Pe terminate', 'Preț mediu (lei/unitate)', 'Valoare (lei)'],
        randuri: input.stoc.map((rand) => [
          rand.nume,
          rand.tip ?? '',
          nr(rand.stoc),
          rand.unitate,
          nr(rand.prag),
          rand.aplicari_ramase === null ? '' : Math.round(rand.aplicari_ramase),
          rand.pe_terminate ? 'da' : 'nu',
          nr(rand.pret_mediu, 2),
          nr(rand.valoare, 2),
        ]),
      },
      {
        titlu: 'Mișcările din perioadă',
        coloane: ['Data', 'Produs', 'Ce', 'Cantitate', 'Unitate', 'Preț total (lei)', 'Furnizor', 'Notă'],
        randuri: miscari.map((miscare) => [
          dataRo(miscare.data),
          miscare.nume,
          ETICHETA_MISCARE[miscare.tip],
          nr(miscare.cantitate),
          miscare.unitate ?? '',
          nr(miscare.pret_total_lei ?? null, 2),
          miscare.furnizor ?? '',
          miscare.nota ?? '',
        ]),
      },
    ],
  }
}
