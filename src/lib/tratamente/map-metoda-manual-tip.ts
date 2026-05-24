import type { MetodaAplicare } from '@/types/tratamente-metode'

/** Mapează metoda din picker (Sprint 4) pe opțiunea „Tip intervenție” din MarkAplicataSheet. */
export function mapMetodaToManualTipSelect(metoda: MetodaAplicare | null | undefined): string {
  switch (metoda) {
    case 'foliar':
      return 'foliar'
    case 'fertirigare':
      return 'fertirigare'
    case 'fertilizare_baza':
    case 'granulat_sol':
      return 'aplicare_sol'
    default:
      return ''
  }
}
