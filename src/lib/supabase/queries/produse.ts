import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export const CATEGORII_PRODUSE = ['fruct', 'leguma', 'procesat', 'altele'] as const
export const UNITATI_VANZARE = ['kg', 'buc', 'ladă', 'casoletă', 'palet', 'cutie'] as const

export type CategorieProdus = (typeof CATEGORII_PRODUSE)[number]
export type UnitateVanzare = (typeof UNITATI_VANZARE)[number]

export interface Produs {
  id: string
  tenant_id: string
  nume: string
  descriere: string | null
  categorie: CategorieProdus
  unitate_vanzare: UnitateVanzare
  gramaj_per_unitate: number | null
  pret_unitar: number | null
  moneda: string
  poza_1_url: string | null
  poza_2_url: string | null
  status: 'activ' | 'inactiv'
  created_at: string
  updated_at: string
}

export interface CreateProdusInput {
  nume: string
  descriere?: string | null
  categorie?: CategorieProdus
  unitate_vanzare?: UnitateVanzare
  gramaj_per_unitate?: number | null
  pret_unitar?: number | null
  poza_1_url?: string | null
  poza_2_url?: string | null
}

export interface UpdateProdusInput {
  nume?: string
  descriere?: string | null
  categorie?: CategorieProdus
  unitate_vanzare?: UnitateVanzare
  gramaj_per_unitate?: number | null
  pret_unitar?: number | null
  poza_1_url?: string | null
  poza_2_url?: string | null
  status?: 'activ' | 'inactiv'
}

const SELECT_COLS =
  'id,tenant_id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,pret_unitar,moneda,poza_1_url,poza_2_url,status,created_at,updated_at'

export async function getProduse(): Promise<Produs[]> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('produse')
    .select(SELECT_COLS)
    .eq('tenant_id', tenantId)
    .order('nume', { ascending: true })

  if (error) throw error
  return (data ?? []) as Produs[]
}

export async function getProduseActiv(): Promise<Produs[]> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('produse')
    .select(SELECT_COLS)
    .eq('tenant_id', tenantId)
    .eq('status', 'activ')
    .order('nume', { ascending: true })

  if (error) throw error
  return (data ?? []) as Produs[]
}

export async function createProdus(input: CreateProdusInput): Promise<Produs> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('produse')
    .insert({
      tenant_id: tenantId,
      nume: input.nume,
      descriere: input.descriere ?? null,
      categorie: input.categorie ?? 'fruct',
      unitate_vanzare: input.unitate_vanzare ?? 'kg',
      gramaj_per_unitate: input.gramaj_per_unitate ?? null,
      pret_unitar: input.pret_unitar ?? null,
      poza_1_url: input.poza_1_url ?? null,
      poza_2_url: input.poza_2_url ?? null,
    })
    .select(SELECT_COLS)
    .single()

  if (error) throw error
  return data as Produs
}

export async function updateProdus(id: string, input: UpdateProdusInput): Promise<Produs> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('produse')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(SELECT_COLS)
    .single()

  if (error) throw error
  return data as Produs
}

export async function deleteProdus(id: string): Promise<void> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)

  const { error } = await supabase
    .from('produse')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

/** Resize image on canvas to maxWidth (default 800) and return a JPEG Blob */
async function resizeImage(file: File, maxWidth = 800): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = reject
    img.src = url
  })
}

/**
 * Upload a product photo to Storage.
 * Path: {tenantId}/{produsId}/{slot}.jpg  (slot = 1 or 2)
 * Returns the public URL.
 */
export async function uploadProdusPhoto(
  produsId: string,
  slot: 1 | 2,
  file: File,
): Promise<string> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const blob = await resizeImage(file)
  const path = `${tenantId}/${produsId}/${slot}.jpg`

  const { error } = await supabase.storage
    .from('produse-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('produse-photos').getPublicUrl(path)
  // Bust cache by appending a timestamp query param
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function deleteProdusPhoto(produsId: string, slot: 1 | 2): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const path = `${tenantId}/${produsId}/${slot}.jpg`

  const { error } = await supabase.storage.from('produse-photos').remove([path])
  if (error) throw error
}
