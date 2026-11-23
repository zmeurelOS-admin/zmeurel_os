/**
 * Cine primește mementoul „Verifică capcanele”: proprietarul și operatorii activi cu „Scrie” pe Tratamente.
 * Cei cu „Citește”, cei fără Tratamente și cei dezactivați nu primesc. Alerta „Peste prag” merge doar la proprietar.
 * Drepturile se citesc doar prin `resolveFarmMemberAccess` (regula din CLAUDE.md). Funcții pure.
 */
import { resolveFarmMemberAccess } from '@/lib/farm-members/access'

export interface MembruFerma {
  user_id: string | null
  role: string | null
  is_active: boolean | null
  modules_access: unknown
}

export function poateScrieTratamente(membru: MembruFerma): boolean {
  if (!membru.user_id || membru.is_active !== true || membru.role !== 'operator') return false
  return resolveFarmMemberAccess(membru.modules_access, { legacyFallback: true }).some(
    (item) => item.module === 'tratamente' && item.level === 'write',
  )
}

/** Proprietarul întâi, apoi operatorii cu „Scrie” pe Tratamente, fiecare o singură dată. */
export function destinatariMementoCapcane(input: { ownerUserId: string | null; membri: readonly MembruFerma[] }): string[] {
  const ids: string[] = []
  if (input.ownerUserId) ids.push(input.ownerUserId)
  for (const membru of input.membri) {
    if (!poateScrieTratamente(membru)) continue
    if (membru.user_id && !ids.includes(membru.user_id)) ids.push(membru.user_id)
  }
  return ids
}
