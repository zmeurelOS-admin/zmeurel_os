/**
 * Avertismentele din formularul de stropire. Informative: nu blochează salvarea.
 *
 * - aceeași grupă FRAC / IRAC ca tratamentul anterior pe aceeași parcelă (ultimele 30 de zile);
 * - numărul maxim de aplicări pe sezon atins (`nr_max_aplicari_per_sezon`; sezon = anul calendaristic);
 * - intervalul minim între aplicări neatins (`interval_min_aplicari_zile`);
 * - ploaie / vânt în prognoză (câmpul `spray` din `fetch-meteo`), doar la „Făcut acum”.
 */
import { zileIntre, ziRelativaRo } from './zile'

export type AvertismentTip = 'frac' | 'max_sezon' | 'interval' | 'meteo' | 'cules'

export interface Avertisment {
  tip: AvertismentTip
  titlu: string
  detaliu: string
}

export interface ProdusNou {
  produsId: string | null
  nume: string
  frac: string | null
  nrMaxPeSezon: number | null
  intervalMinZile: number | null
}

/** O aplicare făcută (din istoricul fermei), redusă la ce trebuie avertismentelor. */
export interface AplicareIstoric {
  parcelaId: string
  /** Ziua aplicării, ora României. */
  zi: string
  produse: ReadonlyArray<{ produsId: string | null; nume: string; frac: string | null }>
}

/**
 * „FRAC 9 + 12” → [„FRAC 9”, „FRAC 12”]; „IRAC 3A” → [„IRAC 3A”]; „FRAC M01” → [„FRAC M1”].
 * Fără prefix (scris de mână: „9+12”) se presupune FRAC.
 */
export function grupeRezistenta(frac: string | null | undefined): string[] {
  const text = String(frac ?? '').toUpperCase().trim()
  if (!text) return []
  const result: string[] = []
  let prefix = 'FRAC'
  for (const bucata of text.split(/[+,/;]|\bși\b|\bSI\b/i)) {
    const curat = bucata.trim()
    if (!curat) continue
    const match = /^(FRAC|IRAC|HRAC)?\s*([A-Z]?\d+[A-Z]?|[A-Z]\d*)$/.exec(curat)
    if (!match) continue
    if (match[1]) prefix = match[1]
    // „M01” și „M1” sunt aceeași grupă.
    const cod = match[2].replace(/^([A-Z]?)0+(\d)/, '$1$2')
    const grupa = `${prefix} ${cod}`
    if (!result.includes(grupa)) result.push(grupa)
  }
  return result
}

/** [„FRAC 9”, „FRAC 12”] → „Grupa FRAC 9 și 12”; prefixe diferite → „Grupele FRAC 9 și IRAC 3A”. */
function textGrupe(grupe: readonly string[]): string {
  if (grupe.length === 1) return `Grupa ${grupe[0]}`
  const prefixe = new Set(grupe.map((grupa) => grupa.split(' ')[0]))
  if (prefixe.size === 1) {
    const [prefix] = [...prefixe]
    const coduri = grupe.map((grupa) => grupa.slice(prefix.length + 1))
    return `Grupa ${prefix} ${coduri.slice(0, -1).join(', ')} și ${coduri[coduri.length - 1]}`
  }
  return `Grupele ${grupe.slice(0, -1).join(', ')} și ${grupe[grupe.length - 1]}`
}

const cheieProdus = (produs: { produsId: string | null; nume: string }) =>
  produs.produsId ? `id:${produs.produsId}` : `nume:${produs.nume.trim().toLocaleLowerCase('ro-RO')}`

/** Câte aplicări ale aceluiași produs a avut parcela în anul calendaristic al zilei `zi` (până la `zi` inclusiv). */
function aplicariInSezon(istoric: readonly AplicareIstoric[], parcelaId: string, produs: ProdusNou, zi: string): AplicareIstoric[] {
  const an = zi.slice(0, 4)
  const cheie = cheieProdus(produs)
  return istoric.filter(
    (aplicare) =>
      aplicare.parcelaId === parcelaId &&
      aplicare.zi.slice(0, 4) === an &&
      aplicare.zi <= zi &&
      aplicare.produse.some((item) => cheieProdus(item) === cheie),
  )
}

export function avertismenteStropire(input: {
  produse: readonly ProdusNou[]
  parcele: ReadonlyArray<{ id: string; nume: string }>
  istoric: readonly AplicareIstoric[]
  /** Ziua tratamentului (azi la „Făcut acum”, ziua aleasă altfel). */
  zi: string
  azi: string
}): Avertisment[] {
  const avertismente: Avertisment[] = []
  const vazute = new Set<string>()
  const adauga = (avertisment: Avertisment) => {
    const cheie = `${avertisment.tip}:${avertisment.titlu}`
    if (vazute.has(cheie)) return
    vazute.add(cheie)
    avertismente.push(avertisment)
  }

  for (const parcela of input.parcele) {
    // Tratamentul anterior pe parcelă, cu cel puțin un produs cu grupă, din ultimele 30 de zile.
    const anterior = input.istoric
      .filter(
        (aplicare) =>
          aplicare.parcelaId === parcela.id &&
          aplicare.zi <= input.zi &&
          zileIntre(aplicare.zi, input.zi) <= 30 &&
          aplicare.produse.some((item) => grupeRezistenta(item.frac).length > 0),
      )
      .sort((a, b) => b.zi.localeCompare(a.zi))[0]

    if (anterior) {
      for (const produs of input.produse) {
        // Un singur avertisment pe produs, cu toate grupele comune („FRAC 9 și 12”).
        const comune = grupeRezistenta(produs.frac).filter((grupa) =>
          anterior.produse.some((item) => grupeRezistenta(item.frac).includes(grupa)),
        )
        if (comune.length === 0) continue
        const vechi = anterior.produse.find((item) => grupeRezistenta(item.frac).includes(comune[0]))!
        const text = textGrupe(comune)
        adauga({
          tip: 'frac',
          titlu: `${text}, de două ori la rând`,
          detaliu: `${produs.nume} e tot ${text.charAt(0).toLocaleLowerCase('ro-RO')}${text.slice(1)}, ca ${vechi.nume} (${ziRelativaRo(anterior.zi, input.azi).toLocaleLowerCase('ro-RO')}, ${parcela.nume}). Alternează grupele, ca boala să nu devină rezistentă.`,
        })
      }
    }

    for (const produs of input.produse) {
      const inSezon = aplicariInSezon(input.istoric, parcela.id, produs, input.zi)
      const max = produs.nrMaxPeSezon
      if (max !== null && max > 0 && inSezon.length >= max) {
        adauga({
          tip: 'max_sezon',
          titlu: `${produs.nume}: maximum ${max} pe sezon`,
          detaliu: `Pe ${parcela.nume} a fost aplicat deja de ${inSezon.length} ${inSezon.length === 1 ? 'dată' : 'ori'} anul acesta. Eticheta permite ${max}.`,
        })
      }
      const interval = produs.intervalMinZile
      const ultima = inSezon.sort((a, b) => b.zi.localeCompare(a.zi))[0]
      if (interval !== null && interval > 0 && ultima) {
        const trecute = zileIntre(ultima.zi, input.zi)
        if (trecute < interval) {
          adauga({
            tip: 'interval',
            titlu: `${produs.nume}: prea devreme`,
            detaliu: `Pe ${parcela.nume} au trecut ${trecute} ${trecute === 1 ? 'zi' : 'zile'} de la ultima aplicare. Eticheta cere cel puțin ${interval}.`,
          })
        }
      }
    }
  }

  return avertismente
}

/** Ploaie / vânt: doar la „Făcut acum”. `spray` vine din `fetch-meteo`. */
export function avertismentMeteo(spray: { canSpray: boolean; reason?: string } | null | undefined): Avertisment | null {
  if (!spray || spray.canSpray) return null
  return {
    tip: 'meteo',
    titlu: 'Nu e vreme bună de stropit',
    detaliu: spray.reason?.trim() || 'Prognoza arată ploaie sau vânt. Poți salva oricum.',
  }
}
