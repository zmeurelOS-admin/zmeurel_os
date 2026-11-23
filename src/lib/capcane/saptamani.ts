/**
 * Capturile pe săptămână (luni–duminică), pe grup: barele din grafic, „peste prag”, rezumatul de pe listă și
 * registrul. Funcții pure.
 */
import { adaugaZile } from '@/lib/notifications/zilnice/common'

import type { VerificareCapcana } from './model'
import { pestePrag, type PragTip } from './prag'

/** Lunea săptămânii în care cade ziua (`YYYY-MM-DD`). */
export function inceputSaptamana(zi: string): string {
  const [y, m, d] = zi.slice(0, 10).split('-').map(Number)
  const ziSapt = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() // 0 = duminică
  return adaugaZile(zi.slice(0, 10), -((ziSapt + 6) % 7))
}

export interface SaptamanaCapturi {
  /** Lunea săptămânii. */
  start: string
  /** Totalul capturilor din grup în săptămână; `null` = nicio verificare în săptămâna aceea. */
  capturi: number | null
  /** În câte zile s-a verificat în săptămână. */
  verificari: number
  /** Ultima zi de verificare din săptămână. */
  ultimaZi: string | null
}

/**
 * Totalurile pe săptămână ale unui grup, de la prima la ultima săptămână cu verificări (săptămânile fără verificare
 * dintre ele apar cu `capturi: null`). Opțional se taie la `[de, pana]` și se întind până la `pana`.
 */
export function totaluriPeSaptamana(
  verificari: ReadonlyArray<Pick<VerificareCapcana, 'data' | 'capturi'>>,
  optiuni: { de?: string; pana?: string } = {},
): SaptamanaCapturi[] {
  const peSaptamana = new Map<string, { capturi: number; zile: Set<string> }>()
  for (const verificare of verificari) {
    const zi = verificare.data.slice(0, 10)
    if (optiuni.de && zi < optiuni.de) continue
    if (optiuni.pana && zi > optiuni.pana) continue
    const start = inceputSaptamana(zi)
    const curent = peSaptamana.get(start) ?? { capturi: 0, zile: new Set<string>() }
    curent.capturi += Math.max(0, verificare.capturi)
    curent.zile.add(zi)
    peSaptamana.set(start, curent)
  }
  if (peSaptamana.size === 0) return []
  const starturi = [...peSaptamana.keys()].sort()
  const ultima = optiuni.pana ? inceputSaptamana(optiuni.pana) : starturi[starturi.length - 1]
  const rezultat: SaptamanaCapturi[] = []
  for (let start = starturi[0]; start <= ultima; start = adaugaZile(start, 7)) {
    const date = peSaptamana.get(start)
    rezultat.push(
      date
        ? { start, capturi: date.capturi, verificari: date.zile.size, ultimaZi: [...date.zile].sort().at(-1) ?? null }
        : { start, capturi: null, verificari: 0, ultimaZi: null },
    )
  }
  return rezultat
}

/** Totalul capturilor din săptămâna în care cade ziua (`null` = nicio verificare). */
export function capturiInSaptamana(verificari: ReadonlyArray<Pick<VerificareCapcana, 'data' | 'capturi'>>, zi: string): number | null {
  const start = inceputSaptamana(zi)
  const sfarsit = adaugaZile(start, 6)
  let total: number | null = null
  for (const verificare of verificari) {
    const ziua = verificare.data.slice(0, 10)
    if (ziua < start || ziua > sfarsit) continue
    total = (total ?? 0) + Math.max(0, verificare.capturi)
  }
  return total
}

export interface StareGrup {
  /** Ziua ultimei verificări, sau `null`. */
  ultimaVerificare: string | null
  /** Capturile din săptămâna ultimei verificări. */
  capturiSaptamana: number | null
  /** Capturile la ultima verificare (toate capcanele din grup, în ziua aceea). */
  capturiUltima: number | null
  pestePrag: boolean
}

/**
 * Starea unui grup pentru listă: ultima verificare, capturile din săptămâna ei și dacă e peste prag.
 * `inCoacere(zi)` spune dacă parcela era în coacere în ziua ultimei verificări.
 */
export function stareGrup(input: {
  verificari: ReadonlyArray<Pick<VerificareCapcana, 'data' | 'capturi'>>
  nrBucati: number
  prag: PragTip | null
  inCoacere: (zi: string) => boolean
}): StareGrup {
  if (input.verificari.length === 0) return { ultimaVerificare: null, capturiSaptamana: null, capturiUltima: null, pestePrag: false }
  const ultima = input.verificari.reduce((max, v) => (v.data.slice(0, 10) > max ? v.data.slice(0, 10) : max), input.verificari[0].data.slice(0, 10))
  const capturiUltima = input.verificari.filter((v) => v.data.slice(0, 10) === ultima).reduce((suma, v) => suma + Math.max(0, v.capturi), 0)
  const capturiSaptamana = capturiInSaptamana(input.verificari, ultima)
  return {
    ultimaVerificare: ultima,
    capturiSaptamana,
    capturiUltima,
    pestePrag: pestePrag({ capturi: capturiSaptamana, nrBucati: input.nrBucati, prag: input.prag, inCoacere: input.inCoacere(ultima) }),
  }
}

const LUNI_SCURTE = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * Etichetele de sub bare: ziua și luna la prima bară și când se schimbă luna („27 mai”, „3 iun”), altfel doar ziua
 * („10”, „17”).
 */
export function eticheteSaptamani(starturi: readonly string[]): string[] {
  let lunaAnterioara = -1
  return starturi.map((start) => {
    const luna = Number(start.slice(5, 7)) - 1
    const zi = Number(start.slice(8, 10))
    const text = luna !== lunaAnterioara ? `${zi} ${LUNI_SCURTE[luna] ?? ''}` : String(zi)
    lunaAnterioara = luna
    return text
  })
}
