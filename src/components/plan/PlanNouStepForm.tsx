'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Pencil, Repeat } from 'lucide-react'

import {
  BigInput,
  Button,
  CheckRow,
  EmptyState,
  ListRow,
  Notice,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  Tile,
  TileGroup,
  ToggleRow,
  kitText,
  useStepForm,
} from '@/components/kit'
import { AlegeProdus, ProdusNou } from '@/components/tratamente/AlegeProdus'
import {
  anPlanNou,
  ceLipsesteLinie,
  culturaDinParcela,
  detaliuLinie,
  eticheta,
  grupeazaAnTrecut,
  listaStadiiPlanNou,
  numePlanPropus,
  randuriPlanNou,
  textGrup,
  titluLinie,
  type AplicareAnTrecut,
  type GrupAnTrecut,
  type LinieNoua,
  type MetodaLinie,
  type ProdusAplicat,
  type StadiuRand,
} from '@/lib/plan'
import { queryKeys } from '@/lib/query-keys'
import { creeazaPlan } from '@/lib/supabase/queries/plan'
import { creeazaProdusFerma, type TipProdusNou } from '@/lib/supabase/queries/tratamente'
import type { AplicareRow, ProdusCatalog } from '@/lib/tratamente/model'
import { ziuaRo } from '@/lib/tratamente/zile'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { LinieEditor } from './LinieEditor'

const STEPS = ['varianta', 'linii', 'parcele'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

export type VariantaPlan = 'an_trecut' | 'zero'
type Vedere = null | { tip: 'stadiu'; cheie: string } | { tip: 'linie'; index: number | null } | { tip: 'produs' } | { tip: 'produs-nou' } | { tip: 'renunta' }

const METODE: Record<string, MetodaLinie> = { foliar: 'foliar', fertirigare: 'fertirigare', fertilizare_baza: 'fertilizare_baza', granulat_sol: 'granulat_sol' }

/** Aplicările făcute în `an`, pentru gruparea „din anul trecut”. */
export function aplicariAnTrecut(aplicari: readonly AplicareRow[], an: number): AplicareAnTrecut[] {
  const prefix = `${an}-`
  return aplicari
    .filter((a) => a.status === 'aplicata')
    .map((a) => {
      const zi = ziuaRo(a.data_aplicata) ?? ''
      const produse: ProdusAplicat[] =
        a.produse.length > 0
          ? [...a.produse]
              .sort((x, y) => x.ordine - y.ordine)
              .map((p) => ({
                produs_id: p.produs_id,
                nume: p.produs_nume_snapshot,
                tip: p.tip_snapshot,
                phi: p.phi_zile_snapshot,
                doza_ml_per_hl: p.doza_ml_per_hl,
                doza_l_per_ha: p.doza_l_per_ha,
                cantitate_text: a.metoda_aplicare === 'fertirigare' ? p.cantitate_text : null,
              }))
          : a.produs
            ? [{ produs_id: a.produs.id, nume: a.produs.nume_comercial ?? 'Produs', tip: a.produs.tip, phi: a.produs.phi_zile, doza_ml_per_hl: a.doza_ml_per_hl, doza_l_per_ha: a.doza_l_per_ha, cantitate_text: null }]
            : []
      return { id: a.id, parcela_id: a.parcela_id, zi, metoda: METODE[a.metoda_aplicare ?? ''] ?? null, produse }
    })
    .filter((a) => a.zi.startsWith(prefix) && a.produse.length > 0)
}

export interface PlanNouStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayIso: string
  /** Varianta aleasă deja (din tab-ul Plan): formularul pornește la linii. */
  varianta: VariantaPlan | null
  parcele: ReadonlyArray<{ id: string; nume_parcela: string | null; cultura?: string | null; rol?: string | null }>
  aplicari: readonly AplicareRow[]
  /** Stadiile din anul de unde se iau aplicările. */
  stadiiSursa: readonly StadiuRand[]
  catalog: readonly ProdusCatalog[]
}

/**
 * „Plan nou”: din ce am aplicat anul trecut (grupat pe stadii, păstrezi ce vrei; aplicările repetate devin o linie cu
 * „repetă la ~N zile”) sau de la zero. Apoi numele și parcelele. Aplicația nu vine cu planuri-model.
 * Planul se salvează în tabelele existente, cu id-uri derivate din cheia formularului (fără dublare la reîncercare).
 */
export function PlanNouStepForm({ open, onOpenChange, todayIso, varianta: variantaInitiala, parcele, aplicari, stadiiSursa, catalog }: PlanNouStepFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, initialStep: variantaInitiala ? 'linii' : undefined, analytics: { moduleName: 'plan_tratament' } })
  const anPlan = anPlanNou(todayIso)
  const anSursa = anPlan - 1

  const [varianta, setVarianta] = useState<VariantaPlan>('an_trecut')
  const [pastrate, setPastrate] = useState<Set<string>>(new Set())
  const [stadiiAlese, setStadiiAlese] = useState<Map<string, StadiuCod>>(new Map())
  const [linii, setLinii] = useState<LinieNoua[]>([])
  const [editata, setEditata] = useState<LinieNoua | null>(null)
  // Indexul liniei editate se ține separat de vedere (alegerea produsului trece prin altă vedere).
  const [indexEditat, setIndexEditat] = useState<number | null>(null)
  const [parcelaIds, setParcelaIds] = useState<string[]>([])
  const [nume, setNume] = useState('')
  const [vedere, setVedere] = useState<Vedere>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const grupuri: GrupAnTrecut[] = useMemo(() => grupeazaAnTrecut(aplicariAnTrecut(aplicari, anSursa), stadiiSursa), [anSursa, aplicari, stadiiSursa])
  const parceleSortate = useMemo(() => [...parcele].sort((a, b) => Number(b.rol === 'comercial') - Number(a.rol === 'comercial')), [parcele])

  // ─── Reset la o cheie nouă (aceleași intrări → același rezultat) ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setVarianta(variantaInitiala ?? 'an_trecut')
    setPastrate(new Set(grupuri.filter((g) => g.stadiu).map((g) => g.cheie)))
    setStadiiAlese(new Map())
    setLinii([])
    setEditata(null)
    setParcelaIds(parceleSortate.filter((p) => p.rol === 'comercial').map((p) => p.id))
    setNume(numePlanPropus(anPlan))
    setVedere(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const culturaTip = culturaDinParcela(parcele.find((p) => parcelaIds.includes(p.id))?.cultura)
  const stadii = listaStadiiPlanNou(culturaTip)

  const stadiuGrup = (g: GrupAnTrecut) => g.stadiu ?? stadiiAlese.get(g.cheie) ?? null
  const liniiFinale: LinieNoua[] =
    varianta === 'an_trecut'
      ? grupuri
          .filter((g) => pastrate.has(g.cheie))
          .map((g) => ({
            stadiu: stadiuGrup(g) as StadiuCod,
            cohort: null,
            scop: null,
            metoda: g.metoda,
            repetare: g.repetare,
            produse: g.produse.map((p) => ({ ...p })),
          }))
      : linii
  const faraStadiu = varianta === 'an_trecut' && grupuri.some((g) => pastrate.has(g.cheie) && !stadiuGrup(g))
  const lipsaLinii = faraStadiu ? 'Alege stadiul pentru fiecare grup păstrat.' : liniiFinale.length === 0 ? (varianta === 'an_trecut' ? 'Păstrează cel puțin un grup.' : 'Adaugă cel puțin o linie.') : null

  const save = async () => {
    if (saving || lipsaLinii || parcelaIds.length === 0) return
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)
      const { data: userData } = await supabase.auth.getUser()
      const randuri = randuriPlanNou({ cheie: key, tenantId, userId: userData.user?.id ?? null, nume, culturaTip, linii: liniiFinale, parcelaIds, an: anPlan })
      await creeazaPlan(randuri, anPlan)
      await queryClient.invalidateQueries({ queryKey: queryKeys.plan })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setSaved(key)
      form.markSuccess({ varianta, linii: liniiFinale.length, parcele: parcelaIds.length })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      const message = error instanceof Error ? error.message : ''
      setSaving(false)
      setSaveError(NETWORK_ERROR.test(message) ? 'Nu există conexiune la internet. Când revine, apasă din nou: planul nu se dublează.' : message || 'Planul nu s-a salvat.')
      form.markFailed()
    }
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

  const adaugaProdus = (produs: ProdusCatalog | null, numeManual?: string) => {
    setEditata((previous) =>
      previous
        ? {
            ...previous,
            produse: [
              ...previous.produse,
              { produs_id: produs?.id ?? null, nume: produs?.nume_comercial ?? numeManual ?? 'Produs', tip: produs?.tip ?? null, phi: produs?.phi_zile ?? null, doza_ml_per_hl: null, doza_l_per_ha: null, cantitate_text: null },
            ],
          }
        : previous,
    )
    setVedere({ tip: 'linie', index: indexEditat })
  }

  const close = () => onOpenChange(false)
  const dirty = linii.length > 0 || (varianta === 'an_trecut' && form.stepKey !== 'varianta')
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setVedere({ tip: 'renunta' })
    return true
  }
  const handleBack = () => {
    if (!vedere) return false
    if (vedere.tip === 'produs' || vedere.tip === 'produs-nou') setVedere({ tip: 'linie', index: indexEditat })
    else setVedere(null)
    return true
  }

  let content: React.ReactNode = null
  let stepLabel: string | undefined
  let footer: React.ComponentProps<typeof StepForm>['footer'] = null

  if (vedere?.tip === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la plan?</StepFormTitle>
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
  } else if (vedere?.tip === 'stadiu') {
    stepLabel = 'Stadiul'
    const cheie = vedere.cheie
    content = (
      <div className="space-y-3">
        <StepFormTitle>În ce stadiu era?</StepFormTitle>
        <ul className="space-y-2">
          {stadii.map((s) => (
            <li key={s}>
              <ListRow
                avatar={false}
                title={eticheta(s, culturaTip)}
                onClick={() => {
                  setStadiiAlese((previous) => new Map(previous).set(cheie, s))
                  setPastrate((previous) => new Set(previous).add(cheie))
                  setVedere(null)
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    )
  } else if (vedere?.tip === 'produs') {
    stepLabel = 'Adaugă produs'
    content = (
      <AlegeProdus
        catalog={catalog}
        recente={[]}
        doarZmeur={culturaTip === 'zmeur'}
        dejaAlese={new Set((editata?.produse ?? []).map((p) => p.nume))}
        onAlege={adaugaProdus}
        onProdusNou={() => setVedere({ tip: 'produs-nou' })}
      />
    )
  } else if (vedere?.tip === 'produs-nou') {
    stepLabel = 'Produs nou'
    content = <ProdusNou tipImplicit={editata?.metoda === 'fertirigare' ? 'ingrasamant' : 'fungicid'} onSalveaza={salveazaProdusNou} />
  } else if (vedere?.tip === 'linie' && editata) {
    stepLabel = indexEditat === null ? 'Linie nouă' : 'Linia'
    content = <LinieEditor linie={editata} onChange={setEditata} stadii={stadii} culturaTip={culturaTip} onAlegeProdus={() => setVedere({ tip: 'produs' })} />
    const lipsa = ceLipsesteLinie(editata)
    footer = {
      primary: {
        label: 'Gata cu linia',
        disabled: lipsa !== null,
        onClick: () => {
          setLinii((previous) => (indexEditat === null ? [...previous, editata] : previous.map((l, i) => (i === indexEditat ? editata : l))))
          setEditata(null)
          setVedere(null)
        },
      },
      ...(indexEditat !== null
        ? {
            secondary: {
              label: 'Scoate linia',
              onClick: () => {
                setLinii((previous) => previous.filter((_, i) => i !== indexEditat))
                setEditata(null)
                setVedere(null)
              },
            },
          }
        : {}),
    }
  } else if (form.stepKey === 'varianta') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Cum faci planul?</StepFormTitle>
        <TileGroup
          type="single"
          aria-label="Cum faci planul"
          // Nicio placă aleasă dinainte: atingerea alege și merge mai departe (o placă deja aleasă n-ar mai răspunde).
          value={null}
          onValueChange={(value) => {
            if (!value) return
            setVarianta(value as VariantaPlan)
            form.next()
          }}
        >
          <Tile value="an_trecut" size="lg" leading={<Repeat aria-hidden />} title={`Din ce am aplicat în ${anSursa}`} subtitle="Grupate pe stadii; păstrezi ce vrei" />
          <Tile value="zero" size="lg" leading={<Pencil aria-hidden />} title="De la zero" subtitle="Pui tu liniile" />
        </TileGroup>
        <p className={cn('text-fg-muted', kitText.helper)}>Aplicația nu vine cu planuri gata făcute: răspunderea agronomică e a ta.</p>
      </div>
    )
  } else if (form.stepKey === 'linii') {
    footer = { primary: { label: 'Continuă', onClick: () => form.next(), disabled: lipsaLinii !== null } }
    content =
      varianta === 'an_trecut' ? (
        <div className="space-y-3">
          <StepFormTitle>Din {anSursa}</StepFormTitle>
          {grupuri.length === 0 ? (
            <EmptyState
              title={`Niciun tratament în ${anSursa}`}
              description="N-am găsit aplicări făcute anul trecut. Fă planul de la zero."
              action={
                <Button type="button" variant="primary" size="touch" onClick={() => setVarianta('zero')}>
                  De la zero
                </Button>
              }
            />
          ) : (
            <>
              <p className={cn('text-fg-muted', kitText.secondary)}>
                Am găsit {grupuri.reduce((n, g) => n + g.zile.length, 0)} aplicări, grupate pe stadii. Păstrează ce vrei:
              </p>
              <ul className="space-y-2">
                {grupuri.map((g) => {
                  const s = stadiuGrup(g)
                  const titlu = `${s ? eticheta(s, culturaTip) : 'Stadiu necunoscut'} · ${g.produse.map((p) => p.nume).join(' + ')}${g.metoda === 'fertirigare' ? ' (fertirigare)' : ''}`
                  return (
                    <li key={g.cheie} className="space-y-1.5">
                      <ToggleRow
                        title={titlu}
                        subtitle={textGrup(g)}
                        checked={pastrate.has(g.cheie)}
                        disabled={!s}
                        onCheckedChange={(checked) =>
                          setPastrate((previous) => {
                            const next = new Set(previous)
                            if (checked) next.add(g.cheie)
                            else next.delete(g.cheie)
                            return next
                          })
                        }
                      />
                      {!g.stadiu ? (
                        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setVedere({ tip: 'stadiu', cheie: g.cheie })}>
                          {s ? 'Schimbă stadiul' : 'Alege stadiul (parcela n-avea stadiu notat)'}
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              <p className={cn('text-fg-muted', kitText.helper)}>Stadiul vine din stadiul parcelei la data aplicării. Liniile le poți schimba după, în planul întreg.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <StepFormTitle>Liniile planului</StepFormTitle>
          {linii.length === 0 ? <p className={cn('text-fg-muted', kitText.secondary)}>Fiecare linie: stadiul, produsele cu doza, scopul și, dacă vrei, repetarea.</p> : null}
          <ul className="space-y-2">
            {linii.map((linie, index) => (
              <li key={index}>
                <ListRow
                  avatar={false}
                  title={`${eticheta(linie.stadiu, culturaTip)} · ${titluLinie(linie)}`}
                  detail={detaliuLinie(linie) || undefined}
                  onClick={() => {
                    setIndexEditat(index)
                    setEditata(linie)
                    setVedere({ tip: 'linie', index })
                  }}
                />
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className="w-full border-dashed"
            onClick={() => {
              setIndexEditat(null)
              setEditata({ stadiu: linii.at(-1)?.stadiu ?? stadii[1] ?? stadii[0], cohort: null, scop: null, metoda: 'foliar', repetare: null, produse: [] })
              setVedere({ tip: 'linie', index: null })
            }}
          >
            + Linie
          </Button>
        </div>
      )
  } else if (form.stepKey === 'parcele') {
    footer = {
      primary: {
        label: saving ? 'Se salvează…' : `Fă planul „${nume.trim() || 'Plan'}”`,
        onClick: () => void save(),
        loading: saving,
        disabled: saving || parcelaIds.length === 0 || lipsaLinii !== null,
      },
    }
    content = (
      <div className="space-y-4">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <BigInput label="Numele planului" value={nume} onChange={(event) => setNume(event.target.value)} />
        <section className="space-y-2">
          <p className={cn('font-bold text-fg', kitText.secondary)}>Pe ce parcele, în {anPlan}</p>
          {parceleSortate.map((parcela) => (
            <CheckRow
              key={parcela.id}
              title={parcela.nume_parcela?.trim() || 'Parcelă'}
              detail={parcela.cultura ?? undefined}
              checked={parcelaIds.includes(parcela.id)}
              onCheckedChange={(checked) => setParcelaIds((previous) => (checked ? [...previous, parcela.id] : previous.filter((id) => id !== parcela.id)))}
            />
          ))}
          <p className={cn('text-fg-muted', kitText.helper)}>O parcelă are un singur plan pe an: dacă avea altul, trece pe acesta.</p>
        </section>
        <p className={cn('text-fg-muted', kitText.secondary)}>{liniiFinale.length === 1 ? '1 linie' : `${liniiFinale.length} linii`} în plan.</p>
      </div>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Plan nou"
      description="Un plan de tratamente pe stadii, din anul trecut sau de la zero."
      stepLabel={stepLabel}
      onBack={handleBack}
      footer={footer}
      success={
        saved ? (
          <SuccessScreen
            title="Planul e gata"
            description={`„${nume.trim() || 'Plan'}” · ${liniiFinale.length === 1 ? '1 linie' : `${liniiFinale.length} linii`}. Când o parcelă ajunge într-un stadiu din plan, apare în tab-ul Plan.`}
            primaryAction={{
              label: 'Vezi planul',
              onClick: () => {
                close()
                router.push(`/tratamente/plan/${saved}`)
              },
            }}
            secondaryAction={{ label: 'Gata', onClick: close }}
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
