'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { buildHarvestObservatii, getParcelaCropRows } from '@/lib/parcele/crop-config'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { queryKeys } from '@/lib/query-keys'
import { calculatePauseStatus, getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { createRecoltare } from '@/lib/supabase/queries/recoltari'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

const LAST_PARCELA_KEY = 'zmeurel:cules-rapid:parcela'
const MAX_CULEGATOR_CHIPS = 8

function todayInputValue(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function parseKg(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}

function formatKg(value: number): string {
  return value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })
}

function formatLei(value: number): string {
  return Math.round(value).toLocaleString('ro-RO')
}

function readLastParcela(): string | null {
  try {
    return window.localStorage.getItem(LAST_PARCELA_KEY)
  } catch {
    return null
  }
}

function saveLastParcela(id: string) {
  try {
    window.localStorage.setItem(LAST_PARCELA_KEY, id)
  } catch {
    // stocarea locală poate lipsi (mod privat); alegerea rămâne doar în sesiune
  }
}

const chipClass = (selected: boolean) =>
  cn(
    'min-h-12 rounded-xl border-[1.5px] px-2 text-[15px] transition-colors active:scale-[0.98]',
    selected
      ? 'border-[var(--pill-active-bg)] bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] [font-weight:800]'
      : 'border-[var(--pill-inactive-border)] bg-[var(--pill-inactive-bg)] text-[var(--pill-inactive-text)] [font-weight:650]',
  )

/**
 * V2 · Cules rapid: o cântărire = alegi culegătorul, scrii kg, Enter.
 * Folosește aceeași salvare ca dialogul complet (`createRecoltare`, RPC `create_recoltare_with_stock`),
 * deci stocul și manopera automată se actualizează identic. Data e mereu azi; pentru altă dată
 * sau observații rămâne dialogul complet.
 */
export function QuickRecoltareCard({ onOpenFullForm }: { onOpenFullForm: () => void }) {
  const queryClient = useQueryClient()
  const kg1Ref = useRef<HTMLInputElement>(null)

  const { data: parcele = [] } = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele })
  const { data: culegatori = [] } = useQuery({ queryKey: queryKeys.culegatori, queryFn: getCulegatori })
  const { data: activitati = [] } = useQuery({ queryKey: queryKeys.activitati, queryFn: getActivitatiAgricole })

  const commercialParcele = useMemo(() => parcele.filter((p) => p.rol === 'comercial'), [parcele])
  const activeCulegatori = useMemo(
    () =>
      culegatori
        .filter((c) => c.status_activ)
        .sort((a, b) => (a.nume_prenume || '').localeCompare(b.nume_prenume || '', 'ro')),
    [culegatori],
  )

  const [chosenParcelaId, setParcelaId] = useState<string | null>(null)
  const [lastParcelaId] = useState<string | null>(() => readLastParcela())
  const [culegatorId, setCulegatorId] = useState('')
  const [cropId, setCropId] = useState('')
  const [kg1, setKg1] = useState('')
  const [kg2, setKg2] = useState('')

  // Parcela implicită: aleasă acum, altfel ultima folosită pe acest telefon, altfel prima comercială.
  const parcelaId =
    commercialParcele.find((p) => p.id === chosenParcelaId)?.id ??
    commercialParcele.find((p) => p.id === lastParcelaId)?.id ??
    commercialParcele[0]?.id ??
    ''

  const selectedParcela = commercialParcele.find((p) => p.id === parcelaId) ?? null
  const selectedCulegator = activeCulegatori.find((c) => c.id === culegatorId) ?? null
  const cropOptions = useMemo(() => getParcelaCropRows(selectedParcela), [selectedParcela])
  const selectedCrop = cropOptions.find((c) => c.id === cropId) ?? (cropOptions.length === 1 ? cropOptions[0] : null)

  const chipCulegatori = activeCulegatori.slice(0, MAX_CULEGATOR_CHIPS)
  const restCulegatori = activeCulegatori.slice(MAX_CULEGATOR_CHIPS)
  const selectedIsInRest = restCulegatori.some((c) => c.id === culegatorId)

  const kgCal1 = parseKg(kg1)
  const kgCal2 = parseKg(kg2)
  const totalKg = kgCal1 + kgCal2
  const tarif = Number(selectedCulegator?.tarif_lei_kg ?? 0)

  const pause = useMemo(() => {
    if (!parcelaId) return null
    for (const act of activitati) {
      if (act.parcela_id !== parcelaId || !act.data_aplicare || !act.timp_pauza_zile) continue
      const { status, dataRecoltarePermisa } = calculatePauseStatus(act.data_aplicare, act.timp_pauza_zile)
      if (status === 'Pauza') {
        return new Date(dataRecoltarePermisa).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
      }
    }
    return null
  }, [activitati, parcelaId])

  const mutation = useMutation({
    mutationFn: createRecoltare,
    onSuccess: (result, variables) => {
      if (!result.success) {
        hapticError()
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.recoltari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
      trackEvent({ eventName: 'create_success', moduleName: 'recoltari', status: 'success' })
      trackEvent('create_recoltare', 'recoltari', { source: 'QuickRecoltareCard' })
      track('recoltare_add', { kg: variables.kg_cal1 + variables.kg_cal2, parcela_id: variables.parcela_id })
      hapticSuccess()
      const kg = variables.kg_cal1 + variables.kg_cal2
      const name = selectedCulegator?.nume_prenume || 'Culegător'
      if (result.warning) toast.warning(result.warning)
      else toast.success(`${name}: ${formatKg(kg)} kg salvate${tarif > 0 ? ` · ${formatLei(kg * tarif)} lei de plată` : ''}`)
      setKg1('')
      setKg2('')
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    },
    onError: (error: unknown) => {
      const e = error as { status?: number; code?: string; message?: string }
      if (e?.status === 409 || e?.code === '23505') {
        toast.info('Înregistrarea era deja sincronizată.')
        setKg1('')
        setKg2('')
        return
      }
      trackEvent({ eventName: 'create_failed', moduleName: 'recoltari', status: 'failed' })
      hapticError()
      toast.error(e?.message || 'Eroare la salvare')
    },
  })

  const submit = () => {
    if (mutation.isPending) return
    if (!selectedParcela) return toast.error('Alege parcela.')
    if (!selectedCulegator) return toast.error('Alege culegătorul.')
    if (totalKg <= 0) {
      kg1Ref.current?.focus()
      return toast.error('Scrie kilogramele la Cal. I sau la Cal. II.')
    }
    if (cropOptions.length > 1 && !selectedCrop) return toast.error('Alege cultura recoltată.')

    mutation.mutate({
      data: todayInputValue(),
      parcela_id: selectedParcela.id,
      culegator_id: selectedCulegator.id,
      kg_cal1: kgCal1,
      kg_cal2: kgCal2,
      observatii:
        buildHarvestObservatii(
          undefined,
          selectedCrop ? { cropId: selectedCrop.id, culture: selectedCrop.culture, variety: selectedCrop.variety } : null,
        ) || undefined,
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  const pickCulegator = (id: string) => {
    setCulegatorId(id)
    // după alegerea culegătorului, cursorul merge direct în kg: tastatura telefonului se deschide pe cifre
    window.setTimeout(() => kg1Ref.current?.focus(), 0)
  }

  if (commercialParcele.length === 0 || activeCulegatori.length === 0) return null

  const labelClass = 'mb-1.5 block text-[13px] text-[var(--text-secondary)] [font-weight:750]'
  const kgInputClass =
    'h-16 w-full rounded-xl border-2 border-[var(--text-primary)] bg-[var(--surface-card)] pl-3.5 pr-11 font-display text-[28px] text-[var(--text-primary)] tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] [font-weight:700]'

  return (
    <section
      aria-labelledby="cules-rapid-titlu"
      className="space-y-3.5 rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-card)] p-3.5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="cules-rapid-titlu" className="font-display text-lg text-[var(--text-primary)] [font-weight:800]">
          Cules rapid
        </h2>
        <button
          type="button"
          onClick={onOpenFullForm}
          className="min-h-11 px-1 text-sm text-[var(--agri-primary)] underline underline-offset-4 [font-weight:750]"
        >
          Formular complet
        </button>
      </div>

      {commercialParcele.length > 1 ? (
        <div>
          <span className={labelClass}>Parcelă</span>
          <div className="grid grid-cols-2 gap-2">
            {commercialParcele.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === parcelaId}
                className={chipClass(p.id === parcelaId)}
                onClick={() => {
                  setParcelaId(p.id)
                  setCropId('')
                  saveLastParcela(p.id)
                }}
              >
                <span className="line-clamp-2">{formatUnitateDisplayName(p.nume_parcela, p.tip_unitate, 'Parcelă')}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {cropOptions.length > 1 ? (
        <div>
          <span className={labelClass}>Cultură</span>
          <div className="grid grid-cols-2 gap-2">
            {cropOptions.map((crop) => (
              <button
                key={crop.id}
                type="button"
                aria-pressed={crop.id === selectedCrop?.id}
                className={chipClass(crop.id === selectedCrop?.id)}
                onClick={() => setCropId(crop.id)}
              >
                {[crop.culture, crop.variety].filter(Boolean).join(' · ') || 'Cultură'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {pause ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border-[1.5px] border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5 text-sm text-[var(--warning-text)] [font-weight:700]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Parcela e în pauză după tratament. Recoltarea e permisă din {pause}.</span>
        </div>
      ) : null}

      <div>
        <span className={labelClass}>
          Culegător <span className="[font-weight:600]">· apasă numele, apoi scrie kilogramele</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          {chipCulegatori.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === culegatorId}
              className={chipClass(c.id === culegatorId)}
              onClick={() => pickCulegator(c.id)}
            >
              <span className="line-clamp-2">{c.nume_prenume || 'Culegător'}</span>
            </button>
          ))}
          {restCulegatori.length > 0 ? (
            <label className={cn(chipClass(selectedIsInRest), 'relative flex items-center justify-center')}>
              <span className="pointer-events-none line-clamp-2">
                {selectedIsInRest ? selectedCulegator?.nume_prenume : `Alții (${restCulegatori.length})`}
              </span>
              <select
                aria-label="Alege alt culegător"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={selectedIsInRest ? culegatorId : ''}
                onChange={(e) => e.target.value && pickCulegator(e.target.value)}
              >
                <option value="">Alege…</option>
                {restCulegatori.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume_prenume}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="relative block">
          <span className={labelClass}>Cal. I</span>
          <input
            ref={kg1Ref}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            value={kg1}
            onChange={(e) => setKg1(e.target.value)}
            onKeyDown={onKeyDown}
            className={kgInputClass}
          />
          <span className="pointer-events-none absolute bottom-[22px] right-3.5 text-sm text-[var(--text-secondary)] [font-weight:700]">kg</span>
        </label>
        <label className="relative block">
          <span className={labelClass}>Cal. II</span>
          <input
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            value={kg2}
            onChange={(e) => setKg2(e.target.value)}
            onKeyDown={onKeyDown}
            className={kgInputClass}
          />
          <span className="pointer-events-none absolute bottom-[22px] right-3.5 text-sm text-[var(--text-secondary)] [font-weight:700]">kg</span>
        </label>
      </div>

      <p className="text-sm text-[var(--text-secondary)] [font-weight:600]" aria-live="polite">
        {selectedCulegator
          ? totalKg > 0 && tarif > 0
            ? <>{formatKg(totalKg)} kg × {formatKg(tarif)} lei = <b className="text-[var(--text-primary)]">{formatLei(totalKg * tarif)} lei</b> de plată pentru {selectedCulegator.nume_prenume}</>
            : tarif > 0
              ? `Tariful lui ${selectedCulegator.nume_prenume}: ${formatKg(tarif)} lei/kg`
              : `${selectedCulegator.nume_prenume} nu are tarif setat. Recoltarea se salvează fără plată calculată.`
          : 'Alege culegătorul ca să vezi plata.'}
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={mutation.isPending}
        className="flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-[var(--agri-primary)] px-4 text-lg text-[var(--agri-primary-contrast)] disabled:opacity-60 active:scale-[0.99] [font-weight:800]"
      >
        {mutation.isPending ? 'Se salvează…' : 'Salvează recoltarea'}
      </button>
    </section>
  )
}
