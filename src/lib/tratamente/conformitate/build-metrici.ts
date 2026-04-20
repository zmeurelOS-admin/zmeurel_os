import type { AplicareAgregata, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { calculeazaCupruCumulatAnual, detectConsecutiveFrac, extractFracHistory } from '@/lib/tratamente'
import type { ConformitateMetrici } from '@/lib/tratamente/conformitate/types'

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100
}

function isFutureDate(value: string | null | undefined, reference: Date): boolean {
  if (!value) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() > reference.getTime()
}

function isPastDate(value: string | null | undefined, reference: Date): boolean {
  if (!value) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() <= reference.getTime()
}

export function buildConformitateMetrici(
  aplicari: AplicareAgregata[],
  produse: ProdusFitosanitar[],
  an: number
): Omit<ConformitateMetrici, 'parcelaId'> {
  const now = new Date()
  const aplicariAplicate = aplicari.filter(
    (aplicare) => aplicare.status === 'aplicata' && Boolean(aplicare.data_aplicata)
  )

  const cupru = calculeazaCupruCumulatAnual(
    aplicariAplicate.map((aplicare) => ({
      aplicareId: aplicare.id,
      produsId: aplicare.produs_id,
      produsNume: aplicare.produs_nume,
      dataAplicata: aplicare.data_aplicata ?? '',
      dozaMlPerHl: aplicare.doza_ml_per_hl,
      dozaLPerHa: aplicare.doza_l_per_ha,
      cantitateTotalaMl: aplicare.cantitate_totala_ml,
      suprafataHa: aplicare.suprafata_ha,
    })),
    produse,
    an
  )

  const fracTimeline = extractFracHistory(
    aplicariAplicate.map((aplicare) => ({
      aplicareId: aplicare.id,
      produsId: aplicare.produs_id,
      produsNume: aplicare.produs_nume,
      dataAplicata: aplicare.data_aplicata ?? '',
    })),
    produse
  )
  const fracViolatii = detectConsecutiveFrac(fracTimeline, 2)

  const urmatoareaAplicare = [...aplicari]
    .filter(
      (aplicare) =>
        (aplicare.status === 'planificata' || aplicare.status === 'reprogramata') &&
        isFutureDate(aplicare.data_planificata, now)
    )
    .sort((left, right) => (left.data_planificata ?? '').localeCompare(right.data_planificata ?? ''))[0]

  const ultimaAplicare = [...aplicari]
    .filter((aplicare) => aplicare.status === 'aplicata' && isPastDate(aplicare.data_aplicata, now))
    .sort((left, right) => (right.data_aplicata ?? '').localeCompare(left.data_aplicata ?? ''))[0]

  return {
    an,
    cupruKgHa: roundTwo(cupru.totalKgHa),
    cupruAlertLevel: cupru.alertLevel,
    fracViolatii: fracViolatii.length,
    fracDetalii: fracViolatii.map((violatie) => ({
      frac: violatie.code,
      aplicari_consecutive: violatie.count,
    })),
    totalAplicari: aplicari.length,
    urmatoareaAplicare: urmatoareaAplicare
      ? {
          data: urmatoareaAplicare.data_planificata ?? '',
          produs: urmatoareaAplicare.produs_nume,
        }
      : null,
    ultimaAplicare: ultimaAplicare
      ? {
          data: ultimaAplicare.data_aplicata ?? '',
          produs: ultimaAplicare.produs_nume,
        }
      : null,
  }
}

