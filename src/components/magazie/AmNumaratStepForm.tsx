'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Package } from 'lucide-react'

import {
  Button,
  KgField,
  ListRow,
  Notice,
  NumericKeypad,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { AlegeProdus, ProdusNou } from '@/components/tratamente/AlegeProdus'
import { formatCantitateStoc, UNITATI_STOC, type UnitateStoc } from '@/lib/magazie/unitati'
import { queryKeys } from '@/lib/query-keys'
import { corectieDinNumarare, inregistreazaNumarare, type StocMagazie } from '@/lib/supabase/queries/magazie'
import { creeazaProdusFerma, type TipProdusNou } from '@/lib/supabase/queries/tratamente'
import type { ProdusCatalog } from '@/lib/tratamente/model'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

const STEPS = ['produs', 'cantitate'] as const
const FIELDS = ['real'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

type Vedere = null | 'catalog' | 'produs-nou' | 'renunta'
type Ales = { id: string; nume: string; tip: string | null }

export interface AmNumaratStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayIso: string
  catalog: readonly ProdusCatalog[]
  stoc: readonly StocMagazie[]
  produsInitial?: string | null
}

/**
 * „Am numărat”: produsul și cât ai de fapt. Se salvează o corecție egală cu diferența față de magazie
 * (pentru un produs nou în magazie, toată cantitatea). Așa pornește și stocul unui produs.
 */
export function AmNumaratStepForm({ open, onOpenChange, todayIso, catalog, stoc, produsInitial = null }: AmNumaratStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, initialStep: produsInitial ? 'cantitate' : undefined, analytics: { moduleName: 'magazie' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 6 })
  const stocPeProdus = useMemo(() => new Map(stoc.map((rand) => [rand.produs_id, rand])), [stoc])
  const catalogPeId = useMemo(() => new Map(catalog.map((produs) => [produs.id, produs])), [catalog])

  const [ales, setAles] = useState<Ales | null>(null)
  const [unitate, setUnitate] = useState<UnitateStoc>('kg')
  const [vedere, setVedere] = useState<Vedere>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ titlu: string; detaliu: string } | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    fields.reset()
    const dinStoc = produsInitial ? stocPeProdus.get(produsInitial) : undefined
    const dinCatalog = produsInitial ? catalogPeId.get(produsInitial) : undefined
    setAles(dinStoc ? { id: dinStoc.produs_id, nume: dinStoc.nume, tip: dinStoc.tip } : dinCatalog ? { id: dinCatalog.id, nume: dinCatalog.nume_comercial, tip: dinCatalog.tip } : null)
    setUnitate(dinStoc?.unitate ?? 'kg')
    setVedere(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const rand = ales ? stocPeProdus.get(ales.id) : undefined
  const unitateEfectiva = rand?.unitate ?? unitate
  const stocCurent = rand?.stoc ?? 0
  const real = fields.numbers.real
  const corectie = real === null ? null : corectieDinNumarare(real, stocCurent)
  const canSave = Boolean(ales) && real !== null && real >= 0 && !saving

  const alege = (produs: Ales) => {
    setAles(produs)
    setUnitate(stocPeProdus.get(produs.id)?.unitate ?? (['fungicid', 'insecticid', 'acaricid', 'erbicid', 'bioregulator', 'foliar'].includes(produs.tip ?? '') ? 'l' : 'kg'))
    setVedere(null)
    if (form.stepKey === 'produs') form.next()
  }

  const salveazaProdusNou = async (input: { nume: string; tip: TipProdusNou; phiZile: number | null }) => {
    try {
      const nou = await creeazaProdusFerma(input)
      void queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
      alege({ id: nou.id, nume: nou.nume_comercial, tip: nou.tip })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Produsul nu s-a salvat.'
    }
  }

  const save = async () => {
    if (!canSave || !ales || real === null) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      const facut = await inregistreazaNumarare({ clientSyncId: key, produsId: ales.id, unitate: unitateEfectiva, cantitateReala: real, stocCurent, data: todayIso })
      void queryClient.invalidateQueries({ queryKey: queryKeys.magazie })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaved({
        titlu: facut === 0 ? 'Era corect' : 'Corectat',
        detaliu:
          facut === 0
            ? `${ales.nume}: ${formatCantitateStoc(real, unitateEfectiva)}, cât arăta și magazia.`
            : `${ales.nume}: ${formatCantitateStoc(real, unitateEfectiva)} · corecție ${formatCantitateStoc(facut, unitateEfectiva, true)}`,
      })
      form.markSuccess({ corectie: facut })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      const message = error instanceof Error ? error.message : ''
      setSaveError(NETWORK_ERROR.test(message) ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: nu se dublează.' : message || 'Nu s-a salvat.')
      form.markFailed()
    }
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (real === null) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere === 'produs-nou') {
      setVedere('catalog')
      return true
    }
    if (vedere) {
      setVedere(null)
      return true
    }
    return false
  }

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la numărătoare?</StepFormTitle>
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
  } else if (vedere === 'catalog') {
    stepLabel = 'Din catalog'
    content = (
      <AlegeProdus
        catalog={catalog}
        recente={[]}
        doarZmeur={false}
        dejaAlese={new Set(stoc.map((item) => item.nume))}
        onAlege={(produs) => produs && alege({ id: produs.id, nume: produs.nume_comercial, tip: produs.tip })}
        onProdusNou={() => setVedere('produs-nou')}
      />
    )
  } else if (vedere === 'produs-nou') {
    stepLabel = 'Produs nou'
    content = <ProdusNou tipImplicit="ingrasamant" onSalveaza={salveazaProdusNou} />
  } else if (form.stepKey === 'produs') {
    content = (
      <div className="space-y-3">
        <StepFormTitle>Ce ai numărat?</StepFormTitle>
        {stoc.length > 0 ? (
          <ul className="space-y-2">
            {stoc.map((item) => (
              <li key={item.produs_id}>
                <ListRow
                  avatar={false}
                  title={item.nume}
                  detail={`În magazie: ${formatCantitateStoc(item.stoc, item.unitate)}`}
                  onClick={() => alege({ id: item.produs_id, nume: item.nume, tip: item.tip })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-fg-muted', kitText.secondary)}>Magazia e goală. Alege produsul din catalog și scrie cât ai.</p>
        )}
        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setVedere('catalog')}>
          Alt produs, din catalog
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="space-y-3">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <Button type="button" variant="neutral" size="touch" className="w-full min-w-0 justify-start px-3" onClick={() => form.goTo('produs')} aria-label={ales ? `Produs: ${ales.nume}. Schimbă` : 'Alege produsul'}>
          <Package aria-hidden />
          <span className="truncate">{ales?.nume ?? 'Alege produsul'}</span>
        </Button>
        {rand ? (
          <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Magazia arată {formatCantitateStoc(rand.stoc, rand.unitate)}.</p>
        ) : (
          <Segments aria-label="Unitatea" options={UNITATI_STOC.map((value) => ({ value, label: value === 'buc' ? 'bucăți' : value }))} value={unitate} onValueChange={setUnitate} />
        )}
        <KgField label="Cât ai de fapt" unit={unitateEfectiva} value={fields.values.real} active onActivate={() => undefined} />
        {corectie !== null && corectie !== 0 ? (
          <p className={cn('text-center font-semibold text-fg-muted', kitText.secondary)}>Corecție {formatCantitateStoc(corectie, unitateEfectiva, true)}</p>
        ) : null}
      </div>
    )
  }

  const showKeypad = form.stepKey === 'cantitate' && vedere === null

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Am numărat"
      description="Scrii cât ai de fapt; diferența apare ca rând „corecție”."
      stepLabel={stepLabel}
      onBack={handleBack}
      dock={showKeypad ? <NumericKeypad onKey={fields.press} disabled={saving} aria-label="Tastatură pentru cantitate" /> : undefined}
      footer={
        showKeypad
          ? {
              primary: {
                label: saving ? 'Se salvează…' : corectie !== null && corectie !== 0 ? `Salvează · ${formatCantitateStoc(corectie, unitateEfectiva, true)}` : 'Salvează',
                onClick: () => void save(),
                loading: saving,
                disabled: !canSave,
              },
            }
          : null
      }
      success={saved ? <SuccessScreen title={saved.titlu} description={saved.detaliu} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
