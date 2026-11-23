/**
 * Capcanele (promptul 29): tipurile, starea, grupurile și verificările, cum le folosește aplicația.
 * Funcții pure (fără React, fără Supabase): se folosesc în ecrane, în cron, în rapoarte și în teste.
 *
 * Un **grup** = un rând din `capcane_montate`: capcane de același tip pe o parcelă (`nr_bucati`).
 * O **verificare** a grupului = câte un rând în `capcane_verificari` pe fiecare capcană (`capcana_nr`), aceeași dată.
 */

export const TIPURI_CAPCANA = ['drosophila', 'lipicioasa_galbena', 'feromoni', 'alta'] as const
export type TipCapcana = (typeof TIPURI_CAPCANA)[number]

export const ETICHETA_TIP_CAPCANA: Record<TipCapcana, string> = {
  drosophila: 'Drosophila (atractant)',
  lipicioasa_galbena: 'Lipicioasă galbenă',
  feromoni: 'Feromoni',
  alta: 'Altă capcană',
}

/** Numele scurt, la plural, pentru „3 Drosophila”, „2 lipicioase galbene”. */
export function numeTipBucati(tip: TipCapcana, bucati: number): string {
  const unu = bucati === 1
  switch (tip) {
    case 'drosophila':
      return 'Drosophila'
    case 'lipicioasa_galbena':
      return unu ? 'lipicioasă galbenă' : 'lipicioase galbene'
    case 'feromoni':
      return unu ? 'capcană cu feromoni' : 'capcane cu feromoni'
    default:
      return unu ? 'capcană' : 'capcane'
  }
}

/** „Maravilla 1 · 3 Drosophila”. */
export function titluGrup(parcela: string, tip: TipCapcana, bucati: number): string {
  return `${parcela} · ${bucati} ${numeTipBucati(tip, bucati)}`
}

/**
 * Valoarea din baza de date → tipul aplicației. Primește și valorile vechi din verificarea inițială a tabelului
 * (`drosophila_otet`, `lipicioasa_albastra`, `feromonala`, `altul`).
 */
export function normalizeTip(value: string | null | undefined): TipCapcana {
  switch ((value ?? '').trim()) {
    case 'drosophila':
    case 'drosophila_otet':
      return 'drosophila'
    case 'lipicioasa_galbena':
      return 'lipicioasa_galbena'
    case 'feromoni':
    case 'feromonala':
      return 'feromoni'
    default:
      return 'alta'
  }
}

export type StatusGrup = 'activa' | 'scoasa'

/** `activ` / `activa` → activă; restul (`scos`, `scoasa`, `expirat`) → scoasă. */
export function normalizeStatus(value: string | null | undefined): StatusGrup {
  const v = (value ?? '').trim()
  return v === 'activa' || v === 'activ' ? 'activa' : 'scoasa'
}

export const INTERVAL_VERIFICARE_IMPLICIT = 7
/** Atractantul Drosophila se schimbă implicit la 7 zile; celelalte tipuri n-au atractant de schimbat. */
export const INTERVAL_ATRACTANT_DROSOPHILA = 7

export interface GrupCapcane {
  id: string
  parcela_id: string
  tip: TipCapcana
  nr_bucati: number
  data_montare: string
  data_urmatoarea_verificare: string | null
  interval_verificare_zile: number
  interval_atractant_zile: number | null
  data_schimb_atractant: string | null
  status: StatusGrup
  observatii: string | null
  foto_url: string | null
}

export interface VerificareCapcana {
  id: string
  grup_id: string
  data: string
  capcana_nr: number | null
  capturi: number
  atractant_schimbat: boolean
  observatii: string | null
  foto_url: string | null
}

/** Câte capcane sunt în grupurile date (pentru „Verificare azi · 6 capcane”). */
export function totalBucati(grupuri: ReadonlyArray<Pick<GrupCapcane, 'nr_bucati'>>): number {
  return grupuri.reduce((suma, grup) => suma + Math.max(0, grup.nr_bucati), 0)
}

/** „1 capcană”, „6 capcane”, „20 de capcane”. */
export function capcaneText(n: number): string {
  if (n === 1) return '1 capcană'
  const rest = Math.abs(n) % 100
  return `${n} ${n !== 0 && (rest === 0 || rest >= 20) ? 'de ' : ''}capcane`
}

/** „1 captură”, „9 capturi”, „20 de capturi”. */
export function capturiText(n: number): string {
  if (n === 1) return '1 captură'
  const rest = Math.abs(n) % 100
  return `${n} ${n !== 0 && (rest === 0 || rest >= 20) ? 'de ' : ''}capturi`
}
