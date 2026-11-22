/**
 * Proba curățării demo-urilor, rulată local, DOAR CITIRE (promptul 25, partea 1).
 *
 * Face exact selecția modului `proba` din `/api/cron/demo-tenant-cleanup`: `selecteazaDemoDeSters` pe toate fermele,
 * apoi reverificarea (`citesteStareaFermei` + `semneFermaReala`) pe primul lot. Nu apelează ruta de cron și nu scrie
 * nimic: doar `select`, `listUsers` și `getUserById`.
 *
 * Pentru fiecare semn de fermă reală tipărește și detaliile (cine e în `profiles` / `farm_members`, cu emailul
 * mascat și starea), ca să se vadă dacă semnul e real sau fals.
 *
 * Rulare (cu `SUPABASE_SERVICE_ROLE_KEY` și `NEXT_PUBLIC_SUPABASE_URL` în `.env.local`):
 *   JITI_ALIAS='{"@":"<calea repo-ului>/src"}' node --env-file=.env.local node_modules/jiti/lib/jiti-cli.mjs scripts/demo-cleanup-proba.ts [--tot]
 *   (`JITI_ALIAS` e necesar: jiti nu citește aliasul `@/` din tsconfig)
 *   (`--tot` reverifică toți candidații, nu doar primul lot de 50)
 */
import { isProtectedDemoCleanupOwnerUserId } from '../src/lib/auth/protected-account'
import { isHiddenOperatorEmail } from '../src/lib/farm-members/operator-link'
import { createServiceRoleClient } from '../src/lib/supabase/admin'
import {
  DEMO_CLEANUP_MAX_PER_RUN,
  numaraProtejate,
  selecteazaDemoDeSters,
  semneFermaReala,
} from '../src/lib/tenant/demo-cleanup'
import {
  citesteEmailuri,
  citesteProtectii,
  citesteStareaFermei,
  citesteTenanti,
} from '../src/lib/tenant/demo-cleanup-server'

function mascheaza(email: string | null | undefined): string {
  if (!email) return '(fără email)'
  const [local, domeniu] = email.split('@')
  if (!domeniu) return '***'
  return `${local.slice(0, 3)}***@${domeniu}`
}

async function main() {
  const tot = process.argv.includes('--tot')
  const admin = createServiceRoleClient()
  const [tenanti, emailuri, protectii] = await Promise.all([
    citesteTenanti(admin),
    citesteEmailuri(admin),
    citesteProtectii(admin),
  ])
  const acum = new Date()
  const selectie = selecteazaDemoDeSters(tenanti, emailuri, acum, {
    ...protectii,
    esteProprietarProtejat: isProtectedDemoCleanupOwnerUserId,
  })
  const lot = tot ? selectie.deSters : selectie.deSters.slice(0, DEMO_CLEANUP_MAX_PER_RUN)

  const semne: Array<Record<string, unknown>> = []
  let disparute = 0
  for (const candidat of lot) {
    const stare = await citesteStareaFermei(admin, candidat, isProtectedDemoCleanupOwnerUserId)
    if (!stare.tenant) {
      disparute += 1
      continue
    }
    const gasite = semneFermaReala(candidat, stare, acum)
    if (gasite.length === 0) continue

    const { data: membri } = await admin
      .from('farm_members')
      .select('user_id, role, is_active, created_at, invite_used_at')
      .eq('tenant_id', candidat.tenantId)
    const detaliiMembri = []
    for (const membru of membri ?? []) {
      if (!membru.user_id || membru.user_id === candidat.ownerUserId) continue
      const { data } = await admin.auth.admin.getUserById(membru.user_id)
      const email = data?.user?.email ?? null
      const [altundeva, ferme] = await Promise.all([
        admin.from('farm_members').select('tenant_id').eq('user_id', membru.user_id).neq('tenant_id', candidat.tenantId),
        admin.from('tenants').select('id').eq('owner_user_id', membru.user_id),
      ])
      detaliiMembri.push({
        email: mascheaza(email),
        operatorAscuns: isHiddenOperatorEmail(email),
        rol: membru.role,
        activ: membru.is_active,
        inAlteFerme: (altundeva.data ?? []).length,
        detineFerme: (ferme.data ?? []).length,
      })
    }
    const altiInProfiles = []
    for (const id of stare.profileIds) {
      if (id === candidat.ownerUserId) continue
      const { data } = await admin.auth.admin.getUserById(id)
      altiInProfiles.push({ email: mascheaza(data?.user?.email), operatorAscuns: isHiddenOperatorEmail(data?.user?.email) })
    }

    semne.push({
      tenantId: candidat.tenantId,
      email: candidat.email,
      creat: candidat.createdAt,
      semne: gasite,
      membri: detaliiMembri,
      altiInProfiles,
      operatoriAscunsiRecunoscuti: (stare.operatoriAscunsi ?? []).length,
      comenziMagazin: stare.comenziMagazin,
      legaturiMagazin: stare.legaturiMagazin,
      oferteAsociatie: stare.oferteAsociatie,
    })
  }

  const rezultat = {
    mod: 'proba-locala',
    acum: acum.toISOString(),
    totalFerme: tenanti.length,
    fermeDeSters: selectie.deSters.length,
    reverificate: lot.length,
    disparuteIntreTimp: disparute,
    protejate: numaraProtejate(selectie.protejate),
    celMaiVechiDemo: selectie.deSters[0]?.createdAt ?? null,
    celMaiNouDemo: selectie.deSters.at(-1)?.createdAt ?? null,
    candidatiCuSemne: semne.length,
    semneFermaReala: semne,
  }
  console.log(JSON.stringify(rezultat, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
