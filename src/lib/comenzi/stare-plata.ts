/**
 * Starea plății comenzilor livrate, pentru cine nu poate citi `vanzari` (operatorul, după migrarea
 * `20261122100000`: vânzările le citește doar proprietarul).
 *
 * `select`-ul comenzilor aduce vânzarea legată (`vanzare:vanzari!comenzi_linked_vanzare_id_fkey`). Pentru operator,
 * RLS o întoarce `null`, deși `linked_vanzare_id` e completat. Pentru acele comenzi cerem doar câmpurile de plată
 * prin RPC-ul `comenzi_stare_plata` (verifică dreptul pe Comenzi sau Livrări). Proprietarul primește legătura plină,
 * deci nu se face nicio cerere în plus.
 *
 * Nefatal: fără migrare (`PGRST202`) sau la orice eroare, comenzile rămân cum au venit.
 */

export type StarePlataVanzare = {
  status_plata: string | null
  data_incasare: string | null
  cantitate_kg: number | null
  pret_lei_kg: number | null
  suma_incasata_partial_lei: number | null
}

type RandComandaCuVanzare = {
  id: string
  linked_vanzare_id?: string | null
  vanzare?: Partial<StarePlataVanzare> | null
}

type RandStarePlata = StarePlataVanzare & { comanda_id: string }

type RpcError = { code?: string; message?: string } | null

export type StarePlataRpcClient = {
  rpc: (
    fn: 'comenzi_stare_plata',
    args: { p_comanda_ids: string[] },
  ) => PromiseLike<{ data: unknown; error: RpcError }>
}

/** Câte id-uri pleacă într-o cerere (funcția refuză peste 2000; URL-ul rămâne scurt, cererea e POST). */
const LOT = 500

export function comenziFaraStarePlata<T extends RandComandaCuVanzare>(rows: T[]): T[] {
  return rows.filter((row) => Boolean(row.linked_vanzare_id) && !row.vanzare)
}

export async function completeazaStareaPlatii<T extends RandComandaCuVanzare>(
  client: StarePlataRpcClient,
  rows: T[],
): Promise<T[]> {
  const lipsa = comenziFaraStarePlata(rows)
  if (lipsa.length === 0) return rows

  const stari = new Map<string, StarePlataVanzare>()
  for (let i = 0; i < lipsa.length; i += LOT) {
    const ids = lipsa.slice(i, i + LOT).map((row) => row.id)
    try {
      const { data, error } = await client.rpc('comenzi_stare_plata', { p_comanda_ids: ids })
      if (error) return rows
      for (const rand of (Array.isArray(data) ? data : []) as RandStarePlata[]) {
        if (!rand?.comanda_id) continue
        stari.set(rand.comanda_id, {
          status_plata: rand.status_plata ?? null,
          data_incasare: rand.data_incasare ?? null,
          cantitate_kg: rand.cantitate_kg == null ? null : Number(rand.cantitate_kg),
          pret_lei_kg: rand.pret_lei_kg == null ? null : Number(rand.pret_lei_kg),
          suma_incasata_partial_lei:
            rand.suma_incasata_partial_lei == null ? null : Number(rand.suma_incasata_partial_lei),
        })
      }
    } catch {
      return rows
    }
  }

  if (stari.size === 0) return rows
  return rows.map((row) => {
    const stare = !row.vanzare ? stari.get(row.id) : undefined
    return stare ? ({ ...row, vanzare: stare } as T) : row
  })
}
