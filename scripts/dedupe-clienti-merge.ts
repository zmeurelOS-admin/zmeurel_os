/**
 * dedupe-clienti-merge.ts — FAZA 2 (merge real)
 *
 * Rulează DOAR după ce raportul din Faza 1 (dedupe-clienti-report.ts) a fost
 * verificat manual și confirmat. Pentru fiecare grup din fișierul JSON dat:
 *   1. Re-citește din DB toți membrii grupului (nu are încredere orbește în
 *      snapshot-ul din JSON) și recalculează recordul "principal" (cele mai
 *      multe referințe comenzi+vanzari+vanzari_butasi; la egalitate, cel mai
 *      vechi created_at).
 *   2. Dacă grupul nu mai există / nu mai are >1 membru / vreun id a
 *      dispărut între timp, îl SARE cu un avertisment (nu aplică nimic).
 *   3. Apelează RPC-ul `merge_clienti_duplicates`, care repointează FK-urile
 *      (comenzi, vanzari, vanzari_butasi) către principal și abia apoi șterge
 *      recordul orfan — totul într-o singură tranzacție per grup (funcțiile
 *      plpgsql rulează atomic; orice eroare la mijloc face rollback automat
 *      la tot grupul respectiv). Fiecare merge e logat în
 *      `public.clienti_merge_audit`.
 *
 * Fără flag-ul `--confirm`, scriptul rulează ca simulare (nu apelează RPC-ul,
 * doar arată ce ar face) — a doua plasă de siguranță pe lângă cerința ca
 * Faza 1 să fi fost deja confirmată manual.
 *
 * Run:
 *   npx tsx scripts/dedupe-clienti-merge.ts --input scripts/output/clienti-dedupe-<ts>.json
 *   npx tsx scripts/dedupe-clienti-merge.ts --input <path> --confirm
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'node:fs'

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

type DedupeInputGroup = {
  normalizedPhone: string
  recommendedPrincipalId: string
  caution: string | null
  memberIds: string[]
}

type DedupeInput = {
  tenantId: string
  generatedAt: string
  groups: DedupeInputGroup[]
}

type ClientSnapshot = {
  id: string
  nume_client: string
  telefon: string | null
  created_at: string
}

type RefCounts = {
  comenzi: number
  vanzari: number
  vanzari_butasi: number
}

type MergeRpcRow = {
  orphan_id: string
  comenzi_migrated: number
  vanzari_migrated: number
  vanzari_butasi_migrated: number
}

// `merge_clienti_duplicates` există doar după ce migrația
// 20260705120000_clienti_merge_audit.sql a fost aplicată; până la
// regenerarea `src/types/supabase.ts` (supabase gen types), tipurile
// generate nu îl cunosc — apelăm RPC-ul printr-un cast explicit.
type RpcCaller = (
  fn: 'merge_clienti_duplicates',
  args: {
    p_tenant_id: string
    p_principal_id: string
    p_orphan_ids: string[]
    p_merged_by: string
  },
) => Promise<{ data: MergeRpcRow[] | null; error: { message: string } | null }>

function parseArgs() {
  const args = process.argv.slice(2)
  const inputIdx = args.indexOf('--input')
  const inputPath = inputIdx !== -1 ? args[inputIdx + 1] : null
  const confirm = args.includes('--confirm')

  if (!inputPath) {
    throw new Error(
      'Lipsește --input <cale-catre-json-ul-generat-de-dedupe-clienti-report.ts>',
    )
  }

  return { inputPath, confirm }
}

async function fetchCurrentMembers(
  admin: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  ids: string[],
): Promise<ClientSnapshot[]> {
  const { data, error } = await admin
    .from('clienti')
    .select('id,nume_client,telefon,created_at')
    .eq('tenant_id', tenantId)
    .in('id', ids)

  if (error) {
    throw new Error(`Nu am putut re-citi clienții grupului: ${error.message}`)
  }

  return (data ?? []) as ClientSnapshot[]
}

async function countReferences(
  admin: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  clientId: string,
): Promise<RefCounts> {
  const [comenzi, vanzari, vanzariButasi] = await Promise.all([
    admin
      .from('comenzi')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
    admin
      .from('vanzari')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
    admin
      .from('vanzari_butasi')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId),
  ])

  for (const result of [comenzi, vanzari, vanzariButasi]) {
    if (result.error) {
      throw new Error(`Eroare la numărarea referințelor: ${result.error.message}`)
    }
  }

  return {
    comenzi: comenzi.count ?? 0,
    vanzari: vanzari.count ?? 0,
    vanzari_butasi: vanzariButasi.count ?? 0,
  }
}

function pickPrincipal(members: Array<ClientSnapshot & { totalRefs: number }>): string {
  const sorted = [...members].sort((a, b) => {
    if (b.totalRefs !== a.totalRefs) return b.totalRefs - a.totalRefs
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return sorted[0].id
}

async function main() {
  const { inputPath, confirm } = parseArgs()
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as DedupeInput

  if (!input.tenantId || !Array.isArray(input.groups)) {
    throw new Error('Fișierul de input nu are formatul așteptat (tenantId + groups).')
  }

  console.log(
    confirm
      ? `MERGE REAL — tenant ${input.tenantId}, ${input.groups.length} grupuri din raportul ${inputPath}`
      : `SIMULARE (fără --confirm) — tenant ${input.tenantId}, ${input.groups.length} grupuri din raportul ${inputPath}`,
  )
  console.log('')

  const admin = getSupabaseAdmin()
  let mergedGroups = 0
  let skippedGroups = 0

  for (const group of input.groups) {
    console.log(`Grup telefon=${group.normalizedPhone} (${group.memberIds.length} membri din raport)`)

    const currentMembers = await fetchCurrentMembers(admin, input.tenantId, group.memberIds)

    if (currentMembers.length !== group.memberIds.length) {
      console.warn(
        `  SKIP — ${group.memberIds.length - currentMembers.length} id-uri din raport nu mai există în DB (posibil deja mergeuite/șterse). Rulează Faza 1 din nou pentru a reconfirma acest grup.`,
      )
      skippedGroups += 1
      continue
    }

    if (currentMembers.length < 2) {
      console.warn('  SKIP — grupul nu mai are duplicate (a rămas 1 singur record).')
      skippedGroups += 1
      continue
    }

    const membersWithRefs = await Promise.all(
      currentMembers.map(async (member) => {
        const refs = await countReferences(admin, input.tenantId, member.id)
        return { ...member, refs, totalRefs: refs.comenzi + refs.vanzari + refs.vanzari_butasi }
      }),
    )

    const principalId = pickPrincipal(membersWithRefs)
    const orphanIds = membersWithRefs.filter((m) => m.id !== principalId).map((m) => m.id)

    console.log(`  Principal (recalculat acum): ${principalId}`)
    console.log(`  Orfani de migrat + șters: ${orphanIds.join(', ')}`)

    if (!confirm) {
      console.log('  (simulare — niciun RPC apelat; rerulează cu --confirm pentru a aplica)')
      continue
    }

    const rpcCall = admin.rpc.bind(admin) as unknown as RpcCaller
    const { data: results, error } = await rpcCall('merge_clienti_duplicates', {
      p_tenant_id: input.tenantId,
      p_principal_id: principalId,
      p_orphan_ids: orphanIds,
      p_merged_by: 'dedupe-clienti-merge.ts',
    })

    if (error) {
      console.error(`  EROARE la merge — grupul a fost rollback-uit integral: ${error.message}`)
      skippedGroups += 1
      continue
    }

    for (const row of results ?? []) {
      console.log(
        `  ✔ orfan ${row.orphan_id} migrat: comenzi=${row.comenzi_migrated}, vanzari=${row.vanzari_migrated}, vanzari_butasi=${row.vanzari_butasi_migrated}, apoi șters`,
      )
    }
    mergedGroups += 1
  }

  console.log('')
  console.log(
    confirm
      ? `Gata. Grupuri mergeuite: ${mergedGroups}, sărite: ${skippedGroups}.`
      : `Simulare terminată. Grupuri care ar fi mergeuite: ${input.groups.length - skippedGroups}, sărite: ${skippedGroups}. Rerulează cu --confirm pentru merge real.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
