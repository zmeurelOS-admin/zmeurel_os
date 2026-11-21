/**
 * Tratamentele din demo-ul „Fructe de pădure”: o stropire cu pauza încă activă (ieri), o fertirigare
 * (acum 3 zile, pe zmeură, A/B) și o stropire planificată mâine. Așa un demo nou arată modulul plin.
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role. Coloanele din migrarea `20261121160000`
 * (lot, rezervor, g/plantă) se trimit doar dacă există. O eroare aici nu oprește restul demo-ului.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type Admin = SupabaseClient<Database>
type Loose = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (n: number) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
      is: (column: string, value: null) => { in: (column: string, values: string[]) => PromiseLike<{ data: unknown; error: { message?: string } | null }> }
    }
    insert: (rows: unknown) => {
      select: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
    } & PromiseLike<{ error: { code?: string; message?: string } | null }>
  }
}

export type DemoParcela = { id: string; nume_parcela: string | null; nr_plante?: number | null }

export interface DemoTratamenteResult {
  aplicari: number
  produse: number
  error: string | null
}

const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the/i.test(error.message ?? '')))

type ProdusDemo = {
  nume: string
  /** Numele din catalogul global (`produse_fitosanitare`, `tenant_id is null`); lipsă = scris de mână. */
  catalog?: string
  tip: string
  frac: string | null
  phi: number | null
  doza_ml_per_hl?: number
  unitate: 'ml' | 'g' | 'kg'
  /** Cantitatea pe o parcelă (stropire: după doză × 60 l). */
  cantitate?: number
  gPePlanta?: number
  rezervor?: 'A' | 'B'
}

export async function seedDemoTratamente(
  supabaseAdmin: Admin,
  tenantId: string,
  parcele: readonly DemoParcela[],
  day: (offset: number) => string,
): Promise<DemoTratamenteResult> {
  const db = supabaseAdmin as unknown as Loose
  const byName = (fragment: string) => parcele.find((parcela) => (parcela.nume_parcela ?? '').includes(fragment))
  const maravilla = byName('Maravilla')
  const delniwaNord = byName('Delniwa Nord')
  const delniwaSud = byName('Delniwa Sud')
  const zmeura = [delniwaNord, delniwaSud, maravilla].filter((parcela): parcela is DemoParcela => Boolean(parcela))
  if (!maravilla || zmeura.length === 0) return { aplicari: 0, produse: 0, error: null }

  const probe = await db.from('aplicari_tratament').select('lot_id').limit(1)
  const cuColoaneNoi = !probe.error
  if (probe.error && !isMissingColumn(probe.error)) return { aplicari: 0, produse: 0, error: probe.error.message ?? 'probe' }

  const catalogRes = await db
    .from('produse_fitosanitare')
    .select('id,nume_comercial')
    .is('tenant_id', null)
    .in('nume_comercial', ['Switch 62.5 WG', 'Kelpak'])
  const catalog = new Map(((catalogRes.data ?? []) as Array<{ id: string; nume_comercial: string }>).map((row) => [row.nume_comercial, row.id]))

  const loturi: Array<{
    parcele: DemoParcela[]
    status: 'aplicata' | 'planificata'
    metoda: 'foliar' | 'fertirigare'
    tip: 'protectie' | 'nutritie'
    zi: string
    produse: ProdusDemo[]
  }> = [
    {
      parcele: [maravilla],
      status: 'aplicata',
      metoda: 'foliar',
      tip: 'protectie',
      zi: day(-1),
      produse: [
        { nume: 'Switch 62.5 WG', catalog: 'Switch 62.5 WG', tip: 'fungicid', frac: 'FRAC 9 + 12', phi: 3, doza_ml_per_hl: 100, unitate: 'g', cantitate: 60 },
        { nume: 'Kelpak', catalog: 'Kelpak', tip: 'bioregulator', frac: null, phi: 0, doza_ml_per_hl: 250, unitate: 'ml', cantitate: 150 },
      ],
    },
    {
      parcele: zmeura,
      status: 'aplicata',
      metoda: 'fertirigare',
      tip: 'nutritie',
      zi: day(-3),
      produse: [
        { nume: 'Ferti 15-5-30', tip: 'ingrasamant', frac: null, phi: null, unitate: 'kg', gPePlanta: 2, rezervor: 'A' },
        { nume: 'Calcinit', tip: 'ingrasamant', frac: null, phi: null, unitate: 'kg', gPePlanta: 2, rezervor: 'B' },
      ],
    },
    {
      parcele: [maravilla, delniwaSud].filter((parcela): parcela is DemoParcela => Boolean(parcela)),
      status: 'planificata',
      metoda: 'foliar',
      tip: 'protectie',
      zi: day(1),
      produse: [{ nume: 'Serenade ASO', tip: 'fungicid', frac: null, phi: 0, doza_ml_per_hl: 400, unitate: 'ml', cantitate: 240 }],
    },
  ]

  let aplicari = 0
  let produse = 0
  for (const lot of loturi) {
    const lotId = crypto.randomUUID()
    const primul = lot.produse[0]
    const primulId = primul.catalog ? catalog.get(primul.catalog) ?? null : null
    const rows = lot.parcele.map((parcela) => ({
      tenant_id: tenantId,
      parcela_id: parcela.id,
      status: lot.status,
      data_aplicata: lot.status === 'aplicata' ? `${lot.zi}T07:00:00.000Z` : null,
      data_planificata: lot.status === 'planificata' ? lot.zi : null,
      metoda_aplicare: lot.metoda,
      tip_interventie: lot.tip,
      sursa: 'manuala',
      produs_id: primulId,
      produs_nume_manual: primulId ? null : primul.nume,
      observatii: 'Demo',
      ...(cuColoaneNoi ? { lot_id: lotId } : {}),
    }))
    const inserted = await db.from('aplicari_tratament').insert(rows).select('id,parcela_id')
    if (inserted.error) return { aplicari, produse, error: inserted.error.message ?? 'aplicari_tratament' }
    const created = (inserted.data ?? []) as Array<{ id: string; parcela_id: string }>
    aplicari += created.length

    const produseRows = created.flatMap((aplicare) => {
      const parcela = lot.parcele.find((item) => item.id === aplicare.parcela_id)
      return lot.produse.map((produs, index) => {
        const produsId = produs.catalog ? catalog.get(produs.catalog) ?? null : null
        const kg = produs.gPePlanta && parcela?.nr_plante ? Math.round(((produs.gPePlanta * parcela.nr_plante) / 1000) * 1000) / 1000 : null
        return {
          tenant_id: tenantId,
          aplicare_id: aplicare.id,
          ordine: index + 1,
          produs_id: produsId,
          produs_nume_manual: produsId ? null : produs.nume,
          produs_nume_snapshot: produs.nume,
          tip_snapshot: produs.tip,
          frac_irac_snapshot: produs.frac,
          phi_zile_snapshot: produs.phi,
          doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
          cantitate_totala: produs.gPePlanta ? kg : (produs.cantitate ?? null),
          unitate_cantitate: produs.gPePlanta ? (kg === null ? null : 'kg') : produs.unitate,
          cantitate_text: produs.gPePlanta ? `${produs.gPePlanta} g/plantă · rezervor ${produs.rezervor}` : `${produs.cantitate} ${produs.unitate}`,
          ...(cuColoaneNoi && produs.gPePlanta ? { doza_g_per_planta: produs.gPePlanta, rezervor: produs.rezervor } : {}),
        }
      })
    })
    const insertedProduse = await db.from('aplicari_tratament_produse').insert(produseRows)
    if (insertedProduse.error) return { aplicari, produse, error: insertedProduse.error.message ?? 'aplicari_tratament_produse' }
    produse += produseRows.length
  }

  return { aplicari, produse, error: null }
}
