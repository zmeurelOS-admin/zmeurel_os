/**
 * „Plan nou · Din ce am aplicat în <anul trecut>”: aplicările făcute anul trecut, grupate pe stadiul parcelei din
 * ziua aplicării (din istoricul de stadii; dacă lipsește, omul îl alege din listă). Aceleași produse, aceeași metodă,
 * în același stadiu = un grup; aplicările repetate devin o linie cu „repetă la ~N zile”. Un tratament pe mai multe
 * parcele în aceeași zi contează o singură dată. Funcții pure.
 */
import { getOrdine, type StadiuCod } from '@/lib/parcele/stadii-canonic'
import { zileIntre } from '@/lib/tratamente/zile'

import type { MetodaLinie } from './model'
import { stadiuLaData, type StadiuRand } from './stadii'

export interface ProdusAplicat {
  produs_id: string | null
  nume: string
  tip: string | null
  phi: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  cantitate_text: string | null
}

export interface AplicareAnTrecut {
  id: string
  parcela_id: string
  zi: string
  metoda: MetodaLinie | null
  produse: ProdusAplicat[]
}

export interface GrupAnTrecut {
  /** Cheie stabilă (stadiu + metodă + produse). */
  cheie: string
  /** `null` = parcela n-avea stadiu notat în ziua aplicării: îl alege omul. */
  stadiu: StadiuCod | null
  metoda: MetodaLinie | null
  produse: ProdusAplicat[]
  /** Zilele distincte în care s-a aplicat (crescător). */
  zile: string[]
  parcelaIds: string[]
  /** Aplicat de cel puțin 2 ori: intervalul tipic, rotunjit. */
  repetare: { zile: number; ori: number } | null
}

const semnatura = (produse: readonly ProdusAplicat[]) =>
  produse
    .map((p) => (p.produs_id ? `id:${p.produs_id}` : `nume:${p.nume.trim().toLocaleLowerCase('ro-RO')}`))
    .sort()
    .join('+')

/** Intervalul tipic dintre zile (mediana diferențelor), rotunjit la zile întregi; `null` sub 2 zile. */
export function intervalTipic(zile: readonly string[]): number | null {
  if (zile.length < 2) return null
  const diferente: number[] = []
  for (let i = 1; i < zile.length; i += 1) diferente.push(zileIntre(zile[i - 1], zile[i]))
  const sortate = diferente.filter((d) => d > 0).sort((a, b) => a - b)
  if (sortate.length === 0) return null
  const mijloc = Math.floor(sortate.length / 2)
  const mediana = sortate.length % 2 === 1 ? sortate[mijloc] : (sortate[mijloc - 1] + sortate[mijloc]) / 2
  return Math.max(1, Math.round(mediana))
}

export function grupeazaAnTrecut(aplicari: readonly AplicareAnTrecut[], stadii: readonly StadiuRand[]): GrupAnTrecut[] {
  const grupuri = new Map<string, GrupAnTrecut>()
  const ordonate = [...aplicari].filter((a) => a.produse.length > 0 && a.zi).sort((a, b) => a.zi.localeCompare(b.zi))
  for (const aplicare of ordonate) {
    const stadiu = stadiuLaData(stadii, aplicare.parcela_id, aplicare.zi)
    const cheie = `${stadiu ?? '?'}|${aplicare.metoda ?? '?'}|${semnatura(aplicare.produse)}`
    const grup = grupuri.get(cheie) ?? { cheie, stadiu, metoda: aplicare.metoda, produse: aplicare.produse, zile: [], parcelaIds: [], repetare: null }
    if (!grup.zile.includes(aplicare.zi)) grup.zile.push(aplicare.zi)
    if (!grup.parcelaIds.includes(aplicare.parcela_id)) grup.parcelaIds.push(aplicare.parcela_id)
    // Dozele: ultima aplicare câștigă.
    grup.produse = aplicare.produse
    grupuri.set(cheie, grup)
  }
  return [...grupuri.values()]
    .map((grup) => {
      const zile = [...grup.zile].sort()
      const interval = intervalTipic(zile)
      return { ...grup, zile, repetare: interval ? { zile: interval, ori: zile.length } : null }
    })
    .sort((a, b) => {
      const sa = a.stadiu ? getOrdine(a.stadiu) : Number.MAX_SAFE_INTEGER
      const sb = b.stadiu ? getOrdine(b.stadiu) : Number.MAX_SAFE_INTEGER
      return sa - sb || a.zile[0].localeCompare(b.zile[0])
    })
}

const LUNI_SCURT = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.']

/** „aplicat 5 iun. 2026” sau „aplicat de 3 ori, la ~10 zile”. */
export function textGrup(grup: Pick<GrupAnTrecut, 'zile' | 'repetare'>): string {
  if (grup.repetare && grup.zile.length >= 2) return `aplicat de ${grup.zile.length} ori, la ~${grup.repetare.zile} zile`
  const zi = grup.zile[0]
  if (!zi) return ''
  return `aplicat ${Number(zi.slice(8, 10))} ${LUNI_SCURT[Number(zi.slice(5, 7)) - 1]} ${zi.slice(0, 4)}`
}
