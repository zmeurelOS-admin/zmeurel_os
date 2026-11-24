/**
 * Vremea pe următoarele 3 zile, pe cardul de vreme din Acasă (promptul 33). Datele vin din `fetch-meteo`
 * (`forecastZile`, cu cache pe server 3 ore); aici doar le pregătim pentru ecran. Funcții pure.
 */

export type ZiPrognoza = {
  zi: string
  tempMin: number | null
  tempMax: number | null
  ploaieMm: number | null
  vantMaxKmh: number | null
  icon: string | null
}

/** De la câți mm de ploaie pe zi e „ploaie mare” (Andrei: ≥ 20 mm). */
export const PRAG_PLOAIE_MARE_MM = 20

/** Îngheț: minima ≤ 0 °C. */
export const PRAG_INGHET_C = 0

/** Zilele valide din răspuns, cel mult 3, după `azi` (ziua din București), în ordine. */
export function zilePrognoza(raw: unknown, azi: string): ZiPrognoza[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is ZiPrognoza => Boolean(item) && typeof item === 'object' && typeof (item as ZiPrognoza).zi === 'string')
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.zi) && item.zi > azi)
    .sort((a, b) => a.zi.localeCompare(b.zi))
    .slice(0, 3)
}

export type AvertizarePrognoza = { tip: 'inghet' | 'ploaie_mare'; zi: string; text: string }

/** Avertizările pentru zilele date: îngheț (min ≤ 0 °C) și ploaie mare (≥ 20 mm), prima zi pentru fiecare. */
export function avertizariPrognoza(zile: readonly ZiPrognoza[], azi: string): AvertizarePrognoza[] {
  const rezultat: AvertizarePrognoza[] = []
  const inghet = zile.find((zi) => zi.tempMin !== null && zi.tempMin <= PRAG_INGHET_C)
  if (inghet) rezultat.push({ tip: 'inghet', zi: inghet.zi, text: `Îngheț ${numeZiScurt(inghet.zi, azi).toLocaleLowerCase('ro-RO')}: ${Math.round(inghet.tempMin as number)} °C` })
  const ploaie = zile.find((zi) => zi.ploaieMm !== null && zi.ploaieMm >= PRAG_PLOAIE_MARE_MM)
  if (ploaie) rezultat.push({ tip: 'ploaie_mare', zi: ploaie.zi, text: `Ploaie mare ${numeZiScurt(ploaie.zi, azi).toLocaleLowerCase('ro-RO')}: ${Math.round(ploaie.ploaieMm as number)} mm` })
  return rezultat
}

/** „Mâine”, apoi numele zilei („Joi”), după ziua din București. */
export function numeZiScurt(zi: string, azi: string): string {
  const [y, m, d] = azi.split('-').map(Number)
  const maine = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  if (zi === maine) return 'Mâine'
  const [zy, zm, zd] = zi.split('-').map(Number)
  const nume = new Date(Date.UTC(zy, zm - 1, zd, 12)).toLocaleDateString('ro-RO', { weekday: 'long', timeZone: 'UTC' })
  return nume.charAt(0).toLocaleUpperCase('ro-RO') + nume.slice(1)
}

/** „12° / 3°”, „—” pentru o valoare lipsă. */
export function textTemperaturi(zi: Pick<ZiPrognoza, 'tempMin' | 'tempMax'>): string {
  const t = (v: number | null) => (v === null ? '—' : `${Math.round(v)}°`)
  return `${t(zi.tempMax)} / ${t(zi.tempMin)}`
}
