'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button, Notice, StepForm, StepFormTitle, kitText, useStepForm } from '@/components/kit'
import { AlegeProdus, ProdusNou } from '@/components/tratamente/AlegeProdus'
import { ceLipsesteLinie, linieNouaDin, type LinieNoua, type LiniePlan } from '@/lib/plan'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'
import { queryKeys } from '@/lib/query-keys'
import { salveazaLinie } from '@/lib/supabase/queries/plan'
import { creeazaProdusFerma, type TipProdusNou } from '@/lib/supabase/queries/tratamente'
import type { ProdusCatalog } from '@/lib/tratamente/model'
import { toast } from '@/lib/ui/toast'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { LinieEditor } from './LinieEditor'

const STEPS = ['linie'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

export interface LinieStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  culturaTip: string
  stadii: readonly StadiuCod[]
  /** `null` = linie nouă. */
  linie: LiniePlan | null
  /** Stadiul propus pentru o linie nouă. */
  stadiuInitial: StadiuCod
  ordineNoua: number
  catalog: readonly ProdusCatalog[]
}

/**
 * „+ Linie” și editarea unei linii din „Planul întreg”: stadiul, metoda, produsele cu doza, scopul, repetarea.
 * O linie nouă primește ca id cheia formularului (reîncercarea nu o dublează); una existentă se modifică pe loc,
 * ca aplicările deja făcute din ea să rămână legate.
 */
export function LinieStepForm({ open, onOpenChange, planId, culturaTip, stadii, linie, stadiuInitial, ordineNoua, catalog }: LinieStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, mode: linie ? 'edit' : 'create', analytics: linie ? false : { moduleName: 'plan_tratament' } })
  const [valoare, setValoare] = useState<LinieNoua>({ stadiu: stadiuInitial, cohort: null, scop: null, metoda: 'foliar', repetare: null, produse: [] })
  const [vedere, setVedere] = useState<null | 'produs' | 'produs-nou' | 'renunta'>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setValoare(linie ? linieNouaDin(linie) : { stadiu: stadiuInitial, cohort: null, scop: null, metoda: 'foliar', repetare: null, produse: [] })
    setVedere(null)
    setSaving(false)
    setSaveError(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const lipsa = ceLipsesteLinie(valoare)

  const save = async () => {
    if (saving || lipsa) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      await salveazaLinie({ planId, linieId: linie?.id ?? key, nou: !linie, ordine: linie?.ordine ?? ordineNoua, linie: valoare })
      await queryClient.invalidateQueries({ queryKey: queryKeys.plan })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      form.markSuccess({ produse: valoare.produse.length })
      toast.success(linie ? 'Linia s-a salvat.' : 'Linia s-a adăugat în plan.')
      onOpenChange(false)
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      const message = error instanceof Error ? error.message : ''
      setSaving(false)
      setSaveError(NETWORK_ERROR.test(message) ? 'Nu există conexiune la internet. Când revine, apasă din nou: linia nu se dublează.' : message || 'Linia nu s-a salvat.')
      form.markFailed()
    }
  }

  const adaugaProdus = (produs: ProdusCatalog | null, numeManual?: string) => {
    setValoare((previous) => ({
      ...previous,
      produse: [
        ...previous.produse,
        { produs_id: produs?.id ?? null, nume: produs?.nume_comercial ?? numeManual ?? 'Produs', tip: produs?.tip ?? null, phi: produs?.phi_zile ?? null, doza_ml_per_hl: null, doza_l_per_ha: null, cantitate_text: null },
      ],
    }))
    setVedere(null)
  }

  const salveazaProdusNou = async (input: { nume: string; tip: TipProdusNou; phiZile: number | null }) => {
    try {
      const produs = await creeazaProdusFerma(input)
      void queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
      adaugaProdus(produs)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Produsul nu s-a salvat.'
    }
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (saving) return true
    if (vedere === 'renunta') return false
    const dirty = linie ? JSON.stringify(linieNouaDin(linie)) !== JSON.stringify(valoare) : valoare.produse.length > 0
    if (!dirty) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere === 'produs-nou') {
      setVedere('produs')
      return true
    }
    if (vedere) {
      setVedere(null)
      return true
    }
    return false
  }

  let content: React.ReactNode
  let stepLabel: string | undefined = linie ? 'Linia' : 'Linie nouă'
  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la schimbări?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Linia rămâne cum era.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'produs') {
    stepLabel = 'Adaugă produs'
    content = (
      <AlegeProdus
        catalog={catalog}
        recente={[]}
        doarZmeur={culturaTip === 'zmeur'}
        dejaAlese={new Set(valoare.produse.map((p) => p.nume))}
        onAlege={adaugaProdus}
        onProdusNou={() => setVedere('produs-nou')}
      />
    )
  } else if (vedere === 'produs-nou') {
    stepLabel = 'Produs nou'
    content = <ProdusNou tipImplicit={valoare.metoda === 'fertirigare' ? 'ingrasamant' : 'fungicid'} onSalveaza={salveazaProdusNou} />
  } else {
    content = (
      <div className="space-y-4">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <LinieEditor linie={valoare} onChange={setValoare} stadii={stadii} culturaTip={culturaTip} onAlegeProdus={() => setVedere('produs')} />
        {lipsa ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>{lipsa}</p> : null}
      </div>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={linie ? 'Linia din plan' : 'Linie nouă'}
      description="Stadiul, produsele cu doza, scopul și repetarea."
      stepLabel={stepLabel}
      onBack={handleBack}
      footer={vedere === null ? { primary: { label: saving ? 'Se salvează…' : 'Salvează linia', onClick: () => void save(), loading: saving, disabled: saving || lipsa !== null } } : null}
    >
      {content}
    </StepForm>
  )
}
