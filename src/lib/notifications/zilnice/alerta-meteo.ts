/**
 * „Îngheț și grindină”: dimineața, pentru fermele cu locul salvat (Setări › Ferma).
 *
 * Prognoza vine din Edge Function-ul `fetch-meteo` (OpenWeather 2.5, cu cache pe fermă). Ce lipsește din
 * prognoză nu dă nicio alertă: nu ghicim.
 */
import { TIPURI_ZILNICE, adaugaZile, ziuaInBucuresti, type NotificareZilnica } from './common'

/**
 * Pragurile alertelor. Se schimbă doar aici.
 *
 * Perioadele sunt zile din an, `LL-ZZ`, cu capetele incluse. Dacă `de` > `pana`, perioada trece peste
 * Anul Nou (ex. gerul: 16 noiembrie – sfârșitul lui februarie; `02-29` acoperă și 28 februarie).
 * Temperaturile sunt în °C: alerta pleacă dacă minima de la noapte e mai mică sau egală cu pragul.
 */
export const PRAGURI_METEO = {
  /** Primăvara: lăstarii și florile îngheață ușor. */
  inghetPrimavara: { de: '03-01', pana: '05-31', minimaC: 0 },
  /** Toamna: fructele târzii și butașii suportă puțin mai mult. */
  inghetToamna: { de: '09-15', pana: '11-15', minimaC: -2 },
  /** Iarna: doar gerul puternic. */
  ger: { de: '11-16', pana: '02-29', minimaC: -15 },
  /**
   * Vara: o perioadă de 3 ore cu furtună (codurile OpenWeather 2xx, iconița „11”)
   * și probabilitate de precipitații de cel puțin 50%.
   */
  furtuna: { de: '05-01', pana: '09-15', probabilitateMin: 0.5 },
} as const

type Perioada = { de: string; pana: string }

/** Ziua (`YYYY-MM-DD`) e în perioada `LL-ZZ`…`LL-ZZ`? */
export function inPerioada(ziua: string, perioada: Perioada): boolean {
  const lz = ziua.slice(5, 10)
  if (perioada.de <= perioada.pana) return lz >= perioada.de && lz <= perioada.pana
  return lz >= perioada.de || lz <= perioada.pana
}

export type PerioadaPrognoza = {
  /** `true` = furtună (cod 2xx); `false` = altă vreme; `null` = nu știm. */
  furtuna: boolean | null
  /** Probabilitatea de precipitații, 0–1. */
  probabilitate: number | null
}

export type PrognozaFerma = {
  tenantId: string
  /** Ziua de „mâine” pentru care e prognoza (`YYYY-MM-DD`, București). Altă zi = prognoză veche → nimic. */
  pentruZiua: string | null
  /** Minima pentru noaptea care vine, în °C. */
  minimaC: number | null
  /** Perioadele de 3 ore cunoscute. `null` = nu avem detaliul pe ore. */
  perioade: readonly PerioadaPrognoza[] | null
}

/** −2,4 → „−2 °C” (cu semnul minus tipografic, fără „−0”). */
export function formatGrade(valoare: number): string {
  const rotunjit = Math.round(valoare)
  if (rotunjit === 0) return '0 °C'
  return rotunjit < 0 ? `−${Math.abs(rotunjit)} °C` : `${rotunjit} °C`
}

/**
 * `acum` = momentul verificării (anotimpul se ia după ziua din București).
 * Întoarce cel mult o alertă de îngheț și una de furtună.
 */
export function alertaMeteo(prognoza: PrognozaFerma, acum: Date): NotificareZilnica[] {
  const azi = ziuaInBucuresti(acum)
  if (prognoza.pentruZiua !== adaugaZile(azi, 1)) return []

  const rezultat: NotificareZilnica[] = []
  const { tenantId } = prognoza
  const minima = typeof prognoza.minimaC === 'number' && Number.isFinite(prognoza.minimaC) ? prognoza.minimaC : null

  if (minima !== null) {
    const p = PRAGURI_METEO
    let title: string | null = null
    if (inPerioada(azi, p.ger) && minima <= p.ger.minimaC) {
      title = `Ger puternic la noapte: ${formatGrade(minima)}`
    } else if (
      (inPerioada(azi, p.inghetPrimavara) && minima <= p.inghetPrimavara.minimaC) ||
      (inPerioada(azi, p.inghetToamna) && minima <= p.inghetToamna.minimaC)
    ) {
      title = `Îngheț la noapte: ${formatGrade(minima)}`
    }
    if (title) {
      rezultat.push({
        tenantId,
        type: TIPURI_ZILNICE.meteo_inghet,
        title,
        body: 'Protejează plantele sensibile.',
        reminderKey: `meteo:${tenantId}:${TIPURI_ZILNICE.meteo_inghet}:${azi}`,
        data: { minima_c: minima, pentru_ziua: prognoza.pentruZiua },
        entityType: null,
        entityId: null,
      })
    }
  }

  if (inPerioada(azi, PRAGURI_METEO.furtuna) && prognoza.perioade) {
    let probabilitate: number | null = null
    for (const perioada of prognoza.perioade) {
      if (perioada.furtuna !== true) continue
      const pop = perioada.probabilitate
      if (typeof pop !== 'number' || !Number.isFinite(pop) || pop < PRAGURI_METEO.furtuna.probabilitateMin) continue
      probabilitate = Math.max(probabilitate ?? 0, pop)
    }
    if (probabilitate !== null) {
      rezultat.push({
        tenantId,
        type: TIPURI_ZILNICE.meteo_grindina,
        title: 'Risc de furtună cu grindină mâine',
        body: `Probabilitate ${Math.round(probabilitate * 100)}%.`,
        reminderKey: `meteo:${tenantId}:${TIPURI_ZILNICE.meteo_grindina}:${azi}`,
        data: { probabilitate, pentru_ziua: prognoza.pentruZiua },
        entityType: null,
        entityId: null,
      })
    }
  }

  return rezultat
}

/** Răspunsul lui `fetch-meteo` (doar ce folosim). */
export type RaspunsFetchMeteo = {
  available?: boolean
  fetchedAt?: string | null
  forecastTomorrow?: {
    tempMin?: number | null
    icon?: string | null
    pop?: number | null
  } | null
}

/**
 * `fetch-meteo` → prognoza pentru alertă.
 *
 * - „Mâine” e ziua de după cea în care s-a luat prognoza (`fetchedAt`), ca în Edge Function.
 * - Minima e cea mai mică temperatură din intervalele de 3 ore ale zilei de mâine (00:00–24:00),
 *   deci include dimineața de după noaptea care vine.
 * - Pe ore, `fetch-meteo` păstrează doar intervalul cu cea mai mare probabilitate de ploaie: iconița lui
 *   („11” = furtună, codurile 2xx) și probabilitatea. Pe acela îl verificăm.
 */
export function prognozaDinFetchMeteo(tenantId: string, raspuns: RaspunsFetchMeteo | null | undefined): PrognozaFerma {
  const gol: PrognozaFerma = { tenantId, pentruZiua: null, minimaC: null, perioade: null }
  if (!raspuns || raspuns.available !== true || !raspuns.fetchedAt) return gol
  const luata = new Date(raspuns.fetchedAt)
  if (Number.isNaN(luata.getTime())) return gol

  const maine = raspuns.forecastTomorrow ?? null
  const minima = typeof maine?.tempMin === 'number' && Number.isFinite(maine.tempMin) ? maine.tempMin : null
  const icon = typeof maine?.icon === 'string' && maine.icon.trim() ? maine.icon.trim() : null
  const pop = typeof maine?.pop === 'number' && Number.isFinite(maine.pop) ? maine.pop : null

  return {
    tenantId,
    pentruZiua: adaugaZile(ziuaInBucuresti(luata), 1),
    minimaC: minima,
    perioade: icon && pop !== null ? [{ furtuna: icon.startsWith('11'), probabilitate: pop }] : null,
  }
}
