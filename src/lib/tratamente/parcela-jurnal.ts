import type { AplicareTratamentDetaliu, JurnalAplicareItem } from '@/lib/supabase/queries/tratamente'

function getProdusDisplayNameFromDetaliu(
  produs: NonNullable<AplicareTratamentDetaliu['produse_aplicare']>[number]
): string {
  return (
    produs.produs?.nume_comercial ??
    produs.produs_nume_snapshot ??
    produs.produs_nume_manual ??
    'Produs'
  )
}

function formatJurnalDozaFromDetaliu(
  produs: NonNullable<AplicareTratamentDetaliu['produse_aplicare']>[number]
): string {
  const cantitateText = produs.cantitate_text?.trim()
  if (cantitateText) return cantitateText
  if (produs.doza_ml_per_hl != null) return `${produs.doza_ml_per_hl} ml/hl`
  if (produs.doza_l_per_ha != null) return `${produs.doza_l_per_ha} l/ha`
  return ''
}

function effectiveAplicareDate(aplicare: AplicareTratamentDetaliu): string {
  return aplicare.data_aplicata ?? aplicare.data_planificata ?? aplicare.created_at
}

/** Mapează aplicările parcelei la formatul jurnalului hub (doar afișare, fără query nou). */
export function mapAplicariParcelaToJurnal(
  aplicari: AplicareTratamentDetaliu[],
  parcelaNume: string,
  limit = 50
): JurnalAplicareItem[] {
  return [...aplicari]
    .filter(
      (aplicare): aplicare is AplicareTratamentDetaliu & { status: 'aplicata' | 'ciorna' } =>
        aplicare.status === 'aplicata' || aplicare.status === 'ciorna'
    )
    .sort((first, second) => effectiveAplicareDate(second).localeCompare(effectiveAplicareDate(first)))
    .slice(0, limit)
    .map((aplicare) => {
      const produseAplicare = aplicare.produse_aplicare ?? []
      const produse =
        produseAplicare.length > 0
          ? produseAplicare.map((produs) => ({
              nume: getProdusDisplayNameFromDetaliu(produs),
              dozaText: formatJurnalDozaFromDetaliu(produs),
            }))
          : [
              {
                nume:
                  aplicare.produs?.nume_comercial ??
                  aplicare.produs_nume_manual ??
                  'Produs',
                dozaText: '',
              },
            ]

      return {
        aplicareId: aplicare.id,
        dataAplicata: effectiveAplicareDate(aplicare),
        parcelaId: aplicare.parcela_id,
        parcelaNume,
        metodaAplicare: aplicare.metoda_aplicare ?? null,
        produse,
        status: aplicare.status,
      }
    })
}
