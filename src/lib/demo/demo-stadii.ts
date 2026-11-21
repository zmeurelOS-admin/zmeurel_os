/**
 * Stadiile din demo-ul „Fructe de pădure”: Maravilla e remontantă (configurarea de sezon
 * `mixt_floricane_primocane`, câte un stadiu pe floricane și primocane), Delniwa Nord are un stadiu simplu.
 * Așa lista de parcele arată stadiul pe card, iar „Actualizează stadiul” cere cohorta la Maravilla.
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role. O eroare aici nu oprește restul demo-ului.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type DemoParcela = { id: string; nume_parcela: string | null }

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function seedDemoStadii(
  admin: SupabaseClient<Database>,
  tenantId: string,
  parcele: readonly DemoParcela[],
  todayIso: string,
): Promise<{ error: string | null }> {
  const an = Number(todayIso.slice(0, 4))
  const dupaNume = (nume: string) => parcele.find((parcela) => (parcela.nume_parcela ?? '').trim().toLowerCase() === nume.toLowerCase())
  const maravilla = dupaNume('Maravilla')
  const delniwa = dupaNume('Delniwa Nord')
  if (!maravilla && !delniwa) return { error: null }

  if (maravilla) {
    const { error } = await admin
      .from('configurari_parcela_sezon')
      .insert({ tenant_id: tenantId, parcela_id: maravilla.id, an, sistem_conducere: 'mixt_floricane_primocane' })
    if (error) return { error: error.message }
  }

  const rows = [
    maravilla ? { parcela_id: maravilla.id, stadiu: 'post_recoltare', cohort: 'floricane', zile: -40 } : null,
    maravilla ? { parcela_id: maravilla.id, stadiu: 'maturitate', cohort: 'primocane', zile: -4 } : null,
    delniwa ? { parcela_id: delniwa.id, stadiu: 'post_recoltare', cohort: null, zile: -10 } : null,
  ]
    .filter((row): row is { parcela_id: string; stadiu: string; cohort: string | null; zile: number } => row !== null)
    .map((row) => ({
      tenant_id: tenantId,
      parcela_id: row.parcela_id,
      an,
      stadiu: row.stadiu,
      cohort: row.cohort,
      data_observata: addDays(todayIso, row.zile),
      sursa: 'manual',
      observatii: null,
    }))

  const { error } = await admin.from('stadii_fenologice_parcela').insert(rows)
  return { error: error?.message ?? null }
}
