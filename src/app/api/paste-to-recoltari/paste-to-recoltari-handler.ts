import { NextResponse } from 'next/server'

import { getBucharestNowContext } from '@/app/api/chat/date-helpers'
import {
  PASTE_TO_X_MODULES,
  PasteToXRecoltareSchema,
  type PasteToXRecoltare,
  buildPasteToXSystemPrompt,
  buildPasteToXUserMessage,
} from '@/lib/ai/paste-to-x'
import {
  createPasteToXHandler,
  type PasteToXRouteDeps,
} from '@/lib/ai/paste-to-x-handler-factory'

export type PasteToRecoltariRouteDeps = PasteToXRouteDeps

export function createPasteToRecoltariHandler(
  depsOverride: Partial<PasteToRecoltariRouteDeps> = {},
) {
  const extractHandler = createPasteToXHandler<PasteToXRecoltare>(
    {
      module: 'recoltari',
      outputSchema: PasteToXRecoltareSchema,
      requiredAccessModule: 'recoltari',
      buildSystemPrompt: (now) => buildPasteToXSystemPrompt('recoltari', now),
      buildUserMessage: buildPasteToXUserMessage,
      moduleWriteLabel: 'Recoltări',
      logNamespace: 'paste-to-recoltari',
      requestFailedCode: 'PASTE_TO_RECOLTARI_FAILED',
      requestFailedMessage: 'Nu am putut extrage recoltarea din mesaj.',
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

    const parsed = (await extractionResponse.json()) as PasteToXRecoltare

    return NextResponse.json({
      draft: true,
      data: parsed,
    })
  }
}

export const pasteToRecoltariAutosaveMode = PASTE_TO_X_MODULES.recoltari.autosave
