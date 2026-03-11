import { createClient } from '@/lib/supabase/server'
import { RapoartePageClient } from './RapoartePageClient'

export default async function RapoartePage() {
  const supabase = await createClient()

  const [{ data: recoltari = [] }, { data: vanzari = [] }, { data: cheltuieli = [] }, { data: parcele = [] }, { data: culegatori = [] }, { data: clienti = [] }, { data: activitati = [] }] =
    await Promise.all([
      supabase
        .from('recoltari')
        .select('id,id_recoltare,data,parcela_id,culegator_id,kg_cal1,kg_cal2')
        .order('data', { ascending: false }),
      supabase
        .from('vanzari')
        .select('id,id_vanzare,data,client_id,cantitate_kg,pret_lei_kg')
        .order('data', { ascending: false }),
      supabase
        .from('cheltuieli_diverse')
        .select('id,id_cheltuiala,data,categorie,suma_lei')
        .order('data', { ascending: false }),
      supabase
        .from('parcele')
        .select('id,id_parcela,nume_parcela,soi_plantat'),
      supabase
        .from('culegatori')
        .select('id,id_culegator,nume_prenume'),
      supabase
        .from('clienti')
        .select('id,id_client,nume_client'),
      supabase
        .from('activitati_agricole')
        .select('id,data_aplicare,parcela_id,tip_activitate,produs_utilizat,doza,timp_pauza_zile,observatii')
        .order('data_aplicare', { ascending: false }),
    ])

  return (
    <RapoartePageClient
      initialRecoltari={recoltari ?? []}
      initialVanzari={vanzari ?? []}
      initialCheltuieli={cheltuieli ?? []}
      initialParcele={parcele ?? []}
      initialCulegatori={culegatori ?? []}
      initialClienți={clienti ?? []}
      initialActivitati={activitati ?? []}
    />
  )
}
