import { getSupabase } from '@/lib/supabase/client'

const CAPCANE_BUCKET = 'capcane'
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 3650

export interface UploadedCapcanaPhoto {
  path: string
  signedUrl: string
}

function inferExtension(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export function validateCapcanaPhoto(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Fotografia trebuie să fie JPG, PNG sau WEBP.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Fotografia depășește limita de 5 MB.'
  }

  return null
}

export async function uploadCapcanaPhoto(params: {
  tenantId: string
  entityId: string
  file: File
}): Promise<UploadedCapcanaPhoto> {
  const supabase = getSupabase()
  const extension = inferExtension(params.file)
  const path = `${params.tenantId}/${params.entityId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(CAPCANE_BUCKET)
    .upload(path, params.file, {
      contentType: params.file.type || 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) throw uploadError

  const { data, error: signedError } = await supabase.storage
    .from(CAPCANE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (signedError || !data?.signedUrl) {
    await supabase.storage.from(CAPCANE_BUCKET).remove([path])
    throw signedError ?? new Error('Nu am putut genera preview-ul fotografiei.')
  }

  return {
    path,
    signedUrl: data.signedUrl,
  }
}

export async function deleteCapcanaPhoto(path: string): Promise<void> {
  if (!path) return

  const supabase = getSupabase()
  const { error } = await supabase.storage.from(CAPCANE_BUCKET).remove([path])
  if (error) throw error
}
