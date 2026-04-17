import type { AplicareTratament } from '@/lib/supabase/queries/tratamente'

export function getAplicareStatusTone(
  status: AplicareTratament['status']
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'aplicata') return 'success'
  if (status === 'omisa') return 'warning'
  if (status === 'anulata') return 'danger'
  if (status === 'reprogramata') return 'neutral'
  return 'neutral'
}

export function getAplicareStatusLabel(status: AplicareTratament['status']): string {
  if (status === 'aplicata') return 'Aplicată'
  if (status === 'reprogramata') return 'Reprogramată'
  if (status === 'anulata') return 'Anulată'
  if (status === 'omisa') return 'Omisă'
  return 'Planificată'
}

export function isAplicareProgramata(status: AplicareTratament['status']): boolean {
  return status === 'planificata' || status === 'reprogramata'
}
