import type { MiscareStoc } from '@/lib/magazie/stoc'
import type { IesireMagazieParcela } from '@/lib/rapoarte/profit-parcela'
import { createClient } from '@/lib/supabase/server'
import { RapoartePageClient } from './RapoartePageClient'

export default async function RapoartePage() {
  const supabase = await createClient()

  const [{ data: recoltari = [] }, { data: vanzari = [] }, { data: cheltuieli = [] }, { data: parcele = [] }, { data: culegatori = [] }, { data: clienti = [] }, { data: butasiLivrate = [] }, { data: investitii = [] }] =
    await Promise.all([
      supabase
        .from('recoltari')
        .select('id,data,parcela_id,culegator_id,kg_cal1,kg_cal2,valoare_munca_lei')
        .order('data', { ascending: false }),
      supabase
        .from('vanzari')
        .select('id,data,client_id,cantitate_kg,pret_lei_kg,status_plata,data_incasare')
        .order('data', { ascending: false }),
      supabase
        .from('cheltuieli_diverse')
        .select('id,data,categorie,suma_lei,furnizor,descriere,document_url')
        .order('data', { ascending: false }),
      // `rol`: parcelele personale nu intră la kg recoltate în plăci.
      supabase.from('parcele').select('id,nume_parcela,nr_plante,rol'),
      supabase.from('culegatori').select('id,nume_prenume'),
      supabase.from('clienti').select('id,nume_client'),
      // Material săditor livrat = venit (la data livrării).
      supabase
        .from('vanzari_butasi')
        .select('id,status,total_lei,data_livrare_estimata,data_comanda')
        .eq('status', 'livrata'),
      // Investițiile: secțiune proprie, nu intră la cheltuieli și nu scad din profit.
      supabase
        .from('investitii')
        .select('id,data,categorie,suma_lei,furnizor,descriere,document_url')
        .order('data', { ascending: false }),
    ])

  // Magazia (promptul 28): ieșirile și intrările cu preț, pentru linia informativă „Tratamente: X lei”. Doar proprietarul
  // le citește (RLS); fără migrare tabelul lipsește și linia nu apare.
  const magazie = await (supabase as unknown as {
    from: (table: string) => { select: (columns: string) => PromiseLike<{ data: unknown; error: unknown }> }
  })
    .from('magazie_miscari')
    .select('produs_id,tip,cantitate,data,created_at,pret_total_lei,aplicare_produs_id')
  const magazieMiscari: MiscareStoc[] = magazie.error
    ? []
    : ((magazie.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        produs_id: String(row.produs_id),
        tip: row.tip as MiscareStoc['tip'],
        cantitate: Number(row.cantitate) || 0,
        data: String(row.data ?? '').slice(0, 10),
        created_at: (row.created_at as string | null) ?? null,
        pret_total_lei: row.pret_total_lei === null || row.pret_total_lei === undefined ? null : Number(row.pret_total_lei),
      }))

  // Promptul 35, §8: parcela fiecărei ieșiri din Magazie (ieșirea → produsul aplicării → aplicarea, câte una pe
  // parcelă), pentru tratamentele din profitul estimat pe parcelă. Doar citire, cu RLS-ul proprietarului.
  const iesiriParcele = await parcelaIesirilor(supabase, magazie.error ? [] : ((magazie.data ?? []) as Array<Record<string, unknown>>))

  return (
    <RapoartePageClient
      magazieMiscari={magazieMiscari}
      iesiriParcele={iesiriParcele}
      date={{
        recoltari: recoltari ?? [],
        vanzari: vanzari ?? [],
        cheltuieli: cheltuieli ?? [],
        parcele: parcele ?? [],
        culegatori: culegatori ?? [],
        clienti: clienti ?? [],
        butasi: butasiLivrate ?? [],
        investitii: investitii ?? [],
      }}
    />
  )
}

type ClientSupabase = Awaited<ReturnType<typeof createClient>>

async function inBucati<T>(ids: string[], citeste: (bucata: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rezultat: T[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await citeste(ids.slice(i, i + 200))
    if (error) return []
    rezultat.push(...((data ?? []) as T[]))
  }
  return rezultat
}

async function parcelaIesirilor(supabase: ClientSupabase, randuri: Array<Record<string, unknown>>): Promise<IesireMagazieParcela[]> {
  const iesiri = randuri.filter((row) => row.tip === 'iesire_tratament' && row.aplicare_produs_id)
  if (iesiri.length === 0) return []
  const produse = await inBucati<{ id: string; aplicare_id: string }>(
    [...new Set(iesiri.map((row) => String(row.aplicare_produs_id)))],
    (bucata) => supabase.from('aplicari_tratament_produse').select('id,aplicare_id').in('id', bucata),
  )
  const aplicarePeProdus = new Map(produse.map((row) => [row.id, row.aplicare_id]))
  const aplicari = await inBucati<{ id: string; parcela_id: string | null }>(
    [...new Set(produse.map((row) => row.aplicare_id))],
    (bucata) => supabase.from('aplicari_tratament').select('id,parcela_id').in('id', bucata),
  )
  const parcelaPeAplicare = new Map(aplicari.map((row) => [row.id, row.parcela_id]))
  return iesiri.map((row) => ({
    produs_id: String(row.produs_id),
    cantitate: Number(row.cantitate) || 0,
    data: String(row.data ?? '').slice(0, 10),
    parcela_id: parcelaPeAplicare.get(aplicarePeProdus.get(String(row.aplicare_produs_id)) ?? '') ?? null,
  }))
}
