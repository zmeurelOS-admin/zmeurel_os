import { getSupabase } from "@/lib/supabase/client"
import { generateBusinessId } from "@/lib/supabase/business-ids"
export interface Client {
  id: string
  id_client: string
  nume_client: string
  telefon: string | null
  email: string | null
  adresa: string | null
  pret_negociat_lei_kg: number | null
  observatii: string | null
  created_at: string | null
  updated_at: string | null
  tenant_id: string
}

export interface CreateClientInput {
  nume_client: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  pret_negociat_lei_kg?: number | null
  observatii?: string | null
}

export interface UpdateClientInput {
  nume_client?: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  pret_negociat_lei_kg?: number | null
  observatii?: string | null
}

export async function getClienți(): Promise<Client[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("clienti")
    .select("id,id_client,nume_client,telefon,email,adresa,pret_negociat_lei_kg,observatii,created_at,updated_at,tenant_id")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as Client[]
}

export async function createClienți(input: CreateClientInput): Promise<Client> {
  const supabase = getSupabase()

  const id_client = await generateBusinessId(supabase, 'C')

  const { data, error } = await supabase
    .from("clienti")
    .insert({
      id_client,
      nume_client: input.nume_client,
      telefon: input.telefon ?? null,
      email: input.email ?? null,
      adresa: input.adresa ?? null,
      pret_negociat_lei_kg: input.pret_negociat_lei_kg ?? null,
      observatii: input.observatii ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateClienți(
  id: string,
  input: UpdateClientInput
): Promise<Client> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("clienti")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteClienți(id: string): Promise<void> {
  const supabase = getSupabase()

  // Check for related records before deleting
  const { count: vanzariCount, error: vanzariError } = await supabase
    .from("vanzari")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)

  if (vanzariError) throw vanzariError

  const { count: comenziCount, error: comenziError } = await supabase
    .from("comenzi")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)

  if (comenziError) throw comenziError

  const { count: vanzariButasiCount, error: vanzariButasiError } = await supabase
    .from("vanzari_butasi")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)

  if (vanzariButasiError) throw vanzariButasiError

  // If any related records exist, throw a descriptive error
  if ((vanzariCount ?? 0) > 0 || (comenziCount ?? 0) > 0 || (vanzariButasiCount ?? 0) > 0) {
    const parts: string[] = []
    if ((vanzariCount ?? 0) > 0) parts.push(`${vanzariCount} vânzări`)
    if ((comenziCount ?? 0) > 0) parts.push(`${comenziCount} comenzi`)
    if ((vanzariButasiCount ?? 0) > 0) parts.push(`${vanzariButasiCount} vânzări butași`)
    
    throw new Error(`Nu poți șterge acest client. Are ${parts.join(" și ")} asociate.`)
  }

  // Only proceed with delete if all counts are 0
  const { error } = await supabase
    .from("clienti")
    .delete()
    .eq("id", id)

  if (error) throw error
}
