import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

export async function PATCH(req: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = typeof (body as Record<string, unknown>).phone === 'string'
    ? ((body as Record<string, unknown>).phone as string).trim()
    : null
  const phoneRegex = /^(\+?40|0)?[0-9]{9}$/

  if (!raw) {
    return NextResponse.json({ error: 'Numărul de telefon este obligatoriu.' }, { status: 400 })
  }

  const cleanedPhone = raw.replace(/[\s\-.]/g, '')
  if (!phoneRegex.test(cleanedPhone)) {
    return NextResponse.json({ error: 'Format telefon invalid' }, { status: 400 })
  }

  const normalized = normalizePhone(cleanedPhone)
  if (!normalized) {
    return NextResponse.json({ error: 'Format telefon invalid' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ phone: normalized })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ phone: normalized })
}
