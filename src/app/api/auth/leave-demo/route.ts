import { NextResponse } from 'next/server'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Închide sesiunea pe server (cookies httpOnly) și răspunde cu redirect 303 la `/start`.
 * Apelat prin POST nativ (formular) din banner/setări demo — fără fetch + `location.replace`.
 */
export async function POST(request: Request) {
  const invalid = validateSameOriginMutation(request)
  if (invalid) return invalid

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/start', request.url), 303)
}
