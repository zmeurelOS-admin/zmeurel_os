/**
 * Sezonul pe parcelă: kg recoltate (sezonul = regula unică `inceputSezon` din `lib/sezon`), kg pe plantă,
 * câte tratamente în anul curent și ultima fertirigare. Fără React și fără Supabase.
 *
 * Tratamentele se numără din anul curent (1 ianuarie), nu de la prima recoltare: stropirile de primăvară
 * vin înaintea recoltării și ar ieși altfel din numărătoare.
 */
import { tipDinActivitateVeche, tipDinAplicare, type ActivitateVeche, type AplicareRow } from '@/lib/tratamente/model'
import { ziuaRo } from '@/lib/tratamente/zile'

type RecoltareKg = { parcela_id: string | null; data: string | null; kg_cal1: number | null; kg_cal2: number | null }

const kg = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const zi = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

/** Kg (cal. 1 + cal. 2) pe parcelă între `start` și `azi`, inclusiv. */
export function kgPeParcela(recoltari: readonly RecoltareKg[], start: string, azi: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const recoltare of recoltari) {
    if (!recoltare.parcela_id) continue
    const day = zi(recoltare.data)
    if (!day || day < start || day > azi) continue
    map.set(recoltare.parcela_id, (map.get(recoltare.parcela_id) ?? 0) + kg(recoltare.kg_cal1) + kg(recoltare.kg_cal2))
  }
  return map
}

export interface SezonParcela {
  kg: number
  /** `null` = parcela n-are număr de plante. */
  kgPePlanta: number | null
  tratamente: number
  /** Ziua ultimei fertirigări (ora României). */
  ultimaFertirigare: string | null
}

export function sezonParcela(input: {
  parcela: { id: string; nr_plante?: number | null }
  recoltari: readonly RecoltareKg[]
  aplicari: readonly AplicareRow[]
  activitati: readonly ActivitateVeche[]
  start: string
  azi: string
}): SezonParcela {
  const { parcela, start, azi } = input
  const total = kgPeParcela(input.recoltari, start, azi).get(parcela.id) ?? 0
  const plante = Number(parcela.nr_plante)
  const an = `${azi.slice(0, 4)}-01-01`

  let tratamente = 0
  let ultimaFertirigare: string | null = null
  const noteaza = (day: string | null, fertirigare: boolean) => {
    if (!day || day < an || day > azi) return
    tratamente += 1
    if (fertirigare && (!ultimaFertirigare || day > ultimaFertirigare)) ultimaFertirigare = day
  }

  for (const aplicare of input.aplicari) {
    if (aplicare.parcela_id !== parcela.id || aplicare.status !== 'aplicata') continue
    noteaza(ziuaRo(aplicare.data_aplicata), tipDinAplicare(aplicare) === 'fertirigare')
  }
  for (const activitate of input.activitati) {
    if (activitate.parcela_id !== parcela.id) continue
    const tip = tipDinActivitateVeche(activitate.tip_activitate)
    if (!tip) continue
    noteaza(ziuaRo(activitate.data_aplicare), tip === 'fertirigare')
  }

  return {
    kg: Math.round(total * 100) / 100,
    kgPePlanta: Number.isFinite(plante) && plante > 0 ? Math.round((total / plante) * 100) / 100 : null,
    tratamente,
    ultimaFertirigare,
  }
}
