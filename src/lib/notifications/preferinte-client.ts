'use client'

import { useQuery } from '@tanstack/react-query'

import { getSupabase } from '@/lib/supabase/client'

import {
  NOTIFICARI_PREFERINTE_IMPLICITE,
  isMissingTableError,
  normalizeazaPreferinte,
  type NotificariPreferinte,
} from './preferinte'

/** Mesajul când migrarea `20261120130000_notificari_preferinte.sql` încă nu e aplicată. */
export const PREFERINTE_INDISPONIBILE =
  'Alegerile de aici se pot salva după actualizarea bazei de date. Până atunci primești tot, cu liniște noaptea.'

export type PreferinteNotificariStare = NotificariPreferinte & {
  /** `false` = tabelul lipsește: ecranul arată valorile implicite, salvarea nu merge. */
  disponibil: boolean
}

export const preferinteNotificariQueryKey = ['notificari-preferinte'] as const

type PreferinteRow = { tipuri?: unknown; liniste_noaptea?: unknown }

// Tabelul nu e încă în tipurile generate.
type LooseTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: PreferinteRow | null; error: { code?: string; message?: string } | null }>
    }
  }
  upsert: (
    row: Record<string, unknown>,
    options: { onConflict: string },
  ) => PromiseLike<{ error: { code?: string; message?: string } | null }>
}

function preferinteTable(): LooseTable {
  return (getSupabase() as unknown as { from: (table: string) => LooseTable }).from('notificari_preferinte')
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Nu ești autentificat.')
  return user.id
}

export async function loadPreferinteNotificari(): Promise<PreferinteNotificariStare> {
  const userId = await currentUserId()
  const { data, error } = await preferinteTable().select('tipuri, liniste_noaptea').eq('user_id', userId).maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return { ...NOTIFICARI_PREFERINTE_IMPLICITE, disponibil: false }
    throw new Error(error.message || 'Nu am putut citi preferințele.')
  }
  return { ...normalizeazaPreferinte(data), disponibil: true }
}

/** Salvează tot rândul (upsert pe `user_id`). Aruncă un mesaj pe înțeles. */
export async function savePreferinteNotificari(preferinte: NotificariPreferinte): Promise<void> {
  const userId = await currentUserId()
  const { error } = await preferinteTable().upsert(
    {
      user_id: userId,
      tipuri: preferinte.tipuri,
      liniste_noaptea: preferinte.linisteNoaptea,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    if (isMissingTableError(error)) throw new Error(PREFERINTE_INDISPONIBILE)
    throw new Error('Nu s-a salvat. Verifică internetul și încearcă din nou.')
  }
}

export function usePreferinteNotificari() {
  return useQuery({
    queryKey: preferinteNotificariQueryKey,
    queryFn: loadPreferinteNotificari,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
