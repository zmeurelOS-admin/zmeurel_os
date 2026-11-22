import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'

/**
 * Poza bonului la Cheltuieli și Investiții.
 *
 * Bucket privat `bonuri` (migrarea `20261120120000_bonuri_storage.sql`). Calea unui fișier:
 * `{tenant_id}/{cheltuieli|investitii|magazie}/{client_sync_id}.jpg` (Magazia: „+ Am cumpărat”, promptul 28). În `document_url` se salvează calea din bucket;
 * o valoare veche care începe cu `http` se deschide direct.
 */
export const BONURI_BUCKET = 'bonuri'
export const BON_MAX_SIDE = 1600
export const BON_JPEG_QUALITY = 0.8
export const BON_SIGNED_URL_SECONDS = 60 * 60
export const BON_UNREADABLE_MESSAGE = 'Poza nu s-a putut citi. Încearcă alta.'

export type BonTable = 'cheltuieli' | 'investitii' | 'magazie'

/**
 * De ce s-a salvat rândul fără poza aleasă: `offline` = nu era internet (poza nu pleacă și nu intră în coadă);
 * `ales` = urcarea a picat și omul a apăsat „Salvează fără bon”. `null` = cu bon, sau nu s-a ales nicio poză.
 */
export type FaraBon = 'offline' | 'ales' | null

/** Textul de sub „Salvat”: spune limpede când rândul a rămas fără poza bonului. */
export function textSalvat(rezumat: string, faraBon: FaraBon): string {
  if (faraBon === 'offline') return `${rezumat} · fără bon. Poza o adaugi din „Editează”, cu internet.`
  if (faraBon === 'ales') return `${rezumat} · fără bon. Poza o adaugi din „Editează”.`
  return rezumat
}

export class BonImageError extends Error {
  readonly userMessage = BON_UNREADABLE_MESSAGE

  constructor() {
    super(BON_UNREADABLE_MESSAGE)
    this.name = 'BonImageError'
  }
}

// ─── Calea și legătura ─────────────────────────────────────────────────────────

/** Dimensiunile după micșorare: latura mare are cel mult `max` px; o poză mică rămâne cum e. */
export function fitWithin(width: number, height: number, max = BON_MAX_SIDE): { width: number; height: number } {
  const longSide = Math.max(width, height)
  if (!(longSide > max)) return { width: Math.round(width), height: Math.round(height) }
  const scale = max / longSide
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function bonStoragePath(tenantId: string, table: BonTable, key: string): string {
  return `${tenantId}/${table}/${key}.jpg`
}

export type BonLink = { kind: 'direct'; url: string } | { kind: 'storage'; path: string }

/** Ce e în `document_url`: un URL vechi (se deschide direct) sau o cale din bucket (cere URL semnat). */
export function resolveBonLink(value: string | null | undefined): BonLink | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return { kind: 'direct', url: trimmed }
  return { kind: 'storage', path: trimmed.replace(/^\/+/, '') }
}

/** Calea din bucket, dacă `document_url` e una (nu un URL vechi). */
export function bonStoragePathOf(value: string | null | undefined): string | null {
  const link = resolveBonLink(value)
  return link?.kind === 'storage' ? link.path : null
}

// ─── Pregătirea pozei ──────────────────────────────────────────────────────────

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (cause) {
    URL.revokeObjectURL(url)
    throw cause
  }
}

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Unele browsere nu decodează prin `createImageBitmap` ce știu să arate într-un `<img>` (HEIC pe Safari).
    }
  }
  return decodeWithImageElement(file)
}

/**
 * Micșorează poza la latura mare de cel mult 1600 px și o exportă JPEG 0,8 (sub 2 MB).
 * Merge cu orice imagine pe care browserul o decodează, inclusiv HEIC de pe iPhone.
 * Aruncă `BonImageError` dacă poza nu se poate citi.
 */
export async function prepareBonImage(file: Blob): Promise<Blob> {
  let decoded: DecodedImage
  try {
    decoded = await decodeImage(file)
  } catch {
    throw new BonImageError()
  }

  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new BonImageError()
    const size = fitWithin(decoded.width, decoded.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new BonImageError()
    // JPEG nu are transparență: fundal alb, nu negru.
    context.fillStyle = 'white'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(decoded.source, 0, 0, size.width, size.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', BON_JPEG_QUALITY))
    if (!blob || blob.size === 0) throw new BonImageError()
    return blob
  } catch (cause) {
    if (cause instanceof BonImageError) throw cause
    throw new BonImageError()
  } finally {
    decoded.release()
  }
}

// ─── Stocarea ──────────────────────────────────────────────────────────────────

/**
 * Urcă bonul și întoarce calea din bucket. `upsert`: o reîncercare cu aceeași cheie scrie peste același fișier.
 * `path` (o cale existentă a rândului) are întâietate față de cea calculată din `key`.
 */
export async function uploadBon({
  table,
  key,
  blob,
  path,
}: {
  table: BonTable
  key: string
  blob: Blob
  path?: string | null
}): Promise<string> {
  const supabase = getSupabase()
  const target = path?.trim() || bonStoragePath(await getTenantId(supabase), table, key)
  const { error } = await supabase.storage.from(BONURI_BUCKET).upload(target, blob, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '60',
  })
  if (error) throw error
  return target
}

/** Șterge fișierul bonului (doar o cale din `bonuri`, nu un URL vechi). Best effort: nu aruncă. */
export async function removeBon(value: string | null | undefined): Promise<boolean> {
  const path = bonStoragePathOf(value)
  if (!path) return false
  try {
    const { error } = await getSupabase().storage.from(BONURI_BUCKET).remove([path])
    return !error
  } catch {
    return false
  }
}

/** URL-ul de deschis: valoarea însăși dacă e un URL vechi, altfel un URL semnat pe 1 oră (sau `null`). */
export async function signedBonUrl(value: string | null | undefined): Promise<string | null> {
  const link = resolveBonLink(value)
  if (!link) return null
  if (link.kind === 'direct') return link.url
  const { data, error } = await getSupabase().storage.from(BONURI_BUCKET).createSignedUrl(link.path, BON_SIGNED_URL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}
