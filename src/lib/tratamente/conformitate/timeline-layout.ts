import type { AplicareAgregata } from '@/lib/supabase/queries/tratamente'

export interface GanttRow {
  luna: number
  aplicari: { aplicareId: string; ziua: number; tipCuloare: string; status: string }[]
}

function normalizeType(value: string | null | undefined): string {
  return value?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '_') ?? ''
}

function resolveTipCuloare(aplicare: AplicareAgregata): string {
  const type = normalizeType(aplicare.produs_tip)
  if (type === 'fungicid') return 'blue'
  if (type === 'insecticid') return 'orange'
  if (type === 'acaricid') return 'yellow'
  if (type === 'ingrasamant_foliar' || type === 'fertilizare_foliara' || type === 'fertirigare') {
    return 'green'
  }
  return 'gray'
}

function pickAplicareDate(aplicare: AplicareAgregata): Date | null {
  const source = aplicare.data_aplicata ?? aplicare.data_planificata
  if (!source) return null
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function buildGanttLayout(aplicari: AplicareAgregata[], an: number): GanttRow[] {
  const rows: GanttRow[] = Array.from({ length: 12 }, (_, index) => ({
    luna: index + 1,
    aplicari: [] as GanttRow['aplicari'],
  }))

  for (const aplicare of aplicari) {
    const date = pickAplicareDate(aplicare)
    if (!date || date.getUTCFullYear() !== an) continue

    const monthIndex = date.getUTCMonth()
    const row = rows[monthIndex]
    if (!row) continue

    row.aplicari.push({
      aplicareId: aplicare.id,
      ziua: date.getUTCDate(),
      tipCuloare: resolveTipCuloare(aplicare),
      status: aplicare.status,
    })
  }

  for (const row of rows) {
    row.aplicari.sort((left, right) => left.ziua - right.ziua)
  }

  return rows
}
