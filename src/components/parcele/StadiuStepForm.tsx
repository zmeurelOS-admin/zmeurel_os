'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Scissors, Sprout } from 'lucide-react'

import {
  BigTextarea,
  Button,
  CalendarPanel,
  ListRow,
  Notice,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  addDaysIso,
  kitText,
  useStepForm,
} from '@/components/kit'
import type { Cohorta } from '@/lib/parcele/configurare-sezon'
import {
  ETICHETA_ACTIUNE_CICLU,
  actiuniCiclu,
  etichetaComutatorLastar,
  etichetaLastar,
  lastariMod,
  randuriActiuneCiclu,
  type ActiuneCiclu,
  type ModLastari,
} from '@/lib/parcele/lastari'
import { getLabelPentruGrup, listStadiiPentruGrup, type GrupBiologic, type StadiuCod } from '@/lib/parcele/stadii-canonic'
import { queryKeys } from '@/lib/query-keys'
import { createParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { ZiCuDataRo } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface StadiuStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string
  parcelaNume: string
  grup: GrupBiologic | null
  /** Cum lucrezi lăstarii (zmeură / mur, `src/lib/parcele/lastari.ts`); `null` la culturile fără lăstari. */
  mod: ModLastari | null
  /**
   * Stadiul pentru butoanele ciclului, pe lăstar (`stadiuCurentParcela().ciclu`): în „An 1 + an 2”, un rând vechi fără
   * cohortă se citește ca lăstar de an 1 (promptul 34, §1).
   */
  ciclu: Partial<Record<Cohorta, StadiuCod | null>>
  todayIso: string
}

const STEPS = ['stadiu'] as const

const anulZilei = (zi: string): number => Number(zi.slice(0, 4))

/**
 * „Actualizează stadiul” (promptul 33): lăstarii după modul de lucru — la „An 1 + an 2” întâi „Pentru”
 * (Floricane · lăstar an 2 / Primocane · lăstar an 1), la un singur lăstar direct stadiul. Stadiul din lista culturii,
 * pe plăci; ziua azi, implicit. După recoltare, în „An 1 + an 2”, foaia oferă ciclul: „Tai tot” / „Păstrez o parte”
 * pe an 1, „Tăiat” pe an 2. Stadiul îl pune doar omul; aplicația nu-l schimbă singură.
 */
export function StadiuStepForm({ open, onOpenChange, parcelaId, parcelaNume, grup, mod, ciclu, todayIso }: StadiuStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: false })
  const lastari = useMemo(() => lastariMod(mod), [mod])
  const [lastarAles, setLastarAles] = useState<Cohorta>('floricane')
  const [stadiu, setStadiu] = useState<StadiuCod | null>(null)
  const [zi, setZi] = useState(todayIso)
  const [nota, setNota] = useState('')
  const [calendar, setCalendar] = useState(false)
  const [saving, setSaving] = useState<null | 'stadiu' | ActiuneCiclu>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setLastarAles(lastari[0] ?? 'floricane')
    setStadiu(null)
    setZi(todayIso)
    setNota('')
    setCalendar(false)
    setSaving(null)
    setSaveError(null)
    setSaved(null)
  }

  // Lăstarul pe care se notează: cel ales la doi lăstari, singurul la un lăstar, niciunul la alte culturi.
  const lastar: Cohorta | null = lastari.length === 0 ? null : lastari.length === 1 ? lastari[0] : lastarAles
  const stadii = useMemo(() => listStadiiPentruGrup(grup), [grup])
  const eticheta = (cod: StadiuCod) => getLabelPentruGrup(cod, grup, { cohort: lastar })
  const stadiuAcum = lastar ? (ciclu[lastar] ?? null) : null
  const actiuni = lastar ? actiuniCiclu(mod, lastar, stadiuAcum) : []

  const reincarca = () => {
    // Toate anii (stadiul se citește peste ani): `['stadii-ferma']` acoperă și lista, și fișa, și planul.
    void queryClient.invalidateQueries({ queryKey: queryKeys.stadiiFerma(anulZilei(zi)).slice(0, 1) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
  }

  const mesajEroare = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    return /row-level security|42501/i.test(message) ? 'Nu ai drept de scriere pe parcele.' : message || 'Stadiul nu s-a salvat. Încearcă din nou.'
  }

  const save = async () => {
    if (!stadiu || saving) return
    setSaving('stadiu')
    setSaveError(null)
    try {
      await createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an: anulZilei(zi),
        stadiu,
        cohort: lastar,
        data_observata: zi,
        observatii: nota.trim() || undefined,
      })
      reincarca()
      hapticSuccess()
      const nume = eticheta(stadiu)
      setSaved(`${lastar && lastari.length > 1 ? `${etichetaLastar(lastar)}: ` : ''}${nume} · ${ZiCuDataRo(zi)}`)
      form.markSuccess()
    } catch (error) {
      hapticError()
      setSaveError(mesajEroare(error))
      form.markFailed()
    } finally {
      setSaving(null)
    }
  }

  const ruleazaActiune = async (actiune: ActiuneCiclu) => {
    if (saving) return
    setSaving(actiune)
    setSaveError(null)
    try {
      // „Păstrez” scrie două rânduri (an 2 în repaus, an 1 tăiat), în aceeași zi.
      for (const rand of randuriActiuneCiclu(actiune)) {
        await createParcelaStadiuCanonic({
          parcela_id: parcelaId,
          an: anulZilei(zi),
          stadiu: rand.stadiu,
          cohort: rand.cohort,
          data_observata: zi,
          observatii: nota.trim() || undefined,
        })
      }
      reincarca()
      hapticSuccess()
      setSaved(`${ETICHETA_ACTIUNE_CICLU[actiune]} · ${ZiCuDataRo(zi)}`)
      form.markSuccess()
    } catch (error) {
      hapticError()
      setSaveError(mesajEroare(error))
      form.markFailed()
    } finally {
      setSaving(null)
    }
  }

  const close = () => onOpenChange(false)

  const content = calendar ? (
    <div className="space-y-4">
      <StepFormTitle>Ce zi?</StepFormTitle>
      <CalendarPanel
        value={zi}
        max={todayIso}
        onChange={(iso) => {
          setZi(iso)
          setCalendar(false)
        }}
        shortcuts={[
          { label: 'Azi', value: todayIso },
          { label: 'Ieri', value: addDaysIso(todayIso, -1) },
          { label: 'Alaltăieri', value: addDaysIso(todayIso, -2) },
        ]}
      />
    </div>
  ) : (
    <div className="space-y-5">
      <StepFormTitle eyebrow={lastar && lastari.length === 1 ? `${parcelaNume} · ${etichetaLastar(lastar)}` : parcelaNume}>Stadiul de acum</StepFormTitle>

      {saveError ? (
        <Notice tone="danger" title="Nu s-a salvat">
          {saveError}
        </Notice>
      ) : null}

      {lastari.length > 1 ? (
        <div className="space-y-2.5">
          <p className={cn('font-bold text-fg', kitText.base)}>Pentru</p>
          <Segments
            aria-label="Lăstarul"
            options={lastari.map((value) => ({ value, label: etichetaComutatorLastar(value) }))}
            value={lastarAles}
            onValueChange={(value) => {
              setLastarAles(value)
              setStadiu(null)
            }}
          />
        </div>
      ) : null}

      {actiuni.length > 0 ? (
        <section aria-label="După recoltare" className="space-y-2">
          <p className={cn('font-bold text-fg', kitText.base)}>{lastar === 'primocane' ? 'Ce faci cu lăstarii de an 1?' : 'Lăstarii de an 2'}</p>
          {actiuni.map((actiune) => (
            <Button
              key={actiune}
              type="button"
              variant="neutral"
              size="touch-lg"
              className="w-full justify-start"
              loading={saving === actiune}
              disabled={saving !== null}
              onClick={() => void ruleazaActiune(actiune)}
            >
              {actiune === 'pastrez' ? <Sprout aria-hidden /> : <Scissors aria-hidden />}
              <span className="min-w-0 whitespace-normal text-left">{ETICHETA_ACTIUNE_CICLU[actiune]}</span>
            </Button>
          ))}
          <p className={cn('text-fg-muted', kitText.secondary)}>
            {lastar === 'primocane'
              ? '„Păstrez” pune lăstarii de an 2 pe „Floricane în repaus”; lăstarii noi de an 1 îi notezi de la „Pornire lăstari noi”.'
              : 'După „Tăiat”, lăstarul de an 2 rămâne fără stadiu până la următorul „Păstrez”.'}
          </p>
        </section>
      ) : null}

      <TileGroup type="single" aria-label="Stadiul" value={stadiu} onValueChange={(value) => setStadiu((value as StadiuCod | null) ?? null)}>
        {stadii.map((cod) => (
          <Tile key={cod} value={cod} size="sm" title={eticheta(cod)} />
        ))}
      </TileGroup>

      <ListRow
        avatar={false}
        leading={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
            <CalendarDays />
          </span>
        }
        title={zi === todayIso ? `Azi, ${ZiCuDataRo(zi).split(' ')[1]}` : ZiCuDataRo(zi)}
        detail="Data"
        onClick={() => setCalendar(true)}
      />

      <BigTextarea label="Notă (opțional)" value={nota} onChange={(event) => setNota(event.target.value)} rows={2} maxLength={300} />
    </div>
  )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      title={`Stadiul · ${parcelaNume}`}
      description="Stadiul de acum al parcelei, din lista culturii."
      stepLabel={calendar ? 'Ziua' : 'Stadiul'}
      onBack={() => {
        if (!calendar) return false
        setCalendar(false)
        return true
      }}
      footer={
        calendar
          ? null
          : {
              primary: {
                label: saving === 'stadiu' ? 'Se salvează…' : 'Salvează stadiul',
                onClick: () => void save(),
                loading: saving === 'stadiu',
                disabled: !stadiu || saving !== null,
              },
            }
      }
      success={saved ? <SuccessScreen title="Stadiu salvat" description={saved} primaryAction={{ label: 'Gata', onClick: close }} /> : undefined}
    >
      {content}
    </StepForm>
  )
}
