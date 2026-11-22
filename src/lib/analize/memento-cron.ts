/**
 * Pasul „Analiza dinainte de cules” din cronul de dimineață (`/api/cron/notificari-dimineata`, 05:00 UTC:
 * 8:00 vara, 7:00 iarna, ora României; culesul e vara). Pentru o fermă reală:
 *   - citește (service role, doar `select`) parcelele de vânzare, data culesului pusă de mână, prima recoltare
 *     de anul trecut, analizele sezonului, starea mementoului, preferințele proprietarului și produsele fermei;
 *   - decide cu `calculeazaMemento` (funcție pură);
 *   - trimite o singură notificare proprietarului (cheia `analize:<fermă>:<zi>`), cu butoanele „Am trimis” și
 *     „Amână 3 zile”; push-ul respectă comutatorul `analize` și liniștea 22–6 (`createNotification`);
 *   - notează ziua trimiterii în `memento_analize_sezon.ultima_trimitere`.
 * Fără migrarea 20261122111000 (tabelul stării lipsește) nu trimite nimic: amânarea nu s-ar putea ține minte.
 */
import { citestePreferinteNotificari } from '@/lib/notifications/preferinte-server'
import { isMissingTableError, setariAnalize } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { NotificareZilnica } from '@/lib/notifications/zilnice/common'

import { estimeazaCules } from './cules'
import {
  AMANARE_IMPLICITA,
  TIP_MEMENTO_ANALIZE,
  calculeazaMemento,
  linkAnalizaNoua,
  produseDeEvitat,
  textNotificareMemento,
  type CalculMemento,
} from './memento'
import { esteParcelaDeVanzare } from './model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof getSupabaseAdmin> | any

type Rezultat<T> = PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>

export type DecizieMementoFerma =
  | { trimite: false; motiv: CalculMemento['motiv'] | 'indisponibil' }
  | { trimite: true; notificare: NotificareZilnica; calcul: CalculMemento }

/** Notificarea gata de trimis, din calcul (funcție pură, testată). */
export function notificareMemento(input: {
  tenantId: string
  azi: string
  calcul: CalculMemento
  produseDeEvitat: number
}): NotificareZilnica {
  const { calcul } = input
  const zileRamase = calcul.zileRamase ?? 0
  const text = textNotificareMemento({ zileRamase, parcele: calcul.parcele.map((p) => p.nume), produseDeEvitat: input.produseDeEvitat })
  const parcelaIds = calcul.parcele.map((p) => p.parcelaId)
  return {
    tenantId: input.tenantId,
    type: TIP_MEMENTO_ANALIZE,
    title: text.title,
    body: text.body,
    reminderKey: `analize:${input.tenantId}:${input.azi}`,
    data: {
      zi: input.azi,
      data_cules: calcul.dataCules,
      zile_ramase: zileRamase,
      parcela_ids: parcelaIds,
      push_actions: [
        { action: 'am-trimis', title: 'Am trimis', url: linkAnalizaNoua(parcelaIds) },
        { action: 'amana', title: `Amână ${AMANARE_IMPLICITA} zile`, post: '/api/analize/memento/amana' },
      ],
    },
    entityType: 'analize',
    entityId: null,
  }
}

/** Decizia pentru o fermă (doar citire). */
export async function decizieMementoFerma(admin: Admin, ferma: { id: string; ownerUserId: string }, azi: string): Promise<DecizieMementoFerma> {
  const an = Number(azi.slice(0, 4))

  const stareRes = await (admin.from('memento_analize_sezon').select('dezactivat,amanat_pana').eq('tenant_id', ferma.id).eq('an', an).maybeSingle() as Rezultat<{
    dezactivat: boolean
    amanat_pana: string | null
  }>)
  if (stareRes.error) {
    if (isMissingTableError(stareRes.error)) return { trimite: false, motiv: 'indisponibil' }
    throw stareRes.error
  }

  const preferinte = setariAnalize(await citestePreferinteNotificari(ferma.ownerUserId))
  if (!preferinte.pornit) return { trimite: false, motiv: 'oprit' }
  if (stareRes.data?.dezactivat) return { trimite: false, motiv: 'dezactivat' }

  const parceleRes = await (admin.from('parcele').select('id,nume_parcela,rol').eq('tenant_id', ferma.id).limit(1000) as Rezultat<
    Array<{ id: string; nume_parcela: string | null; rol: string | null }>
  >)
  if (parceleRes.error) throw parceleRes.error
  const parcele = (parceleRes.data ?? []).filter(esteParcelaDeVanzare)
  if (parcele.length === 0) return { trimite: false, motiv: 'fara_data' }

  const manuale = new Map<string, string | null>()
  const culesRes = await (admin.from('configurari_parcela_sezon').select('parcela_id,data_inceput_cules').eq('tenant_id', ferma.id).eq('an', an) as Rezultat<
    Array<{ parcela_id: string; data_inceput_cules: string | null }>
  >)
  if (culesRes.error && !isMissingColumnError(culesRes.error)) throw culesRes.error
  for (const row of culesRes.data ?? []) manuale.set(row.parcela_id, row.data_inceput_cules)

  const recoltariRes = await (admin
    .from('recoltari')
    .select('parcela_id,data')
    .eq('tenant_id', ferma.id)
    .gte('data', `${an - 1}-01-01`)
    .lte('data', `${an - 1}-12-31`)
    .order('data', { ascending: true })
    .limit(5000) as Rezultat<Array<{ parcela_id: string | null; data: string }>>)
  if (recoltariRes.error) throw recoltariRes.error
  const recoltari = recoltariRes.data ?? []

  const analizeRes = await (admin
    .from('analize_fructe')
    .select('data_prelevare,parcele:analize_fructe_parcele(parcela_id)')
    .eq('tenant_id', ferma.id)
    .gte('data_prelevare', `${an}-01-01`) as Rezultat<Array<{ data_prelevare: string; parcele: Array<{ parcela_id: string }> | null }>>)
  if (analizeRes.error && !isMissingTableError(analizeRes.error)) throw analizeRes.error
  const analize = (analizeRes.data ?? []).map((a) => ({ data_prelevare: a.data_prelevare, parcele: (a.parcele ?? []).map((p) => p.parcela_id) }))

  const calcul = calculeazaMemento({
    azi,
    parcele: parcele.map((parcela) => ({
      parcelaId: parcela.id,
      nume: parcela.nume_parcela?.trim() || 'Parcelă',
      dataCules: estimeazaCules({ parcelaId: parcela.id, an, manual: manuale.get(parcela.id) ?? null, recoltari }).data,
    })),
    analize,
    setari: preferinte,
    stare: { dezactivat: false, amanatPana: stareRes.data?.amanat_pana ?? null },
  })
  if (!calcul.trimiteAzi) return { trimite: false, motiv: calcul.motiv }

  return {
    trimite: true,
    calcul,
    notificare: notificareMemento({
      tenantId: ferma.id,
      azi,
      calcul,
      produseDeEvitat: produseDeEvitat(await produseFerma(admin, ferma.id), calcul.zileRamase ?? 0).length,
    }),
  }
}

/** Produsele fermei: catalogul propriu și produsele folosite în tratamente (nume + pauza). */
export async function produseFerma(admin: Admin, tenantId: string): Promise<Array<{ nume: string | null; pauzaZile: number | null }>> {
  const proprii = await (admin.from('produse_fitosanitare').select('nume_comercial,phi_zile').eq('tenant_id', tenantId).eq('activ', true).limit(1000) as Rezultat<
    Array<{ nume_comercial: string | null; phi_zile: number | null }>
  >)
  if (proprii.error) throw proprii.error
  const folosite = await (admin
    .from('aplicari_tratament_produse')
    .select('produs_nume_snapshot,phi_zile_snapshot')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(2000) as Rezultat<Array<{ produs_nume_snapshot: string | null; phi_zile_snapshot: number | null }>>)
  if (folosite.error) throw folosite.error
  return [
    ...(proprii.data ?? []).map((p) => ({ nume: p.nume_comercial, pauzaZile: p.phi_zile })),
    ...(folosite.data ?? []).map((p) => ({ nume: p.produs_nume_snapshot, pauzaZile: p.phi_zile_snapshot })),
  ]
}

/** Ziua trimiterii, ținută minte pe sezon (service role, doar rândul fermei). */
export async function noteazaTrimitereMemento(admin: Admin, tenantId: string, azi: string): Promise<void> {
  const { error } = await (admin
    .from('memento_analize_sezon')
    .upsert(
      { tenant_id: tenantId, an: Number(azi.slice(0, 4)), ultima_trimitere: azi, ultima_cheie: `analize:${tenantId}:${azi}`, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,an' },
    ) as PromiseLike<{ error: { code?: string; message?: string } | null }>)
  if (error) throw error
}
