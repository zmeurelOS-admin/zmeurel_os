/**
 * Produsul fermei pentru o cultură (promptul 31): la prima parcelă dintr-o cultură se asigură produsul
 * „<Cultură> proaspătă/proaspete” al fermei, în locul celui fix „Zmeură proaspătă”. Comenzile îl primesc în
 * `comenzi.produs_id` (există deja). Produsele existente rămân neatinse: un produs care se potrivește deja cu
 * cultura (de exemplu „Zmeură proaspătă” la ferma lui Andrei) e folosit ca atare.
 */
import { getSupabase } from '../client'
import {
  categorieProdus,
  culturaProdusului,
  culturileFermei,
  numeProdusProaspat,
  type CulturaFerma,
} from '@/lib/parcele/culturi-ferma'
import { getTenantId } from '@/lib/tenant/get-tenant'

interface ProdusScurt {
  id: string
  nume: string
  status: string | null
  created_at: string | null
}

/**
 * Produsul existent al culturii: întâi „<Cultură> proaspătă” exact, apoi cel activ, apoi cel mai vechi.
 * Funcție pură, testată.
 */
export function alegeProdusCultura(produse: readonly ProdusScurt[], cultura: Pick<CulturaFerma, 'cheie' | 'nume' | 'forma'>): ProdusScurt | null {
  const potrivite = produse.filter((produs) => culturaProdusului(produs.nume, [cultura]) === cultura.cheie)
  if (potrivite.length === 0) return null
  const exact = numeProdusProaspat(cultura)
  return (
    [...potrivite].sort(
      (a, b) =>
        Number(b.nume === exact) - Number(a.nume === exact) ||
        Number(b.status === 'activ') - Number(a.status === 'activ') ||
        String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
    )[0] ?? null
  )
}

/** Cultura dintr-un text de parcelă („Zmeure Delniwa”), cu numele și acordul ei; `null` dacă e gol. */
export function culturaDinText(text: string | null | undefined): CulturaFerma | null {
  return culturileFermei([{ cultura: text ?? null }])[0] ?? null
}

/**
 * Id-ul produsului culturii; îl creează dacă nu există. Nefatal: întoarce `null` la orice eroare (comanda merge
 * și fără produs, ca înainte). Un produs activ cere actele fermei (`produse_legal_docs_guard`): fără ele se
 * creează inactiv.
 */
export async function asiguraProdusCultura(textCultura: string | null | undefined): Promise<string | null> {
  const cultura = culturaDinText(textCultura)
  if (!cultura) return null
  try {
    const supabase = getSupabase()
    const tenantId = await getTenantId(supabase)
    const { data, error } = await supabase.from('produse').select('id,nume,status,created_at').eq('tenant_id', tenantId)
    if (error) return null
    const existent = alegeProdusCultura((data ?? []) as ProdusScurt[], cultura)
    if (existent) return existent.id

    const rand = {
      tenant_id: tenantId,
      nume: numeProdusProaspat(cultura),
      categorie: categorieProdus(cultura.cheie),
      unitate_vanzare: 'kg',
      tip_produs: 'proaspat',
    }
    const activ = await supabase.from('produse').insert({ ...rand, status: 'activ' }).select('id').single()
    if (!activ.error && activ.data) return activ.data.id
    const inactiv = await supabase.from('produse').insert({ ...rand, status: 'inactiv' }).select('id').single()
    return inactiv.error || !inactiv.data ? null : inactiv.data.id
  } catch {
    return null
  }
}
