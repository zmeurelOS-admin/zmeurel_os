type FinancialModule = 'cheltuieli' | 'investitii'

type FinancialOperation =
  | 'auth.getUser'
  | 'tenant.resolve'
  | 'current_tenant_id'
  | 'generate_business_id'
  | 'insert'
  | 'upsert'
  | 'update'
  | 'delete'

type FinancialTableOrRpc =
  | 'auth'
  | 'public.current_tenant_id'
  | 'public.generate_business_id'
  | 'public.cheltuieli_diverse'
  | 'public.investitii'

export type FinancialMutationErrorKind =
  | 'session_expired'
  | 'tenant_unavailable'
  | 'tenant_mismatch'
  | 'rpc_missing'
  | 'schema_cache_unsynced'
  | 'permission_denied'
  | 'duplicate_business_id'
  | 'duplicate_record'
  | 'invalid_data'
  | 'unknown'

type ErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
  status?: number
  statusCode?: number
  constraint?: string
}

export class FinancialMutationError extends Error {
  code?: string
  details?: string
  hint?: string
  status?: number
  module: FinancialModule
  operation: FinancialOperation
  tableOrRpc: FinancialTableOrRpc
  kind: FinancialMutationErrorKind
  constraint?: string
  userMessage: string

  constructor(params: {
    code?: string
    message: string
    details?: string
    hint?: string
    status?: number
    module: FinancialModule
    operation: FinancialOperation
    tableOrRpc: FinancialTableOrRpc
    kind: FinancialMutationErrorKind
    constraint?: string
    userMessage: string
  }) {
    super(params.message)
    this.name = 'FinancialMutationError'
    this.code = params.code
    this.details = params.details
    this.hint = params.hint
    this.status = params.status
    this.module = params.module
    this.operation = params.operation
    this.tableOrRpc = params.tableOrRpc
    this.kind = params.kind
    this.constraint = params.constraint
    this.userMessage = params.userMessage
  }
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getStatus(candidate: ErrorLike): number | undefined {
  return candidate.status ?? candidate.statusCode
}

function parseConstraint(candidate: ErrorLike): string | undefined {
  if (candidate.constraint) return candidate.constraint

  const haystack = `${candidate.message ?? ''} ${candidate.details ?? ''}`
  const match = haystack.match(/unique constraint \"([^\"]+)\"/i)
  return match?.[1]
}

function getRawMessage(candidate: ErrorLike, fallbackMessage: string): string {
  return String(candidate.message || candidate.details || candidate.hint || fallbackMessage).trim()
}

function isRpcMissing(candidate: ErrorLike, normalizedMessage: string, tableOrRpc: FinancialTableOrRpc) {
  return (
    candidate.code === 'PGRST202' ||
    candidate.code === '42883' ||
    (tableOrRpc === 'public.generate_business_id' &&
      (normalizedMessage.includes('generate_business_id') ||
        normalizedMessage.includes('function public.generate_business_id')))
  )
}

function isSchemaCacheUnsynced(candidate: ErrorLike, normalizedMessage: string) {
  return (
    candidate.code === 'PGRST204' ||
    candidate.code === '42703' ||
    normalizedMessage.includes('schema cache') ||
    normalizedMessage.includes('could not find the') ||
    normalizedMessage.includes('postgrest')
  )
}

function isSessionExpired(candidate: ErrorLike, normalizedMessage: string) {
  const status = getStatus(candidate)
  return (
    status === 401 ||
    normalizedMessage === 'neautorizat' ||
    normalizedMessage.includes('jwt') ||
    normalizedMessage.includes('refresh token') ||
    normalizedMessage.includes('auth session missing')
  )
}

function isTenantUnavailable(normalizedMessage: string) {
  return (
    normalizedMessage.includes('tenant indisponibil') ||
    normalizedMessage.includes('tenant invalid') ||
    normalizedMessage.includes('invalid pentru tenantul curent')
  )
}

function isPermissionDenied(candidate: ErrorLike, normalizedMessage: string) {
  const status = getStatus(candidate)
  return (
    candidate.code === '42501' ||
    status === 403 ||
    normalizedMessage.includes('row-level security') ||
    normalizedMessage.includes('permission denied') ||
    normalizedMessage.includes('forbidden')
  )
}

function isInvalidData(candidate: ErrorLike, normalizedMessage: string) {
  return (
    candidate.code === '22P02' ||
    candidate.code === '23502' ||
    candidate.code === '23503' ||
    candidate.code === '23514' ||
    normalizedMessage.includes('obligator') ||
    normalizedMessage.includes('invalid input') ||
    normalizedMessage.includes('violates foreign key constraint') ||
    normalizedMessage.includes('null value')
  )
}

function getDuplicateKind(constraint: string | undefined): FinancialMutationErrorKind {
  if (!constraint) return 'duplicate_record'
  if (
    constraint.includes('id_cheltuiala') ||
    constraint.includes('id_investitie') ||
    constraint.includes('business_id')
  ) {
    return 'duplicate_business_id'
  }
  return 'duplicate_record'
}

function getUserMessage(kind: FinancialMutationErrorKind, module: FinancialModule, constraint?: string) {
  switch (kind) {
    case 'session_expired':
      return 'Sesiunea a expirat. Autentifică-te din nou și încearcă iar.'
    case 'tenant_unavailable':
      return 'Contextul fermei nu este disponibil. Reîncarcă pagina și încearcă din nou.'
    case 'tenant_mismatch':
      return 'Contextul fermei nu este sincronizat. Reîncarcă pagina înainte să salvezi.'
    case 'rpc_missing':
      return 'Funcția necesară pentru salvare lipsește din baza de date. Aplică migrarea și reîncarcă schema PostgREST.'
    case 'schema_cache_unsynced':
      return 'Schema bazei de date nu este sincronizată. Reîncarcă aplicația sau rulează reload schema în Supabase.'
    case 'permission_denied':
      return module === 'cheltuieli' || module === 'investitii'
        ? 'Nu ai permisiunea pentru a salva în acest modul.'
        : 'Nu ai permisiunea pentru această operație.'
    case 'duplicate_business_id':
      return 'ID-ul generat pentru această înregistrare există deja în baza de date. Verifică secvența și reîncearcă.'
    case 'duplicate_record':
      if (constraint?.includes('client_sync_id')) {
        return 'Identificatorul de sincronizare există deja. Reîncarcă pagina și încearcă din nou.'
      }
      return 'Există deja o înregistrare care încalcă o regulă de unicitate.'
    case 'invalid_data':
      return 'Datele trimise sunt invalide. Verifică formularul și încearcă din nou.'
    default:
      return 'Nu s-a putut salva. Încearcă din nou.'
  }
}

export function createFinancialMutationError(params: {
  error: unknown
  fallbackMessage: string
  module: FinancialModule
  operation: FinancialOperation
  tableOrRpc: FinancialTableOrRpc
  kindOverride?: FinancialMutationErrorKind
  statusOverride?: number
}) {
  const candidate = (params.error ?? {}) as ErrorLike
  const code = candidate.code
  const details = candidate.details
  const hint = candidate.hint
  const constraint = parseConstraint(candidate)
  const rawMessage = getRawMessage(candidate, params.fallbackMessage)
  const normalizedMessage = normalizeText(rawMessage)
  const status = params.statusOverride ?? getStatus(candidate)

  const kind =
    params.kindOverride ??
    (isSessionExpired(candidate, normalizedMessage)
      ? 'session_expired'
      : isTenantUnavailable(normalizedMessage)
        ? 'tenant_unavailable'
        : isRpcMissing(candidate, normalizedMessage, params.tableOrRpc)
          ? 'rpc_missing'
          : isSchemaCacheUnsynced(candidate, normalizedMessage)
            ? 'schema_cache_unsynced'
            : code === '23505'
              ? getDuplicateKind(constraint)
              : isPermissionDenied(candidate, normalizedMessage)
                ? 'permission_denied'
                : isInvalidData(candidate, normalizedMessage)
                  ? 'invalid_data'
                  : 'unknown')

  return new FinancialMutationError({
    code,
    message: rawMessage,
    details,
    hint,
    status,
    module: params.module,
    operation: params.operation,
    tableOrRpc: params.tableOrRpc,
    kind,
    constraint,
    userMessage: getUserMessage(kind, params.module, constraint),
  })
}

export function createTenantMismatchFinancialError(params: {
  module: FinancialModule
  expectedTenantId: string
  currentTenantId: string | null
}) {
  return new FinancialMutationError({
    code: 'TENANT_CONTEXT_MISMATCH',
    message: `Tenant context mismatch: payload tenant ${params.expectedTenantId} differs from current_tenant_id ${params.currentTenantId ?? 'null'}.`,
    status: 409,
    module: params.module,
    operation: 'current_tenant_id',
    tableOrRpc: 'public.current_tenant_id',
    kind: 'tenant_mismatch',
    userMessage: getUserMessage('tenant_mismatch', params.module),
  })
}

export function getFinancialMutationError(error: unknown, context: {
  fallbackMessage: string
  module: FinancialModule
  operation: FinancialOperation
  tableOrRpc: FinancialTableOrRpc
}) {
  if (error instanceof FinancialMutationError) {
    return error
  }

  return createFinancialMutationError({
    error,
    fallbackMessage: context.fallbackMessage,
    module: context.module,
    operation: context.operation,
    tableOrRpc: context.tableOrRpc,
  })
}

export function logFinancialMutationError(error: unknown, context?: {
  fallbackMessage?: string
  module?: FinancialModule
  operation?: FinancialOperation
  tableOrRpc?: FinancialTableOrRpc
}) {
  const normalized =
    error instanceof FinancialMutationError
      ? error
      : context
        ? getFinancialMutationError(error, {
            fallbackMessage: context.fallbackMessage ?? 'Nu s-a putut salva. Încearcă din nou.',
            module: context.module ?? 'cheltuieli',
            operation: context.operation ?? 'insert',
            tableOrRpc: context.tableOrRpc ?? 'public.cheltuieli_diverse',
          })
        : null

  const payload = normalized
    ? {
        code: normalized.code ?? null,
        message: normalized.message,
        details: normalized.details ?? null,
        hint: normalized.hint ?? null,
        status: normalized.status ?? null,
        module: normalized.module,
        operation: normalized.operation,
        tableOrRpc: normalized.tableOrRpc,
      }
    : {
        code: null,
        message: error instanceof Error ? error.message : 'unknown',
        details: null,
        hint: null,
        status: null,
        module: context?.module ?? null,
        operation: context?.operation ?? null,
        tableOrRpc: context?.tableOrRpc ?? null,
      }

  console.error('[financial-mutation]', payload)
  return normalized
}

export type {
  FinancialModule,
  FinancialOperation,
  FinancialTableOrRpc,
}
