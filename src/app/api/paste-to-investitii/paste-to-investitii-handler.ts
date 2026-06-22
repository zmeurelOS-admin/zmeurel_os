import { NextResponse } from 'next/server'

import { getBucharestNowContext } from '@/app/api/chat/date-helpers'
import {
  PASTE_TO_X_MODULES,
  PasteToXInvestitieSchema,
  type PasteToXInvestitie,
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

export type PasteToInvestitiiRouteDeps = PasteToXRouteDeps
export type PasteToInvestitiiDraftReason =
  | 'low_confidence'
  | 'missing_fields'
  | 'above_threshold'

function getInvestitiiConfirmationThresholdLei(): number {
  const threshold = PASTE_TO_X_MODULES.investitii.confirmationThresholdLei
  if (threshold === null) {
    throw new Error('Investitii confirmation threshold must be configured.')
  }
  return threshold
}

const INVESTITII_CONFIRMATION_THRESHOLD_LEI = getInvestitiiConfirmationThresholdLei()

function canAutoSaveInvestitie(
  parsed: PasteToXInvestitie,
): { autoSave: boolean; draftReason?: PasteToInvestitiiDraftReason } {
  if (parsed.confidence === 'low') {
    return { autoSave: false, draftReason: 'low_confidence' }
  }

  if (parsed.data === null || parsed.suma_lei === null) {
    return { autoSave: false, draftReason: 'missing_fields' }
  }

  if (parsed.suma_lei > INVESTITII_CONFIRMATION_THRESHOLD_LEI) {
    return { autoSave: false, draftReason: 'above_threshold' }
  }

  return { autoSave: true }
}

export function createPasteToInvestitiiHandler(
  depsOverride: Partial<PasteToInvestitiiRouteDeps> = {},
) {
  const createServerClient = depsOverride.createClient ?? createClient
  const extractHandler = createPasteToXHandler<PasteToXInvestitie>(
    {
      module: 'investitii',
      outputSchema: PasteToXInvestitieSchema,
      requiredAccessModule: 'investitii',
      buildSystemPrompt: (now) => buildPasteToXSystemPrompt('investitii', now),
      buildUserMessage: buildPasteToXUserMessage,
      moduleWriteLabel: 'Investiții',
      logNamespace: 'paste-to-investitii',
      requestFailedCode: 'PASTE_TO_INVESTITII_FAILED',
      requestFailedMessage: 'Nu am putut extrage investiția din mesaj.',
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

    const parsed = (await extractionResponse.json()) as PasteToXInvestitie
    const decision = canAutoSaveInvestitie(parsed)

    if (!decision.autoSave) {
      return NextResponse.json({
        draft: true,
        draft_reason: decision.draftReason,
        data: parsed,
      })
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

      const idInvestitie = await generateBusinessId(supabase, 'INV')
      const { data, error } = await supabase
        .from('investitii')
        .insert({
          tenant_id: tenantId,
          id_investitie: idInvestitie,
          data: parsed.data,
          categorie: parsed.categorie,
          descriere: parsed.descriere,
          suma_lei: parsed.suma_lei,
          furnizor: parsed.furnizor,
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
      console.error('[paste-to-investitii] Nu am putut salva investiția extrasă.', error)
      return apiError(
        500,
        'PASTE_TO_INVESTITII_INSERT_FAILED',
        'Investiția a fost extrasă, dar nu a putut fi salvată automat.',
      )
    }
  }
}

export const pasteToInvestitiiAutosaveMode = PASTE_TO_X_MODULES.investitii.autosave
export const pasteToInvestitiiConfirmationThresholdLei =
  INVESTITII_CONFIRMATION_THRESHOLD_LEI
