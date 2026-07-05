/**
 * Normalizează orice număr de telefon (românesc sau internațional) la un
 * format canonic E.164-like: `+<cod_țară><număr>`, fără spații/paranteze/
 * liniuțe.
 *
 * Motivul existenței acestei funcții: `clienti.telefon` avea un index unic pe
 * (tenant_id, telefon), dar telefonul ajungea în baza de date în formate
 * diferite în funcție de sursă — formular manual („0745...”), Google
 * Contacts sync („+40745...”), import CSV, comenzi shop — așa că indexul
 * unic nu prindea dublurile reale (vezi migrarea manuală din
 * `clienti_merge_audit`). Toate punctele de scriere pe `clienti.telefon`
 * trebuie să treacă prin această funcție înainte de INSERT/UPDATE.
 *
 * Reguli:
 * - Dacă valoarea are deja `+`, e considerată explicit internațională —
 *   păstrăm codul de țară așa cum e (ex: `+44...` rămâne `+44...`, NU e
 *   forțat spre România).
 * - Fără `+`, aplicăm euristici specifice formatului românesc (singurul
 *   ambiguu în practică): `0040...`, `40...` (11 cifre), `0...` (10 cifre,
 *   naţional) → canonicalizate spre `+40...`.
 * - Un număr de 9 cifre fără niciun prefix (ex: „745023593”) e tratat ca
 *   subscriber number românesc fără 0 inițial → `+40745023593`.
 * - Orice altceva (format necunoscut) e doar prefixat cu `+`, fără să
 *   inventăm un cod de țară.
 * - Nu aruncă niciodată o eroare; pentru input gol/fără cifre întoarce
 *   inputul trim-uit neschimbat (nu distrugem date malformate).
 */
export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed

  if (hadPlus) {
    return `+${digits}`
  }

  // 0040xxxxxxxxx (13 cifre) → +40xxxxxxxxx
  if (digits.startsWith('0040') && digits.length === 13) {
    return `+40${digits.slice(4)}`
  }

  // 40xxxxxxxxx (11 cifre, cod țară RO fără +) → +40xxxxxxxxx
  if (digits.startsWith('40') && digits.length === 11) {
    return `+${digits}`
  }

  // 0xxxxxxxxx (10 cifre, format național RO — mobil sau fix) → +40xxxxxxxx
  if (digits.startsWith('0') && digits.length === 10) {
    return `+40${digits.slice(1)}`
  }

  // 9 cifre fără niciun prefix (subscriber number RO fără 0 inițial)
  if (digits.length === 9) {
    return `+40${digits}`
  }

  // Format necunoscut — uniformizăm cu prefix "+", fără să presupunem țara
  return `+${digits}`
}
