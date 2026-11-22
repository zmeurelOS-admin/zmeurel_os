import { NextResponse } from 'next/server'

import { apiError } from '@/lib/api/route-security'
import { origineAplicatie, raportPentruAplicatie } from '@/lib/analize/raport-server'
import { captureApiError } from '@/lib/monitoring/report-error'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Raportul unei analize, pentru aplicație (vederea „Raportul analizei”, PDF-ul și afișul). Întâi sesiunea
 * utilizatorului citește analiza (RLS: proprietarul sau operatorul cu „Tratamente”); abia apoi serverul
 * construiește raportul cu service role, din aceleași câmpuri permise ca pagina publică.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'INVALID_ID', 'Analiză necunoscută.')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return apiError(401, 'UNAUTHORIZED', 'Autentificare necesară.')

    const { data, error } = await (supabase as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: { id: string; tenant_id: string } | null; error: unknown }> } } }
    })
      .from('analize_fructe')
      .select('id,tenant_id')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return apiError(404, 'NOT_FOUND', 'Analiza nu există sau nu ai acces la ea.')

    const url = new URL(request.url)
    const rezultat = await raportPentruAplicatie(data.id, data.tenant_id, origineAplicatie(url.host, url.protocol.replace(':', '')))
    if (!rezultat) return apiError(404, 'FARA_RAPORT', 'Raportul există doar pentru o analiză conformă.')
    return NextResponse.json({ ok: true, data: rezultat })
  } catch (error) {
    captureApiError(error, { route: '/api/analize/[id]/raport' })
    return apiError(500, 'EROARE', 'Raportul nu s-a putut face. Încearcă din nou.')
  }
}
