import { NextResponse } from 'next/server'

import { getBucharestNowContext } from '@/app/api/chat/date-helpers'
import {
  PASTE_TO_X_MODULES,
  PasteToXCheltuialaSchema,
  type PasteToXCheltuiala,
  buildPasteToXSystemPrompt,
  buildPasteToXUserMessage,
} from '@/lib/ai/paste-to-x'
import {
  createPasteToXHandler,
  type PasteToXRouteDeps,
} from '@/lib/ai/paste-to-x-handler-factory'
import { apiError } from '@/lib/api/route-security'
import { generateBusinessId } from '@/lib/supabase/business-ids'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

export type PasteToCheltuieliRouteDeps = PasteToXRouteDeps

function canAutoSaveCheltuiala(parsed: PasteToXCheltuiala) {
  return (
    parsed.confidence !== 'low' &&
    parsed.data !== null &&
    parsed.suma_lei !== null
  )
}

export function createPasteToCheltuieliHandler(
  depsOverride: Partial<PasteToCheltuieliRouteDeps> = {},
) {
  const createServerClient = depsOverride.createClient ?? createClient
  const extractHandler = createPasteToXHandler<PasteToXCheltuiala>(
    {
      module: 'cheltuieli',
      outputSchema: PasteToXCheltuialaSchema,
      requiredAccessModule: 'cheltuieli',
      buildSystemPrompt: (now) => buildPasteToXSystemPrompt('cheltuieli', now),
      buildUserMessage: buildPasteToXUserMessage,
      moduleWriteLabel: 'Cheltuieli',
      logNamespace: 'paste-to-cheltuieli',
      requestFailedCode: 'PASTE_TO_CHELTUIELI_FAILED',
      requestFailedMessage: 'Nu am putut extrage cheltuiala din mesaj.',
    },
    {
      getNowContext: () => getBucharestNowContext(),
      ...depsOverride,
    },
  )

  return async function POST(request: Request) {
    const extractionResponse = await extractHandler(request)

    if (!extractionResponse.ok) {
      return extractionResponse
    }

    const parsed = (await extractionResponse.json()) as PasteToXCheltuiala

    if (!canAutoSaveCheltuiala(parsed)) {
      return NextResponse.json({ draft: true, data: parsed })
    }

    try {
      const supabase = await createServerClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user?.id) {
        return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
      }

      const tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
      if (!tenantId) {
        return apiError(403, 'FORBIDDEN', 'Tenant indisponibil pentru utilizatorul curent.')
      }

      const idCheltuiala = await generateBusinessId(supabase, 'CH')
      const { data, error } = await supabase
        .from('cheltuieli_diverse')
        .insert({
          tenant_id: tenantId,
          id_cheltuiala: idCheltuiala,
          data: parsed.data,
          categorie: parsed.categorie,
          descriere: parsed.descriere,
          suma_lei: parsed.suma_lei,
          furnizor: parsed.furnizor,
          metoda_plata: parsed.metoda_plata,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        throw error ?? new Error('INSERT_FAILED')
      }

      return NextResponse.json({
        draft: false,
        data: parsed,
        inserted_id: data.id,
      })
    } catch (error) {
      console.error('[paste-to-cheltuieli] Nu am putut salva cheltuiala extrasă.', error)
      return apiError(
        500,
        'PASTE_TO_CHELTUIELI_INSERT_FAILED',
        'Cheltuiala a fost extrasă, dar nu a putut fi salvată automat.',
      )
    }
  }
}

export const pasteToCheltuieliAutosaveMode = PASTE_TO_X_MODULES.cheltuieli.autosave
