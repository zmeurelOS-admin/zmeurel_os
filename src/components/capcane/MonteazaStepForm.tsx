'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'

import {
  Button,
  CalendarPanel,
  FilterPills,
  Notice,
  NumberStepper,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  addDaysIso,
  kitText,
  useStepForm,
} from '@/components/kit'
import { ETICHETA_TIP_CAPCANA, TIPURI_CAPCANA, capcaneText, numeTipBucati, type TipCapcana } from '@/lib/capcane'
import { queryKeys } from '@/lib/query-keys'
import { monteazaCapcane } from '@/lib/supabase/queries/capcane'
import { ZiCuDataRo, zileText } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { emojiTip } from './IconitaTip'
import { PozaRand, type PozaAleasa } from './PozaRand'

const STEPS = ['tip', 'parcele', 'detalii'] as const
const INTERVALE = [3, 4, 7, 10, 14] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

type Vedere = null | 'data' | 'renunta'

export interface MonteazaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayIso: string
  parcele: ReadonlyArray<{ id: string; nume: string }>
  parcelaInitiala?: string | null
}

/**
 * „+ Montează”: tipul (4 plăci), parcelele (mai multe → un grup pe fiecare), bucățile, „Verific la N zile”, data și,
 * opțional, o poză. Salvarea trimite cheia formularului (`client_sync_id`, câte una derivată pe fiecare grup).
 */
export function MonteazaStepForm({ open, onOpenChange, todayIso, parcele, parcelaInitiala = null }: MonteazaStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: { moduleName: 'capcane' } })

  const [tip, setTip] = useState<TipCapcana | null>(null)
  const [parcelaIds, setParcelaIds] = useState<string[]>([])
  const [bucati, setBucati] = useState<number | null>(3)
  const [interval, setIntervalZile] = useState<number>(7)
  const [data, setData] = useState(todayIso)
  const [poza, setPoza] = useState<PozaAleasa>(null)
  const [vedere, setVedere] = useState<Vedere>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ titlu: string; detaliu: string } | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setTip(null)
    setParcelaIds(parcelaInitiala ? [parcelaInitiala] : parcele.length === 1 ? [parcele[0].id] : [])
    setBucati(3)
    setIntervalZile(7)
    setData(todayIso)
    setPoza(null)
    setVedere(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const canSave = Boolean(tip) && parcelaIds.length > 0 && (bucati ?? 0) >= 1 && !saving

  const save = async () => {
    if (!canSave || !tip || !bucati) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      const rezultat = await monteazaCapcane({
        clientSyncId: key,
        parcelaIds,
        tip,
        nrBucati: bucati,
        intervalVerificareZile: interval,
        dataMontare: data,
        observatii: null,
        poza: poza?.blob ?? null,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.capcane })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      const numeParcele = parcele.filter((p) => parcelaIds.includes(p.id)).map((p) => p.nume)
      setSaved({
        titlu: rezultat.grupuri === 1 ? 'Capcane montate' : `${rezultat.grupuri} grupuri montate`,
        detaliu: `${numeParcele.join(', ')} · ${bucati} ${numeTipBucati(tip, bucati)} pe parcelă. Verifici la ${zileText(interval)}.${rezultat.pozaSalvata ? '' : ' Poza nu s-a putut salva.'}`,
      })
      form.markSuccess({ tip, grupuri: rezultat.grupuri, bucati, interval })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      const message = error instanceof Error ? error.message : ''
      setSaveError(NETWORK_ERROR.test(message) ? 'Nu există conexiune la internet. Când revine, apasă din nou „Montează”: nu se dublează.' : message || 'Nu s-a salvat.')
      form.markFailed()
    }
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!tip) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere) {
      setVedere(null)
      return true
    }
    return false
  }

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  let footer: React.ComponentProps<typeof StepForm>['footer'] = null

  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la montare?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Ce ai ales nu a fost salvat.</p>
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
  } else if (vedere === 'data') {
    stepLabel = 'Data'
    content = (
      <div className="space-y-4">
        <StepFormTitle>Când le-ai montat?</StepFormTitle>
        <CalendarPanel
          value={data}
          onChange={(iso) => {
            setData(iso)
            setVedere(null)
          }}
          max={todayIso}
          shortcuts={[
            { label: 'Azi', value: todayIso },
            { label: 'Ieri', value: addDaysIso(todayIso, -1) },
            { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
          ]}
        />
      </div>
    )
  } else if (form.stepKey === 'tip') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Ce capcane montezi?</StepFormTitle>
        <TileGroup
          type="single"
          aria-label="Tipul capcanei"
          value={tip}
          onValueChange={(value) => {
            if (!value) return
            setTip(value as TipCapcana)
            form.next()
          }}
        >
          {TIPURI_CAPCANA.map((value) => (
            <Tile
              key={value}
              value={value}
              leading={<span aria-hidden>{emojiTip(value)}</span>}
              title={ETICHETA_TIP_CAPCANA[value]}
              subtitle={value === 'drosophila' ? 'atractant schimbat la 7 zile' : undefined}
            />
          ))}
        </TileGroup>
      </div>
    )
  } else if (form.stepKey === 'parcele') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Pe ce parcele?</StepFormTitle>
        {parcele.length > 0 ? (
          <FilterPills
            multiple
            wrap
            aria-label="Parcelele"
            options={parcele.map((parcela) => ({ value: parcela.id, label: parcela.nume }))}
            value={parcelaIds}
            onValueChange={setParcelaIds}
          />
        ) : (
          <Notice tone="info" title="Nicio parcelă">
            Adaugă întâi parcelele fermei, din Parcele.
          </Notice>
        )}
        <p className={cn('text-fg-muted', kitText.secondary)}>Mai multe parcele deodată: aplicația face câte un grup pe fiecare.</p>
      </div>
    )
    footer = { primary: { label: 'Continuă', onClick: form.next, disabled: parcelaIds.length === 0 } }
  } else {
    content = (
      <div className="space-y-4">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <StepFormTitle>Câte și cât de des?</StepFormTitle>
        <div className="space-y-2">
          <p className={cn('px-1 font-semibold text-fg', kitText.secondary)}>Bucăți pe parcelă</p>
          <NumberStepper label="Bucăți pe parcelă" value={bucati} onChange={setBucati} min={1} max={50} unit="buc" size="compact" />
        </div>
        <div className="space-y-2">
          <p className={cn('px-1 font-semibold text-fg', kitText.secondary)}>Verific la</p>
          <FilterPills
            wrap
            aria-label="Verific la câte zile"
            options={INTERVALE.map((n) => ({ value: String(n), label: zileText(n) }))}
            value={String(interval)}
            onValueChange={(value) => setIntervalZile(Number(value) || 7)}
          />
          {interval < 7 ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>În plin sezon, de două ori pe săptămână e bine.</p> : null}
        </div>
        <Button type="button" variant="neutral" size="touch" className="w-full justify-start px-3" onClick={() => setVedere('data')} aria-label={`Montate pe ${ZiCuDataRo(data)}. Schimbă`}>
          <CalendarDays aria-hidden />
          Montate: {data === todayIso ? 'azi' : ZiCuDataRo(data)}
        </Button>
        <PozaRand poza={poza} onChange={setPoza} disabled={saving} />
      </div>
    )
    const total = (bucati ?? 0) * parcelaIds.length
    footer = {
      primary: {
        label: saving ? 'Se salvează…' : total > 0 ? `Montează · ${capcaneText(total)}` : 'Montează',
        onClick: () => void save(),
        loading: saving,
        disabled: !canSave,
      },
    }
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Montează capcane"
      description="Tipul, parcelele, câte bucăți și la câte zile le verifici."
      stepLabel={stepLabel}
      onBack={handleBack}
      footer={footer}
      success={saved ? <SuccessScreen title={saved.titlu} description={saved.detaliu} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
