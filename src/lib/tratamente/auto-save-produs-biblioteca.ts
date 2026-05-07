'use client'

import { listProduseFitosanitareAction, saveProdusFitosanitarInLibraryAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'
import { fuzzyMatchProdus } from '@/lib/tratamente/import/fuzzy-match'
import type { InsertTenantProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

export interface AutoSaveProdusDraft {
  produs_id?: string | null
  produs_nume_manual?: string | null
  substanta_activa_snapshot?: string | null
  tip_snapshot?: string | null
  frac_irac_snapshot?: string | null
  phi_zile_snapshot?: number | null
}

function mapLibraryTip(tipSnapshot: string | null | undefined): InsertTenantProdus['tip'] {
  if (
    tipSnapshot === 'fungicid' ||
    tipSnapshot === 'insecticid' ||
    tipSnapshot === 'erbicid' ||
    tipSnapshot === 'acaricid'
  ) {
    return tipSnapshot
  }
  if (tipSnapshot === 'ingrasamant') return 'ingrasamant'
  if (tipSnapshot === 'bioregulator' || tipSnapshot === 'biostimulator') return 'bioregulator'
  if (tipSnapshot === 'foliar') return 'foliar'
  return 'altul'
}

function isPotentialFitosanitar(tipSnapshot: string | null | undefined): boolean {
  return (
    tipSnapshot === 'fungicid' ||
    tipSnapshot === 'insecticid' ||
    tipSnapshot === 'erbicid' ||
    tipSnapshot === 'acaricid'
  )
}

async function askAssociationDecision(
  manualName: string,
  matchName: string
): Promise<'associate' | 'create'> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (decision: 'associate' | 'create') => {
      if (settled) return
      settled = true
      resolve(decision)
    }

    const timeout = setTimeout(() => finish('create'), 8000)

    toast.message(
      `${manualName} seamănă cu ${matchName} din bibliotecă. Asociezi intervențiile viitoare cu produsul existent?`,
      {
        duration: 8000,
        action: {
          label: 'Da, asociază',
          onClick: () => {
            clearTimeout(timeout)
            finish('associate')
          },
        },
        cancel: {
          label: 'Nu, creează nou',
          onClick: () => {
            clearTimeout(timeout)
            finish('create')
          },
        },
      }
    )
  })
}

function isUniqueConflict(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const normalized = message.toLowerCase()
  return normalized.includes('duplicate key') || normalized.includes('23505')
}

export async function autoSaveProdusInBiblioteca(
  produse: AutoSaveProdusDraft[],
  tenantId: string
): Promise<void> {
  if (!tenantId) return

  let library: ProdusFitosanitar[] = []
  try {
    library = await listProduseFitosanitareAction()
  } catch (error) {
    console.error('[auto-save-produs-biblioteca] listare bibliotecă eșuată', error)
    return
  }

  for (const produs of produse) {
    const manualName = (produs.produs_nume_manual ?? '').trim()
    if (!manualName || produs.produs_id) continue

    try {
      const scopeLibrary = library.filter(
        (item) => item.tenant_id === tenantId || item.tenant_id === null
      )
      const match = fuzzyMatchProdus(manualName, scopeLibrary)

      let shouldCreate = true
      if (match.tip === 'exact') {
        const decision = await askAssociationDecision(manualName, match.produs_nume)
        shouldCreate = decision === 'create'
      } else if (match.tip === 'fuzzy' && match.sugestii[0]) {
        const decision = await askAssociationDecision(manualName, match.sugestii[0].produs_nume)
        shouldCreate = decision === 'create'
      }

      if (!shouldCreate) continue

      const tip = mapLibraryTip(produs.tip_snapshot)
      const substantaActiva = isPotentialFitosanitar(produs.tip_snapshot)
        ? (produs.substanta_activa_snapshot ?? '').trim()
        : ''

      const payload: InsertTenantProdus = {
        nume_comercial: manualName,
        substanta_activa: substantaActiva,
        tip,
        frac_irac: isPotentialFitosanitar(produs.tip_snapshot)
          ? (produs.frac_irac_snapshot ?? '').trim() || null
          : null,
        phi_zile: isPotentialFitosanitar(produs.tip_snapshot)
          ? produs.phi_zile_snapshot ?? null
          : null,
        activ: true,
      }

      const created = await saveProdusFitosanitarInLibraryAction(payload)
      library = [...library, created]

      toast.success(`${manualName} adăugat în biblioteca ta de produse.`)
    } catch (error) {
      if (isUniqueConflict(error)) {
        continue
      }
      console.error('[auto-save-produs-biblioteca] salvare produs eșuată', {
        produs: manualName,
        error,
      })
    }
  }
}
