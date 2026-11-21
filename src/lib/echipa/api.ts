import type { FarmMemberModuleAccess } from '@/lib/farm-members/access'

/**
 * Apelurile ecranului Echipa către API-urile existente (`/api/farm-members/*`), neschimbate.
 * Erorile ies ca `Error` cu mesajul în română.
 */

export type MembruEchipa = {
  id: string
  created_at: string
  role: 'operator' | 'livrator'
  name: string
  phone: string | null
  invite_token: string | null
  modules_access?: unknown
}

export function mesajEroare(cod: string | undefined, implicit: string): string {
  switch (cod) {
    case 'forbidden':
      return 'Doar proprietarul fermei poate schimba echipa.'
    case 'already_member':
      return 'Persoana e deja în echipa ta.'
    case 'invalid_modules':
      return 'Alege cel puțin un modul.'
    case 'not_found':
      return 'Omul nu mai e în echipă. Reîncarcă lista.'
    default:
      return implicit
  }
}

async function cerere<T>(url: string, init: RequestInit, implicit: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init })
  } catch {
    throw new Error('Fără internet. Încearcă din nou.')
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || !json) throw new Error(mesajEroare(json?.error, implicit))
  return json
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function incarcaEchipa(): Promise<MembruEchipa[]> {
  const json = await cerere<{ members?: MembruEchipa[] }>('/api/farm-members', {}, 'Nu am putut încărca echipa.')
  return json.members ?? []
}

export async function invitaOperator(modules: FarmMemberModuleAccess[]): Promise<{ link: string }> {
  const json = await cerere<{ invite_url?: string }>(
    '/api/farm-members/create-invite',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ modules }) },
    'Nu am putut genera invitația.',
  )
  if (!json.invite_url) throw new Error('Nu am putut genera invitația.')
  return { link: json.invite_url }
}

export async function invitaLivrator(input: { name: string; phone?: string }): Promise<{ link: string }> {
  const json = await cerere<{ invite_url?: string }>(
    '/api/farm-members/invite-livrator',
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: input.name, phone: input.phone || undefined }) },
    'Nu am putut genera linkul.',
  )
  if (!json.invite_url) throw new Error('Nu am putut genera linkul.')
  return { link: json.invite_url }
}

export async function salveazaAcces(id: string, modules: FarmMemberModuleAccess[]): Promise<FarmMemberModuleAccess[]> {
  const json = await cerere<{ modules?: FarmMemberModuleAccess[] }>(
    `/api/farm-members/${encodeURIComponent(id)}/access`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ modules }) },
    'Nu am putut salva accesul.',
  )
  if (!json.modules) throw new Error('Nu am putut salva accesul.')
  return json.modules
}

export async function retrimiteLink(id: string): Promise<{ link: string }> {
  const json = await cerere<{ invite_url?: string }>(
    `/api/farm-members/${encodeURIComponent(id)}/regenerate-token`,
    { method: 'POST' },
    'Nu am putut face un link nou.',
  )
  if (!json.invite_url) throw new Error('Nu am putut face un link nou.')
  return { link: json.invite_url }
}

export async function dezactiveaza(id: string): Promise<void> {
  await cerere<{ success?: boolean }>(
    `/api/farm-members/${encodeURIComponent(id)}/deactivate`,
    { method: 'PATCH' },
    'Nu am putut dezactiva.',
  )
}
