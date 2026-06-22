import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { z } from 'zod'

import type { BucharestNowContext } from '@/app/api/chat/date-helpers'
import { consumeFixedWindowRateLimit } from '@/lib/api/rate-limit'
import { PASTE_TO_X_MODEL, type PasteToXModule } from '@/lib/ai/paste-to-x'
import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { normalizeFarmMemberAccess } from '@/lib/farm-members/access'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

const DEFAULT_MAX_MESSAGE_CHARS = 4_000
const DEFAULT_USER_RATE_LIMIT = { limit: 20, windowMs: 10 * 60_000 } as const
const DEFAULT_TENANT_RATE_LIMIT = { limit: 100, windowMs: 60 * 60_000 } as const

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type FarmMemberRow = Pick<
  Database['public']['Tables']['farm_members']['Row'],
  'tenant_id' | 'role' | 'modules_access' | 'is_active'
>

export type PasteToXRateLimit = {
  limit: number
  windowMs: number
}

export type PasteToXInvokeAnthropicParams = {
  apiKey: string
  systemPrompt: string
  userMessage: string
}

export type PasteToXRouteDeps = {
  createClient: typeof createClient
  getSupabaseAdmin: typeof getSupabaseAdmin
  getNowContext: () => BucharestNowContext
  consumeRateLimit: typeof consumeFixedWindowRateLimit
  invokeAnthropic: (params: PasteToXInvokeAnthropicParams) => Promise<{ text: string }>
}

export type PasteToXAdminClient = ReturnType<typeof getSupabaseAdmin>

export type PasteToXTenantGateParams<TParsed> = {
  admin: PasteToXAdminClient
  config: PasteToXHandlerConfig<TParsed>
  tenantId: string
  userId: string
}

export type PasteToXTenantGateResult =
  | { allowed: true }
  | {
      allowed: false
      code: string
      message: string
      status?: number
    }

export type PasteToXHandlerConfig<TParsed> = {
  module: PasteToXModule
  outputSchema: z.ZodType<TParsed>
  requiredAccessModule: string
  buildSystemPrompt: (now: BucharestNowContext) => string
  buildUserMessage: (text: string) => string
  normalize?: (raw: TParsed) => TParsed
  userRateLimit?: PasteToXRateLimit
  tenantRateLimit?: PasteToXRateLimit
  maxMessageChars?: number
  moduleWriteLabel?: string
  missingApiKeyMessage?: string
  invalidModelMessage?: string
  logNamespace?: string
  requestFailedCode?: string
  requestFailedMessage?: string
  buildUserRateLimitKey?: (params: { userId: string; module: PasteToXModule }) => string
  buildTenantRateLimitKey?: (params: { tenantId: string; module: PasteToXModule }) => string
  ensureTenantAllowed?: (
    params: PasteToXTenantGateParams<TParsed>,
  ) => Promise<PasteToXTenantGateResult>
}

const DEFAULT_PASTE_TO_X_ROUTE_DEPS: PasteToXRouteDeps = {
  createClient,
  getSupabaseAdmin,
  getNowContext: () => {
    throw new Error('PasteToX getNowContext must be provided by the route wrapper.')
  },
  consumeRateLimit: consumeFixedWindowRateLimit,
  async invokeAnthropic({ apiKey, systemPrompt, userMessage }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: PASTE_TO_X_MODEL,
        max_tokens: 512,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(
        '[paste-to-x] Anthropic API error',
        sanitizeForLog(
          {
            status: response.status,
            body: errorText,
          },
          { redactTextFields: true },
        ),
      )
      throw new Error('ANTHROPIC_ERROR')
    }

    const anthropicJson = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>
    }
    const rawText = anthropicJson.content?.find(
      (block) => block.type === 'text' || typeof block.text === 'string',
    )?.text

    if (!rawText) {
      throw new Error('EMPTY_MODEL_RESPONSE')
    }

    return { text: rawText }
  },
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parsePasteToXModelText<TParsed>(
  rawText: string,
  schema: z.ZodType<TParsed>,
  normalize?: (raw: TParsed) => TParsed,
): TParsed {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(stripJsonFence(rawText))
  } catch {
    throw new Error('INVALID_MODEL_JSON')
  }

  const parsed = schema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error('INVALID_MODEL_SCHEMA')
  }

  return normalize ? normalize(parsed.data) : parsed.data
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Ai făcut prea multe încercări. Așteaptă puțin și încearcă din nou.',
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfterSeconds)),
      },
    },
  )
}

export async function resolvePasteToXWriteAccess(
  supabase: ServerSupabaseClient,
  userId: string,
  requiredAccessModule: string,
): Promise<{ allowed: boolean; tenantId: string | null }> {
  const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
  if (!tenantId) {
    return { allowed: false, tenantId: null }
  }

  const { data: ownerTenant, error: ownerError } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_user_id', userId)
    .limit(1)
    .maybeSingle()

  if (ownerError) {
    throw ownerError
  }

  if (ownerTenant?.id) {
    return { allowed: true, tenantId }
  }

  const farmMembersClient = supabase as SupabaseClient<Database> & {
    from(table: 'farm_members'): ReturnType<SupabaseClient<Database>['from']>
  }

  const { data: member, error: memberError } = await farmMembersClient
    .from('farm_members')
    .select('tenant_id, role, modules_access, is_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('role', 'operator')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    throw memberError
  }

  const operatorMember = member as FarmMemberRow | null
  const access = normalizeFarmMemberAccess(operatorMember?.modules_access, { legacyFallback: true })
  const canWriteModule = access.some(
    (item) => item.module === requiredAccessModule && item.level === 'write',
  )

  return {
    allowed: Boolean(operatorMember?.tenant_id) && canWriteModule,
    tenantId,
  }
}

export function createPasteToXHandler<TParsed>(
  config: PasteToXHandlerConfig<TParsed>,
  depsOverride: Partial<PasteToXRouteDeps> = {},
): (request: Request) => Promise<NextResponse> {
  const deps: PasteToXRouteDeps = {
    ...DEFAULT_PASTE_TO_X_ROUTE_DEPS,
    ...depsOverride,
  }

  const maxMessageChars = config.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS
  const userRateLimit = config.userRateLimit ?? DEFAULT_USER_RATE_LIMIT
  const tenantRateLimit = config.tenantRateLimit ?? DEFAULT_TENANT_RATE_LIMIT
  const moduleWriteLabel = config.moduleWriteLabel ?? config.module
  const invalidModelMessage =
    config.invalidModelMessage ?? 'Răspunsul AI nu a respectat schema așteptată.'
  const missingApiKeyMessage =
    config.missingApiKeyMessage ?? 'Cheia Anthropic nu este configurată.'
  const logNamespace = config.logNamespace ?? `paste-to-${config.module}`
  const requestFailedCode = config.requestFailedCode ?? 'PASTE_TO_X_FAILED'
  const requestFailedMessage =
    config.requestFailedMessage ?? 'Nu am putut extrage datele din mesaj.'
  const buildUserRateLimitKey =
    config.buildUserRateLimitKey ??
    (({ userId, module }: { userId: string; module: PasteToXModule }) =>
      `paste-to-x:user:${userId}:${module}`)
  const buildTenantRateLimitKey =
    config.buildTenantRateLimitKey ??
    (({ tenantId, module }: { tenantId: string; module: PasteToXModule }) =>
      `paste-to-x:tenant:${tenantId}:${module}`)

  return async function POST(request: Request) {
    try {
      const invalidOrigin = validateSameOriginMutation(request)
      if (invalidOrigin) return invalidOrigin

      const supabase = await deps.createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user?.id) {
        return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
      }

      const access = await resolvePasteToXWriteAccess(
        supabase,
        user.id,
        config.requiredAccessModule,
      )
      if (!access.allowed) {
        return apiError(403, 'FORBIDDEN', `Nu ai acces de scriere în modulul ${moduleWriteLabel}.`)
      }
      if (!access.tenantId) {
        return apiError(403, 'FORBIDDEN', 'Tenant indisponibil pentru utilizatorul curent.')
      }

      if (config.ensureTenantAllowed) {
        const admin = deps.getSupabaseAdmin()
        const tenantGate = await config.ensureTenantAllowed({
          admin,
          config,
          tenantId: access.tenantId,
          userId: user.id,
        })
        if (!tenantGate.allowed) {
          return apiError(
            tenantGate.status ?? 403,
            tenantGate.code,
            tenantGate.message,
          )
        }
      }

      const body = (await request.json().catch(() => null)) as { text?: unknown } | null
      const text = typeof body?.text === 'string' ? body.text.trim() : ''

      if (!text) {
        return apiError(400, 'INVALID_TEXT', 'Mesajul este obligatoriu.')
      }

      if (text.length > maxMessageChars) {
        return apiError(
          400,
          'TEXT_TOO_LONG',
          `Mesajul este prea lung (max ${maxMessageChars} caractere).`,
        )
      }

      const userRateState = deps.consumeRateLimit(
        buildUserRateLimitKey({ userId: user.id, module: config.module }),
        userRateLimit,
      )
      if (!userRateState.allowed) {
        return rateLimitedResponse(userRateState.retryAfterSeconds)
      }

      const tenantRateState = deps.consumeRateLimit(
        buildTenantRateLimitKey({
          tenantId: access.tenantId,
          module: config.module,
        }),
        tenantRateLimit,
      )
      if (!tenantRateState.allowed) {
        return rateLimitedResponse(tenantRateState.retryAfterSeconds)
      }

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return apiError(500, 'MISSING_ANTHROPIC_API_KEY', missingApiKeyMessage)
      }

      const nowContext = deps.getNowContext()
      const response = await deps.invokeAnthropic({
        apiKey,
        systemPrompt: config.buildSystemPrompt(nowContext),
        userMessage: config.buildUserMessage(text),
      })

      let parsed: TParsed
      try {
        parsed = parsePasteToXModelText(response.text, config.outputSchema, config.normalize)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'INVALID_MODEL_RESPONSE'
        const message =
          code === 'INVALID_MODEL_JSON' || code === 'INVALID_MODEL_SCHEMA'
            ? invalidModelMessage
            : 'Răspunsul AI nu conține date utile.'

        console.error(
          `[${logNamespace}] Invalid model response`,
          sanitizeForLog(
            {
              code,
              rawText: response.text,
            },
            { redactTextFields: true },
          ),
        )

        return apiError(502, 'INVALID_MODEL_RESPONSE', message)
      }

      return NextResponse.json(parsed)
    } catch (error) {
      console.error(
        `[${logNamespace}] Nu am putut procesa mesajul.`,
        sanitizeForLog({
          error: toSafeErrorContext(error),
          stage: `${config.module}_route`,
        }),
      )

      return apiError(500, requestFailedCode, requestFailedMessage)
    }
  }
}
