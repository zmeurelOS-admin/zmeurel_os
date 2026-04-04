import { NextResponse } from 'next/server'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function safeInternalPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

/**
 * Închide sesiunea pe server (cookies) și redirecționează (implicit `/`).
 * Opțional: `?next=/login` (doar path relativ) — ex. după ștergere cont.
 */
export async function POST(request: Request) {
  const invalid = validateSameOriginMutation(request)
  if (invalid) return invalid

  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL(request.url)
  const next = url.searchParams.get('next')
  const pathname = safeInternalPath(next)

  return NextResponse.redirect(new URL(pathname, url.origin), 303)
}
