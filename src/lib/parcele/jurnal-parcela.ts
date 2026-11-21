/**
 * Jurnalul unei parcele (fișa): tot ce s-a întâmplat pe ea, pe zile — recoltări (adunate pe zi),
 * tratamente noi și vechi, lucrări, stadii. Doar ce s-a făcut (planificatele nu intră).
 * Fără React și fără Supabase.
 */
import { ETICHETA_LUCRARE } from '@/lib/lucrari/tipuri'
import { randuriLucrari, type LucrareRow } from '@/lib/lucrari/jurnal'
import { produseLot } from '@/lib/tratamente/jurnal'
import { ETICHETA_TIP, tipDinActivitateVeche, tipDinAplicare, type ActivitateVeche, type AplicareRow } from '@/lib/tratamente/model'
import { pauzaAplicarii } from '@/lib/tratamente/pauza'
import { zileText, ziuaRo } from '@/lib/tratamente/zile'

export type TipIntrare = 'recoltare' | 'tratament' | 'lucrare' | 'stadiu'

export interface IntrareJurnal {
  key: string
  tip: TipIntrare
  zi: string
  titlu: string
  detaliu: string | null
  /** Pentru ordinea din aceeași zi (cele mai noi sus). */
  moment: string
}

export interface ZiJurnal {
  zi: string
  intrari: IntrareJurnal[]
}

type RecoltareJurnal = {
  id: string
  parcela_id: string | null
  data: string | null
  kg_cal1: number | null
  kg_cal2: number | null
  culegator_id: string | null
  created_at: string
}

type StadiuJurnal = {
  id: string
  parcela_id: string
  stadiu: string
  cohort: string | null
  data_observata: string
  observatii: string | null
  created_at: string
}

const formatKg = (value: number) => `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)} kg`

const kg = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function jurnalParcela(input: {
  parcelaId: string
  recoltari: readonly RecoltareJurnal[]
  aplicari: readonly AplicareRow[]
  /** Toate rândurile din `activitati_agricole` (tratamente vechi și lucrări). */
  activitati: ReadonlyArray<ActivitateVeche & LucrareRow>
  stadii: readonly StadiuJurnal[]
  /** Numele stadiului, cu cohorta („Primocane: înflorire”). */
  numeStadiu: (stadiu: StadiuJurnal) => string
  /** „Tu” / numele din „Cine”. */
  textCine?: (cine: string | null) => string | null
  /** Azi (ora României): lucrările de după azi sunt planificate și nu intră în jurnal. */
  azi?: string | null
}): ZiJurnal[] {
  const { parcelaId } = input
  const intrari: IntrareJurnal[] = []

  // Recoltări: una pe zi, cu kg adunate și câți culegători.
  const recoltariPeZi = new Map<string, { kg: number; culegatori: Set<string>; moment: string }>()
  for (const recoltare of input.recoltari) {
    if (recoltare.parcela_id !== parcelaId) continue
    const zi = String(recoltare.data ?? '').slice(0, 10)
    if (!zi) continue
    const acc = recoltariPeZi.get(zi) ?? { kg: 0, culegatori: new Set<string>(), moment: recoltare.created_at }
    acc.kg += kg(recoltare.kg_cal1) + kg(recoltare.kg_cal2)
    if (recoltare.culegator_id) acc.culegatori.add(recoltare.culegator_id)
    if (recoltare.created_at > acc.moment) acc.moment = recoltare.created_at
    recoltariPeZi.set(zi, acc)
  }
  for (const [zi, acc] of recoltariPeZi) {
    const n = acc.culegatori.size
    intrari.push({
      key: `recoltare:${zi}`,
      tip: 'recoltare',
      zi,
      titlu: `Recoltare ${formatKg(acc.kg)}`,
      detaliu: n > 0 ? `${n} ${n === 1 ? 'culegător' : 'culegători'}` : null,
      moment: acc.moment,
    })
  }

  // Tratamente noi (doar cele făcute).
  for (const aplicare of input.aplicari) {
    if (aplicare.parcela_id !== parcelaId || aplicare.status !== 'aplicata') continue
    const zi = ziuaRo(aplicare.data_aplicata)
    if (!zi) continue
    const tip = tipDinAplicare(aplicare)
    const produse = produseLot([aplicare], tip).map((produs) => produs.nume)
    const pauza = pauzaAplicarii(aplicare).zile
    intrari.push({
      key: `aplicare:${aplicare.id}`,
      tip: 'tratament',
      zi,
      titlu: produse.length > 0 ? `${ETICHETA_TIP[tip]}: ${produse.join(' + ')}` : ETICHETA_TIP[tip],
      detaliu: pauza > 0 ? `pauză ${zileText(pauza)}` : 'fără pauză',
      moment: aplicare.created_at,
    })
  }

  // Tratamentele vechi (din Activități), cum le arată și Tratamente: „importate”.
  for (const activitate of input.activitati) {
    if (activitate.parcela_id !== parcelaId) continue
    const tip = tipDinActivitateVeche(activitate.tip_activitate)
    if (!tip) continue
    const zi = ziuaRo(activitate.data_aplicare)
    if (!zi) continue
    const produs = activitate.produs_utilizat?.trim() || activitate.tip_activitate?.trim() || 'Tratament'
    const pauza = Math.max(0, Math.floor(Number(activitate.timp_pauza_zile) || 0))
    intrari.push({
      key: `activitate:${activitate.id}`,
      tip: 'tratament',
      zi,
      titlu: `${ETICHETA_TIP[tip]}: ${produs}`,
      detaliu: ['importat', pauza > 0 ? `pauză ${zileText(pauza)}` : null].filter(Boolean).join(' · '),
      moment: activitate.created_at ?? activitate.data_aplicare,
    })
  }

  // Lucrările făcute.
  for (const rand of randuriLucrari(input.activitati.filter((row) => row.parcela_id === parcelaId), input.azi)) {
    if (rand.stare !== 'facuta' || !rand.zi) continue
    const eticheta = rand.tipOriginal ?? ETICHETA_LUCRARE[rand.tip]
    const cine = input.textCine ? input.textCine(rand.cine) : rand.cine
    intrari.push({
      key: `lucrare:${rand.key}`,
      tip: 'lucrare',
      zi: rand.zi,
      titlu: `Lucrare: ${eticheta.toLocaleLowerCase('ro-RO')}`,
      detaliu: [cine, rand.nota].filter(Boolean).join(' · ') || null,
      moment: rand.createdAt,
    })
  }

  // Stadiile.
  for (const stadiu of input.stadii) {
    if (stadiu.parcela_id !== parcelaId) continue
    const zi = String(stadiu.data_observata ?? '').slice(0, 10)
    if (!zi) continue
    intrari.push({
      key: `stadiu:${stadiu.id}`,
      tip: 'stadiu',
      zi,
      titlu: `Stadiu: ${input.numeStadiu(stadiu)}`,
      detaliu: stadiu.observatii?.trim() || null,
      moment: stadiu.created_at,
    })
  }

  const zile = new Map<string, IntrareJurnal[]>()
  for (const intrare of intrari) {
    const lista = zile.get(intrare.zi) ?? []
    lista.push(intrare)
    zile.set(intrare.zi, lista)
  }
  return [...zile.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([zi, lista]) => ({ zi, intrari: lista.sort((a, b) => b.moment.localeCompare(a.moment)) }))
}
