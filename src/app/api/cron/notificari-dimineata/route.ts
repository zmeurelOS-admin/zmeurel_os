import { NextResponse } from 'next/server'

import { decizieMementoFerma, noteazaTrimitereMemento } from '@/lib/analize/memento-cron'
import { captureApiError } from '@/lib/monitoring/report-error'
import {
  TIPURI_ZILNICE,
  alertaMeteo,
  baniDeIncasat,
  prognozaDinFetchMeteo,
  tratamentePlanificateAzi,
  ziuaInBucuresti,
  type AplicarePlanificata,
  type RaspunsFetchMeteo,
  type VanzarePentruIncasare,
} from '@/lib/notifications/zilnice'
import {
  citesteFermeleReale,
  citesteTot,
  contorNou,
  hasValidCronSecret,
  numara,
  trimiteNotificareZilnica,
} from '@/lib/notifications/zilnice/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const ROUTE = '/api/cron/notificari-dimineata'

type Admin = ReturnType<typeof getSupabaseAdmin>

type VanzareRow = Omit<VanzarePentruIncasare, 'client_nume'>

/** Vânzările fermei, cu numele clienților (doar citire). */
async function vanzariFerma(admin: Admin, tenantId: string): Promise<VanzarePentruIncasare[]> {
  const rows = await citesteTot<VanzareRow>((de, pana) =>
    admin
      .from('vanzari')
      .select('id, tenant_id, client_id, data, cantitate_kg, pret_lei_kg, status_plata, suma_incasata_partial_lei')
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true })
      .range(de, pana),
  )
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)))]
  const nume = new Map<string, string>()
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data, error } = await admin
      .from('clienti')
      .select('id, nume_client')
      .eq('tenant_id', tenantId)
      .in('id', clientIds.slice(i, i + 200))
    if (error) throw error
    for (const client of (data ?? []) as Array<{ id: string; nume_client: string | null }>) {
      if (client.nume_client?.trim()) nume.set(client.id, client.nume_client.trim())
    }
  }
  return rows.map((row) => ({ ...row, client_nume: row.client_id ? (nume.get(row.client_id) ?? null) : null }))
}

/** Coloana lipsește (migrarea încă neaplicată): Postgres 42703, PostgREST PGRST204. */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
}

/**
 * Tratamentele planificate azi ale fermei (doar citire). `lot_id` vine după migrarea `20261121160000`;
 * până atunci fiecare aplicare contează separat (câte un rând pe parcelă).
 */
async function planificateAzi(admin: Admin, tenantId: string, azi: string): Promise<AplicarePlanificata[]> {
  const cuLot = await admin
    .from('aplicari_tratament')
    .select('id, tenant_id, status, data_planificata, lot_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .eq('data_planificata', azi)
    .limit(500)
  if (!cuLot.error) return (cuLot.data ?? []) as AplicarePlanificata[]
  if (!isMissingColumnError(cuLot.error)) throw cuLot.error
  const faraLot = await admin
    .from('aplicari_tratament')
    .select('id, tenant_id, status, data_planificata')
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .eq('data_planificata', azi)
    .limit(500)
  if (faraLot.error) throw faraLot.error
  return (faraLot.data ?? []) as AplicarePlanificata[]
}

/**
 * Prognoza prin Edge Function-ul `fetch-meteo` (cu cache pe fermă), apelat cu service role.
 * Ca `useMeteo`, dacă `fetch-meteo` nu răspunde, încearcă `get-meteo` (același cod, fără verificarea JWT
 * la gateway). Fără răspuns: `null` (nicio alertă).
 */
async function prognozaFerma(admin: Admin, tenantId: string): Promise<RaspunsFetchMeteo | null> {
  let ultimaEroare: unknown = null
  for (const name of ['fetch-meteo', 'get-meteo'] as const) {
    const { data, error } = await admin.functions.invoke(name, { body: { tenant_id: tenantId } })
    if (!error && data && typeof data === 'object') return data as RaspunsFetchMeteo
    ultimaEroare = error ?? new Error(`${name}: răspuns gol`)
  }
  throw ultimaEroare
}

/**
 * Dimineața (05:00 UTC: 7:00 iarna, 8:00 vara, ora României), pentru fiecare fermă reală:
 * - „Îngheț și grindină”, doar dacă ferma are locul salvat (Setări › Ferma);
 * - „Bani de încasat”, clienții cu bani de dat de 7, 14 sau 30 de zile;
 * - „Tratamente planificate”, o notificare pe fermă în ziua lor (cheia `tratament:<fermă>:<zi>`);
 * - „Analiza dinainte de cules”, doar proprietarului, la 21 / 14 / 7 / 3 zile înainte și zilnic din ziua culesului
 *   (cheia `analize:<fermă>:<zi>`; `src/lib/analize/memento-cron.ts`).
 * Citește și inserează în `notifications`; pentru memento notează și ziua trimiterii (`memento_analize_sezon`).
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin()
    const acum = new Date()
    const azi = ziuaInBucuresti(acum)
    const ferme = await citesteFermeleReale(admin)
    const contor = contorNou([
      TIPURI_ZILNICE.meteo_inghet,
      TIPURI_ZILNICE.meteo_grindina,
      TIPURI_ZILNICE.incasari_restante,
      TIPURI_ZILNICE.tratament_planificat,
      TIPURI_ZILNICE.analize_memento,
    ])

    // Fermele cu locul salvat. Fără loc nu cerem prognoza și nu ghicim.
    const cuLoc = new Set<string>()
    const ids = ferme.map((ferma) => ferma.id)
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await admin
        .from('tenant_settings')
        .select('tenant_id')
        .in('tenant_id', ids.slice(i, i + 200))
        .not('latitudine_default', 'is', null)
        .not('longitudine_default', 'is', null)
      if (error) throw error
      for (const row of (data ?? []) as Array<{ tenant_id: string }>) cuLoc.add(row.tenant_id)
    }
    let fermeCuMeteo = 0

    for (const ferma of ferme) {
      let verificata = true

      if (cuLoc.has(ferma.id)) {
        try {
          const prognoza = prognozaDinFetchMeteo(ferma.id, await prognozaFerma(admin, ferma.id))
          fermeCuMeteo += 1
          for (const notificare of alertaMeteo(prognoza, acum)) {
            numara(contor, notificare.type, await trimiteNotificareZilnica(admin, notificare))
          }
        } catch (error) {
          verificata = false
          contor.erori += 1
          captureApiError(error, { route: ROUTE, tenantId: ferma.id, tags: { pas: 'meteo' } })
        }
      }

      try {
        const vanzari = await vanzariFerma(admin, ferma.id)
        for (const notificare of baniDeIncasat(vanzari, azi)) {
          numara(contor, notificare.type, await trimiteNotificareZilnica(admin, notificare))
        }
      } catch (error) {
        verificata = false
        contor.erori += 1
        captureApiError(error, { route: ROUTE, tenantId: ferma.id, tags: { pas: 'incasari' } })
      }

      try {
        for (const notificare of tratamentePlanificateAzi(await planificateAzi(admin, ferma.id, azi), azi)) {
          numara(contor, notificare.type, await trimiteNotificareZilnica(admin, notificare))
        }
      } catch (error) {
        verificata = false
        contor.erori += 1
        captureApiError(error, { route: ROUTE, tenantId: ferma.id, tags: { pas: 'tratamente' } })
      }

      try {
        const decizie = await decizieMementoFerma(admin, ferma, azi)
        if (decizie.trimite) {
          const rezultat = await trimiteNotificareZilnica(admin, decizie.notificare)
          numara(contor, decizie.notificare.type, rezultat)
          if (rezultat === 'trimisa') await noteazaTrimitereMemento(admin, ferma.id, azi)
        }
      } catch (error) {
        verificata = false
        contor.erori += 1
        captureApiError(error, { route: ROUTE, tenantId: ferma.id, tags: { pas: 'analize' } })
      }

      if (verificata) contor.fermeVerificate += 1
    }

    return NextResponse.json({ ok: true, azi, fermeCuLoc: cuLoc.size, fermeCuMeteo, ...contor })
  } catch (error) {
    captureApiError(error, { route: ROUTE })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verificarea de dimineață a eșuat' },
      { status: 500 },
    )
  }
}
