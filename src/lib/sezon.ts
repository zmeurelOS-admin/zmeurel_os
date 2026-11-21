/**
 * O singură regulă de sezon, pentru Acasă (telefon și desktop), Culegători și Rapoarte:
 * sezonul începe la prima recoltare din anul curent; dacă anul acesta nu e nicio recoltare, de la 1 ianuarie.
 * Zilele sunt text ISO (`2026-06-14`). Funcții pure.
 */

type CuData = { data: string | null | undefined }

const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

/** Zilele de recoltare din anul `an` (`'2026'`), cel mult până la `panaLaIso` (inclusiv). */
export function zileRecoltareDinAn(recoltari: readonly CuData[], an: string, panaLaIso?: string): string[] {
  return recoltari
    .map((recoltare) => dayOf(recoltare.data))
    .filter((day) => day.startsWith(`${an}-`) && (!panaLaIso || day <= panaLaIso))
}

/** Începutul sezonului din anul `an`: prima recoltare din acel an (până la `panaLaIso`), altfel 1 ianuarie. */
export function inceputSezonAn(an: number, recoltari: readonly CuData[], panaLaIso?: string): string {
  const zile = zileRecoltareDinAn(recoltari, String(an), panaLaIso)
  if (zile.length === 0) return `${an}-01-01`
  return zile.reduce((earliest, day) => (day < earliest ? day : earliest))
}

/** Începutul sezonului curent, pentru ziua `todayIso`. */
export function inceputSezon(todayIso: string, recoltari: readonly CuData[]): string {
  return inceputSezonAn(Number(todayIso.slice(0, 4)), recoltari, todayIso)
}
