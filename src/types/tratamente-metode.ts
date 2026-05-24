import { z } from 'zod'

export const METODE_APLICARE = [
  'foliar',
  'fertirigare',
  'fertilizare_baza',
  'granulat_sol',
  'capcana_pus',
  'capcana_verificat',
  'altul',
] as const

export type MetodaAplicare = (typeof METODE_APLICARE)[number]

export const METODA_APLICARE_LABEL_RO: Record<MetodaAplicare, string> = {
  foliar: 'Foliar',
  fertirigare: 'Fertirigare',
  fertilizare_baza: 'Fertilizare bază',
  granulat_sol: 'Granulat sol',
  capcana_pus: 'Pus capcane',
  capcana_verificat: 'Verificat capcane',
  altul: 'Altă intervenție',
}

export const METODE_CU_PHI: MetodaAplicare[] = ['foliar', 'granulat_sol']
export const METODE_FARA_PRODUS: MetodaAplicare[] = ['capcana_pus', 'capcana_verificat']

export const TIPURI_CAPCANA = [
  'drosophila_otet',
  'lipicioasa_galbena',
  'lipicioasa_albastra',
  'feromonala',
  'altul',
] as const

export type TipCapcana = (typeof TIPURI_CAPCANA)[number]

export const TIP_CAPCANA_LABEL_RO: Record<TipCapcana, string> = {
  drosophila_otet: 'Drosophila — capcană oțet',
  lipicioasa_galbena: 'Lipicioasă galbenă',
  lipicioasa_albastra: 'Lipicioasă albastră',
  feromonala: 'Feromonală',
  altul: 'Altă capcană',
}

export const metodaAplicareSchema = z.enum(METODE_APLICARE)
export const tipCapcanaSchema = z.enum(TIPURI_CAPCANA)

export type UnitateOption = {
  value: string
  label: string
}

export function getUnitatiPentruMetoda(metoda: MetodaAplicare | null): UnitateOption[] {
  switch (metoda) {
    case 'foliar':
      return [
        { value: 'ml_10l', label: 'ml/10L apă' },
        { value: 'g_10l', label: 'g/10L apă' },
        { value: 'l_ha', label: 'L/ha' },
        { value: 'kg_ha', label: 'kg/ha' },
      ]
    case 'fertirigare':
      return [
        { value: 'kg_parcela', label: 'kg/parcelă' },
        { value: 'g_parcela', label: 'g/parcelă' },
        { value: 'l_parcela', label: 'L/parcelă' },
        { value: 'kg_ha', label: 'kg/ha' },
      ]
    case 'fertilizare_baza':
      return [
        { value: 'saci_50_kg', label: 'saci 50 kg' },
        { value: 'saci_25_kg', label: 'saci 25 kg' },
        { value: 'kg_parcela', label: 'kg/parcelă' },
        { value: 'kg_ha', label: 'kg/ha' },
      ]
    case 'granulat_sol':
      return [
        { value: 'kg_ha', label: 'kg/ha' },
        { value: 'kg_parcela', label: 'kg/parcelă' },
      ]
    case 'altul':
      return [
        { value: 'ml', label: 'ml' },
        { value: 'l', label: 'L' },
        { value: 'g', label: 'g' },
        { value: 'kg', label: 'kg' },
        { value: 'buc', label: 'buc' },
        { value: 'ml_10l', label: 'ml/10L apă' },
        { value: 'g_10l', label: 'g/10L apă' },
        { value: 'kg_parcela', label: 'kg/parcelă' },
        { value: 'g_parcela', label: 'g/parcelă' },
        { value: 'l_parcela', label: 'L/parcelă' },
        { value: 'kg_ha', label: 'kg/ha' },
        { value: 'l_ha', label: 'L/ha' },
        { value: 'saci_50_kg', label: 'saci 50 kg' },
        { value: 'saci_25_kg', label: 'saci 25 kg' },
        { value: 'nr_bucati', label: 'nr. bucăți' },
        { value: 'altul', label: 'altul' },
      ]
    case null:
      return [
        { value: 'ml', label: 'ml' },
        { value: 'l', label: 'L' },
        { value: 'g', label: 'g' },
        { value: 'kg', label: 'kg' },
        { value: 'buc', label: 'buc' },
      ]
    default:
      return []
  }
}

export function getUnitateDefaultPentruMetoda(metoda: MetodaAplicare | null): string {
  switch (metoda) {
    case 'foliar':
      return 'ml_10l'
    case 'fertirigare':
      return 'kg_parcela'
    case 'fertilizare_baza':
      return 'saci_50_kg'
    case 'granulat_sol':
      return 'kg_ha'
    case 'altul':
      return 'kg'
    default:
      return 'ml'
  }
}
