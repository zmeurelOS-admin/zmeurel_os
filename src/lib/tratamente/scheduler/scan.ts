import { getSupabaseAdmin } from '@/lib/supabase/admin'

import type { Database } from '@/types/supabase'
import type { AplicarePlanificataNotif, SchedulerResult } from './types'

type AdminClient = ReturnType<typeof getSupabaseAdmin>
type AplicareTratamentRow = Database['public']['Tables']['aplicari_tratament']['Row']

const BUCHAREST_TIMEZONE = 'Europe/Bucharest'

function formatDateParts(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUCHAREST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Could not format Bucharest date parts.')
  }

  return `${year}-${month}-${day}`
}

function stripTrailingZeros(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/\.?0+$/, '')
}

/**
 * Formatează doza într-un label compact pentru notificări.
 * Exemplu: `formatDozaLabel(500, null)`
 */
export function formatDozaLabel(
  dozaMlPerHl: number | null | undefined,
  dozaLPerHa: number | null | undefined
): string | null {
  if (typeof dozaLPerHa === 'number' && Number.isFinite(dozaLPerHa) && dozaLPerHa > 0) {
    return `${stripTrailingZeros(dozaLPerHa)} L/ha`
  }

  if (typeof dozaMlPerHl === 'number' && Number.isFinite(dozaMlPerHl) && dozaMlPerHl > 0) {
    return `${stripTrailingZeros(dozaMlPerHl)} ml/hl`
  }

  return null
}

/**
 * Calculează dacă o aplicare este programată pentru azi sau mâine în fusul Europe/Bucharest.
 * Exemplu: `calculeazaZileRamase('2026-04-20', new Date())`
 */
export function calculeazaZileRamase(
  dataPlanificata: string,
  now: Date
): 0 | 1 | null {
  const today = formatDateParts(now)
  const tomorrowDate = new Date(now)
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
  const tomorrow = formatDateParts(tomorrowDate)

  if (dataPlanificata === today) return 0
  if (dataPlanificata === tomorrow) return 1
  return null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

type AplicareNotifRow = Pick<
  AplicareTratamentRow,
  'id' | 'parcela_id' | 'data_planificata' | 'doza_ml_per_hl' | 'doza_l_per_ha' | 'produs_nume_manual'
> & {
  parcela: { nume_parcela: string | null; id_parcela: string | null } | Array<{ nume_parcela: string | null; id_parcela: string | null }> | null
  produs: { nume_comercial: string | null } | Array<{ nume_comercial: string | null }> | null
}

function toNotifRow(row: AplicareNotifRow, now: Date): AplicarePlanificataNotif | null {
  const parcela = firstRelation(row.parcela)
  const produs = firstRelation(row.produs)
  const zileRamase = calculeazaZileRamase(row.data_planificata ?? '', now)

  if (zileRamase === null || !row.data_planificata) {
    return null
  }

  return {
    aplicareId: row.id,
    parcelaId: row.parcela_id,
    parcelaNume: parcela?.nume_parcela ?? parcela?.id_parcela ?? row.parcela_id,
    produsNume: produs?.nume_comercial ?? row.produs_nume_manual ?? 'Produs necunoscut',
    dataPlanificata: row.data_planificata,
    zileRamase,
    doza: formatDozaLabel(row.doza_ml_per_hl, row.doza_l_per_ha),
  }
}

async function loadAplicariPentruZi(
  admin: AdminClient,
  tenantId: string,
  dateKeys: string[]
): Promise<AplicareNotifRow[]> {
  const { data, error } = await admin
    .from('aplicari_tratament')
    .select(
      'id,parcela_id,data_planificata,doza_ml_per_hl,doza_l_per_ha,produs_nume_manual,parcela:parcele(nume_parcela,id_parcela),produs:produse_fitosanitare(nume_comercial)'
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .in('data_planificata', dateKeys)
    .order('data_planificata', { ascending: true })

  if (error) {
    throw new Error(`Failed to scan scheduled treatments for tenant ${tenantId}: ${error.message}`)
  }

  return (data ?? []) as AplicareNotifRow[]
}

/**
 * Scanează aplicările planificate pentru azi și mâine pentru un tenant.
 * Exemplu: `scanAplicariPentruNotificari('tenant-uuid')`
 */
export async function scanAplicariPentruNotificari(tenantId: string): Promise<SchedulerResult> {
  const admin = getSupabaseAdmin()
  const now = new Date()
  const todayKey = formatDateParts(now)
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowKey = formatDateParts(tomorrow)

  const rows = await loadAplicariPentruZi(admin, tenantId, [todayKey, tomorrowKey])
  const notificari = rows
    .map((row) => toNotifRow(row, now))
    .filter((item): item is AplicarePlanificataNotif => Boolean(item))

  return {
    tenantId,
    azi: notificari.filter((item) => item.zileRamase === 0),
    maine: notificari.filter((item) => item.zileRamase === 1),
  }
}

