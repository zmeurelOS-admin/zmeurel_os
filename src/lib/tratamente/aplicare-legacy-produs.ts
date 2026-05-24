/**
 * Câmpurile legacy `produs_id` / `produs_nume_manual` pe `aplicari_tratament` sunt guvernate de
 * `aplicari_tratament_produs_xor_check`: exact unul dintre bibliotecă (id) sau nume manual (non-gol).
 */

/** Sentinel pentru intervenții fără produs fizic (capcane, monitorizare). */
export const APLICARE_LEGACY_PRODUS_FARA_PRODUS = '— fără produs'

export type AplicareLegacyProdusFields = {
  produs_id: null
  produs_nume_manual: string
}

/** Payload legacy acceptat de DB pentru aplicări fără produs (XOR: id null + manual non-gol). */
export function aplicareLegacyProdusFieldsFaraProdus(): AplicareLegacyProdusFields {
  return {
    produs_id: null,
    produs_nume_manual: APLICARE_LEGACY_PRODUS_FARA_PRODUS,
  }
}

/** Oglindă a condiției SQL din migrarea `20260416110000_tratamente_foundation_tables.sql`. */
export function satisfiesAplicariTratamentProdusXorCheck(fields: {
  produs_id?: string | null
  produs_nume_manual?: string | null
}): boolean {
  const hasProdusId = fields.produs_id != null
  const manualTrimmed = (fields.produs_nume_manual ?? '').trim()
  const hasManual = manualTrimmed.length > 0
  return (hasProdusId && !hasManual) || (!hasProdusId && hasManual)
}
