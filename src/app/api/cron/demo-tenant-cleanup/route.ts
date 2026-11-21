import { NextResponse } from 'next/server'

import { captureApiError } from '@/lib/monitoring/report-error'
import { isProtectedDemoCleanupOwnerUserId } from '@/lib/auth/protected-account'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  DEMO_CLEANUP_MAX_PER_RUN,
  DEMO_CLEANUP_SAMPLE_EMAILS,
  demoCleanupMode,
  numaraProtejate,
  selecteazaDemoDeSters,
  semneFermaReala,
  type DemoDeSters,
} from '@/lib/tenant/demo-cleanup'
import {
  citesteEmailuri,
  citesteProtectii,
  citesteStareaFermei,
  citesteTenanti,
  listeazaBonuri,
  stergeFermaDemo,
} from '@/lib/tenant/demo-cleanup-server'

export const runtime = 'nodejs'

const ROUTE = '/api/cron/demo-tenant-cleanup'

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
  return headerSecret === expected || bearerSecret === expected
}

type SemnGasit = { tenantId: string; email: string; semne: string[] }

class FermaRealaError extends Error {
  constructor(readonly semn: SemnGasit) {
    super(`Semn de fermă reală la ${semn.tenantId}: ${semn.semne.join('; ')}`)
    this.name = 'FermaRealaError'
  }
}

/**
 * Reverifică o fermă; întoarce semnele de fermă reală (gol = se poate șterge) și operatorii din link legați doar de ea,
 * sau `null` dacă ferma nu mai există.
 */
async function reverifica(
  admin: ReturnType<typeof createServiceRoleClient>,
  candidat: DemoDeSters,
): Promise<{ semne: string[]; operatoriAscunsi: string[] } | null> {
  const stare = await citesteStareaFermei(admin, candidat, isProtectedDemoCleanupOwnerUserId)
  if (!stare.tenant) return null
  return { semne: semneFermaReala(candidat, stare, new Date()), operatoriAscunsi: stare.operatoriAscunsi ?? [] }
}

/**
 * Curățarea nocturnă a demo-urilor (04:00 UTC).
 * Implicit doar numără (`mod: "proba"`); șterge efectiv numai cu `DEMO_CLEANUP_MODE=sterge`.
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mod = demoCleanupMode()
  const admin = createServiceRoleClient()

  try {
    const [tenanti, emailuri, protectii] = await Promise.all([
      citesteTenanti(admin),
      citesteEmailuri(admin),
      citesteProtectii(admin),
    ])
    const selectie = selecteazaDemoDeSters(tenanti, emailuri, new Date(), {
      ...protectii,
      esteProprietarProtejat: isProtectedDemoCleanupOwnerUserId,
    })
    const lot = selectie.deSters.slice(0, DEMO_CLEANUP_MAX_PER_RUN)
    const comun = {
      fermeDeSters: selectie.deSters.length,
      fermeInRulare: lot.length,
      limitaPeRulare: DEMO_CLEANUP_MAX_PER_RUN,
      protejate: numaraProtejate(selectie.protejate),
    }

    if (mod === 'proba') {
      let fisiereBonuri = 0
      for (const candidat of selectie.deSters) {
        fisiereBonuri += (await listeazaBonuri(admin, candidat.tenantId)).length
      }
      const semneFermaRealaGasite: SemnGasit[] = []
      let operatoriAscunsi = 0
      for (const candidat of lot) {
        const verificare = await reverifica(admin, candidat)
        if (!verificare) continue
        operatoriAscunsi += verificare.operatoriAscunsi.length
        if (verificare.semne.length > 0) {
          semneFermaRealaGasite.push({ tenantId: candidat.tenantId, email: candidat.email, semne: verificare.semne })
        }
      }
      const payload = {
        ok: true,
        mod: 'proba' as const,
        ...comun,
        fisiereBonuri,
        operatoriAscunsi,
        emailuriExemplu: selectie.deSters.slice(0, DEMO_CLEANUP_SAMPLE_EMAILS).map((candidat) => candidat.email),
        semneFermaReala: semneFermaRealaGasite,
      }
      console.info('[demo-tenant-cleanup] proba', JSON.stringify(payload))
      return NextResponse.json(payload)
    }

    // Mod `sterge`. Întâi reverificăm tot lotul: un singur semn de fermă reală oprește rularea înainte de orice ștergere.
    for (const candidat of lot) {
      const verificare = await reverifica(admin, candidat)
      if (verificare && verificare.semne.length > 0) {
        throw new FermaRealaError({ tenantId: candidat.tenantId, email: candidat.email, semne: verificare.semne })
      }
    }

    let fermeSterse = 0
    let utilizatoriStersi = 0
    let operatoriStersi = 0
    let fisiereSterse = 0
    const erori: string[] = []

    for (const candidat of lot) {
      // Reverificăm chiar înainte de ștergere (emailul proprietarului, membrii, magazinul…).
      const verificare = await reverifica(admin, candidat)
      if (verificare === null) continue
      const { semne } = verificare
      if (semne.length > 0) {
        const error = new FermaRealaError({ tenantId: candidat.tenantId, email: candidat.email, semne })
        captureApiError(error, { route: ROUTE, tenantId: candidat.tenantId, tags: { mod } })
        return NextResponse.json(
          {
            ok: false,
            mod,
            oprit: true,
            error: error.message,
            fermeSterse,
            utilizatoriStersi,
            fisiereSterse,
            ...(erori.length > 0 ? { erori } : {}),
          },
          { status: 500 },
        )
      }

      try {
        const rezultat = await stergeFermaDemo(admin, candidat, verificare.operatoriAscunsi)
        fermeSterse += 1
        fisiereSterse += rezultat.fisiere
        operatoriStersi += rezultat.operatoriStersi
        if (rezultat.utilizatorSters) utilizatoriStersi += 1
        if (rezultat.avertismente.length > 0) {
          const message = `tenant ${candidat.tenantId}: ${rezultat.avertismente.join('; ')}`
          erori.push(message)
          captureApiError(new Error(message), { route: ROUTE, tenantId: candidat.tenantId, tags: { mod } })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        erori.push(`tenant ${candidat.tenantId}: ${message}`)
        captureApiError(error, { route: ROUTE, tenantId: candidat.tenantId, tags: { mod } })
      }
    }

    const payload = {
      ok: true,
      mod: 'sterge' as const,
      ...comun,
      fermeSterse,
      utilizatoriStersi,
      operatoriStersi,
      fisiereSterse,
      ramasePentruUrmatoareaRulare: Math.max(0, selectie.deSters.length - lot.length),
      ...(erori.length > 0 ? { erori } : {}),
    }
    console.info('[demo-tenant-cleanup] sterge', JSON.stringify(payload))
    return NextResponse.json(payload)
  } catch (error) {
    captureApiError(error, { route: ROUTE, tags: { mod } })
    if (error instanceof FermaRealaError) {
      return NextResponse.json(
        { ok: false, mod, oprit: true, error: error.message, fermeSterse: 0 },
        { status: 500 },
      )
    }
    return NextResponse.json(
      { ok: false, mod, error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 },
    )
  }
}
