import type { MiscareStoc } from '@/lib/magazie/stoc'
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
        .select('id,data,categorie,suma_lei')
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
        .select('id,data,categorie,suma_lei')
        .order('data', { ascending: false }),
    ])

  // Magazia (promptul 28): ieșirile și intrările cu preț, pentru linia informativă „Tratamente: X lei”. Doar proprietarul
  // le citește (RLS); fără migrare tabelul lipsește și linia nu apare.
  const magazie = await (supabase as unknown as {
    from: (table: string) => { select: (columns: string) => PromiseLike<{ data: unknown; error: unknown }> }
  })
    .from('magazie_miscari')
    .select('produs_id,tip,cantitate,data,created_at,pret_total_lei')
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

  return (
    <RapoartePageClient
      magazieMiscari={magazieMiscari}
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
