/**
 * Pasul „Planul de tratamente” din verificarea de dimineață (`/api/cron/notificari-dimineata`, 05:00 UTC: 8:00 vara,
 * 7:00 iarna, ora României; fără cron nou). Pentru o fermă reală: citește (service role, doar `select`) planurile cu
 * parcele în anul curent, stadiile, aplicările din plan, liniile sărite și excepțiile; ce e de făcut și n-a fost anunțat
 * (`planuri_anuntate`) pleacă proprietarului și operatorilor activi cu „Scrie” pe Tratamente, câte o notificare
 * (cheia `plan:<fermă>:<zi>:<utilizator>`). Apoi notează ce s-a anunțat (singura scriere, în `planuri_anuntate`).
 * Fără migrarea `20261123120000_plan_stadii.sql` nu trimite nimic. Întrebarea „A început…?” nu pleacă pe telefon.
 */
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import { trimiteNotificareUtilizator, type RezultatTrimitere } from '@/lib/notifications/zilnice/server'
import { ziuaRo } from '@/lib/tratamente/zile'
import type { MembruFerma } from '@/lib/capcane/destinatari'

import { linieDinRand, planDinRand, type ParcelaPlan, type RandLinie } from './model'
import { anunturiNoi, destinatariPlan, notificarePlan, randuriAnuntate, type Anunt } from './notificare'
import { stadiiCurentePeParcele, type StadiuRand } from './stadii'
import { calculeazaPlan, type AplicarePlan, type ExceptieLinie, type InterventieDeFacut, type SarireLinie } from './urmeaza'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof getSupabaseAdmin> | any
type Err = { code?: string; message?: string } | null

/** Tabelul sau o coloană nouă lipsesc (migrarea încă neaplicată). */
export function lipsaPlan(error: Err): boolean {
  if (!error) return false
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '')) return true
  return /does not exist|could not find the/i.test(error.message ?? '')
}

const LINIE_SELECT =
  'id,plan_id,ordine,stadiu_trigger,cohort_trigger,tip_interventie,scop,regula_repetare,interval_repetare_zile,numar_repetari_max,metoda_aplicare,produs_id,produs_nume_manual,doza_ml_per_hl,doza_l_per_ha,observatii,produs:produse_fitosanitare(nume_comercial,tip,phi_zile),produse:planuri_tratament_linie_produse(id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,tip_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,cantitate_text)'

/** Ce e de făcut azi pe ferma dată și ce n-a fost anunțat încă (`null` = fără migrare). */
export async function deAnuntatFerma(admin: Admin, tenantId: string, azi: string): Promise<{ noi: Array<InterventieDeFacut & { an: number }>; culturaTip: Map<string, string> } | null> {
  const an = Number(azi.slice(0, 4))

  const anuntateRes = await admin.from('planuri_anuntate').select('plan_linie_id,parcela_id,an,repetare').eq('tenant_id', tenantId).eq('an', an)
  if (anuntateRes.error) {
    if (lipsaPlan(anuntateRes.error)) return null
    throw anuntateRes.error
  }

  const asocRes = await admin.from('parcele_planuri').select('plan_id,parcela_id,an,activ').eq('tenant_id', tenantId).eq('an', an).eq('activ', true)
  if (asocRes.error) throw asocRes.error
  const asocieri = ((asocRes.data ?? []) as Array<Record<string, unknown>>).map((row): ParcelaPlan => ({ plan_id: String(row.plan_id), parcela_id: String(row.parcela_id), an: Number(row.an), activ: true }))
  if (asocieri.length === 0) return { noi: [], culturaTip: new Map() }
  const planIds = [...new Set(asocieri.map((a) => a.plan_id))]
  const parcelaIds = [...new Set(asocieri.map((a) => a.parcela_id))]

  const [planuriRes, liniiRes, stadiiRes, aplicariRes, sariteRes, exceptiiRes] = await Promise.all([
    admin.from('planuri_tratament').select('id,nume,cultura_tip,descriere,activ,arhivat').eq('tenant_id', tenantId).in('id', planIds),
    admin.from('planuri_tratament_linii').select(LINIE_SELECT).eq('tenant_id', tenantId).in('plan_id', planIds),
    // Anul trecut și anul acesta: stadiul de acum se citește peste ani (promptul 33), planul ia din anul trecut doar
    // `pastrat` / `repaus_vegetativ`.
    admin.from('stadii_fenologice_parcela').select('parcela_id,an,stadiu,cohort,data_observata,created_at,updated_at').eq('tenant_id', tenantId).in('an', [an - 1, an]).in('parcela_id', parcelaIds),
    admin
      .from('aplicari_tratament')
      .select('id,parcela_id,plan_linie_id,status,data_aplicata,data_planificata')
      .eq('tenant_id', tenantId)
      .in('parcela_id', parcelaIds)
      .not('plan_linie_id', 'is', null),
    admin.from('planuri_linii_sarite').select('plan_linie_id,parcela_id,an,motiv').eq('tenant_id', tenantId).eq('an', an),
    admin.from('planuri_linii_exceptii').select('plan_linie_id,parcela_id').eq('tenant_id', tenantId),
  ])
  for (const res of [planuriRes, liniiRes, stadiiRes, aplicariRes, sariteRes, exceptiiRes]) {
    if (res.error) {
      if (lipsaPlan(res.error)) return null
      throw res.error
    }
  }

  const linii = ((liniiRes.data ?? []) as RandLinie[]).map(linieDinRand)
  const planuri = ((planuriRes.data ?? []) as Array<Record<string, unknown>>).map((row) => planDinRand(row, linii)).filter((p) => !p.arhivat)
  const aplicari: AplicarePlan[] = ((aplicariRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    parcela_id: String(row.parcela_id),
    plan_linie_id: (row.plan_linie_id as string | null) ?? null,
    status: String(row.status ?? ''),
    zi: row.status === 'aplicata' ? ziuaRo(row.data_aplicata as string | null) : ziuaRo(row.data_planificata as string | null),
  }))
  const ctx = {
    azi,
    an,
    stadii: stadiiCurentePeParcele((stadiiRes.data ?? []) as StadiuRand[], an),
    aplicari,
    sarite: (sariteRes.data ?? []) as SarireLinie[],
    exceptii: (exceptiiRes.data ?? []) as ExceptieLinie[],
  }
  const deFacut = planuri.flatMap((plan) => calculeazaPlan(plan, asocieri, ctx).deFacut)
  return {
    noi: anunturiNoi(deFacut, (anuntateRes.data ?? []) as Anunt[], an),
    culturaTip: new Map(planuri.map((p) => [p.id, p.cultura_tip])),
  }
}

export async function mementoPlanFerma(admin: Admin, ferma: { id: string; ownerUserId: string }, azi: string): Promise<RezultatTrimitere[]> {
  const rezultat = await deAnuntatFerma(admin, ferma.id, azi)
  if (!rezultat || rezultat.noi.length === 0) return []

  const parcelaIds = [...new Set(rezultat.noi.map((item) => item.parcelaId))]
  const { data: parcele, error: parceleError } = await admin.from('parcele').select('id,nume_parcela').eq('tenant_id', ferma.id).in('id', parcelaIds)
  if (parceleError) throw parceleError
  const numeParcele = new Map(((parcele ?? []) as Array<{ id: string; nume_parcela: string | null }>).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă']))

  const { data: membri, error: membriError } = await admin
    .from('farm_members')
    .select('user_id,role,is_active,modules_access')
    .eq('tenant_id', ferma.id)
    .eq('role', 'operator')
    .eq('is_active', true)
  if (membriError) throw membriError

  const rezultate: RezultatTrimitere[] = []
  for (const userId of destinatariPlan({ ownerUserId: ferma.ownerUserId, membri: (membri ?? []) as MembruFerma[] })) {
    const notificare = notificarePlan({ tenantId: ferma.id, userId, azi, noi: rezultat.noi, culturaTip: rezultat.culturaTip, numeParcele })
    if (notificare) rezultate.push(await trimiteNotificareUtilizator(admin, userId, notificare))
  }

  // Ce s-a anunțat nu se mai anunță (o singură dată pe linie, parcelă și repetare). Dacă n-a plecat nimic, se reîncearcă mâine.
  if (rezultate.some((r) => r !== 'eroare')) {
    const { error } = await admin.from('planuri_anuntate').upsert(randuriAnuntate(ferma.id, rezultat.noi), { onConflict: 'plan_linie_id,parcela_id,an,repetare', ignoreDuplicates: true })
    if (error) throw error
  }
  return rezultate
}
