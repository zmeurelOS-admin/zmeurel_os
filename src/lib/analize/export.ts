/**
 * Rapoarte → Exportă → „Analizele sezonului”: o listă (Excel + PDF), cu același document HTML ca restul exportului.
 * Funcție pură.
 */
import { dataRo, type DocumentExport } from '@/lib/rapoarte/export'

import { ETICHETA_PRELEVAT, ETICHETA_STATUS, type AnalizaRow } from './model'
import { numarMgKg } from './raport'

export const COLOANE_ANALIZE = [
  'Data prelevării',
  'Parcele',
  'PV',
  'Prelevat de',
  'Laborator',
  'Data predării',
  'Rezultat',
  'Buletin',
  'Data buletinului',
  'Ce s-a analizat',
  'Substanțe (găsit / limită, mg/kg)',
  'Restul nedetectate',
] as const

/** Analizele prelevate în perioadă, cele mai vechi întâi. */
export function analizeInPerioada(analize: readonly AnalizaRow[], start: string, end: string): AnalizaRow[] {
  return analize
    .filter((analiza) => analiza.data_prelevare >= start && analiza.data_prelevare <= end)
    .sort((a, b) => a.data_prelevare.localeCompare(b.data_prelevare) || a.created_at.localeCompare(b.created_at))
}

export function documentAnalize(analize: readonly AnalizaRow[], numeParcele: ReadonlyMap<string, string>, start: string, end: string): DocumentExport {
  return {
    titlu: 'Analizele sezonului',
    subtitlu: `Perioada: ${dataRo(start)} – ${dataRo(end)}`,
    tabele: [
      {
        titlu: 'Analize la fructe',
        coloane: [...COLOANE_ANALIZE],
        randuri: analizeInPerioada(analize, start, end).map((analiza) => [
          dataRo(analiza.data_prelevare),
          analiza.parcele.map((id) => numeParcele.get(id) ?? 'Parcelă').join(', '),
          analiza.pv_numar ?? '',
          analiza.prelevat_de ? ETICHETA_PRELEVAT[analiza.prelevat_de] : '',
          analiza.laborator ?? '',
          analiza.data_predare ? dataRo(analiza.data_predare) : '',
          ETICHETA_STATUS[analiza.status],
          analiza.buletin_numar ?? '',
          analiza.buletin_data ? dataRo(analiza.buletin_data) : '',
          analiza.ce_s_a_analizat ?? '',
          analiza.substante.map((s) => `${s.substanta}: ${numarMgKg(s.valoare_mg_kg)} / ${numarMgKg(s.lmr_mg_kg)}`).join('; '),
          analiza.status === 'la_laborator' ? '' : analiza.rest_nedetectate ? 'da' : 'nu',
        ]),
      },
    ],
  }
}
