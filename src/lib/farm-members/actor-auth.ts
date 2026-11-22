import {
  resolveFarmMemberAccess,
  type FarmMemberModule,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Cine face cererea, pentru rutele server care scriu cu service role (RLS nu le mai oprește):
 * utilizatorul din sesiune, ferma în care lucrează și ce are voie acolo.
 *
 * Ferma se rezolvă ca în `current_tenant_id()` din baza de date și ca în `proxy.ts`:
 * întâi apartenența activă de operator (cea mai veche), apoi ferma proprie. Niciodată din corpul cererii,
 * din query sau din antete.
 *
 * - proprietar: `isOwner = true`, `access` gol (are voie tot);
 * - operator: `isOwner = false`, `access` = drepturile lui pe module.
 * Rutele de proprietar (echipă, golire, ștergere, acte, integrări) folosesc `getFarmOwnerContext` /
 * `isFarmOwner`; cele pe care le poate face și un operator verifică modulul cu `actorCanWrite`.
 */
export type FarmActor = {
  userId: string
  email: string | null
  tenantId: string
  isOwner: boolean
  access: FarmMemberModuleAccess[]
}

type Admin = ReturnType<typeof getSupabaseAdmin>

export async function resolveFarmActor(
  admin: Admin,
  user: { id: string; email?: string | null },
): Promise<FarmActor | null> {
  const { data: member, error: memberError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('tenant_id, modules_access')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('role', 'operator')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (memberError) throw memberError

  const operator = member as unknown as { tenant_id?: string | null; modules_access?: unknown } | null
  if (operator?.tenant_id) {
    return {
      userId: user.id,
      email: user.email ?? null,
      tenantId: operator.tenant_id,
      isOwner: false,
      access: resolveFarmMemberAccess(operator.modules_access, { legacyFallback: true }),
    }
  }

  const { data: owned, error: ownedError } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (ownedError) throw ownedError
  if (!owned?.id) return null

  return { userId: user.id, email: user.email ?? null, tenantId: owned.id, isOwner: true, access: [] }
}

/** Proprietarul are voie tot; operatorul doar cu „Scrie” pe cel puțin unul dintre module. */
export function actorCanWrite(actor: FarmActor, ...modules: FarmMemberModule[]): boolean {
  if (actor.isOwner) return true
  return actor.access.some((item) => item.level === 'write' && modules.includes(item.module))
}
