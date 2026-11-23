'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarRange, GripVertical, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import {
  BigInput,
  BottomSheet,
  Button,
  CheckRow,
  EmptyState,
  ListRow,
  Notice,
  StatusPill,
  SummaryList,
  SummaryRow,
  ToggleRow,
  kitText,
  type StatusTone,
} from '@/components/kit'
import { LinieStepForm } from '@/components/plan/LinieStepForm'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { accessLevelForModule } from '@/lib/farm-members/access'
import {
  anPlanNou,
  cheieStare,
  detaliuLinie,
  ETICHETA_STARE_AN,
  eticheta,
  ordoneazaLinii,
  parcelePlan,
  stadiiPlan,
  stareLinieAn,
  titluLinie,
  type LiniePlan,
  type StareAn,
  type StareLinie,
} from '@/lib/plan'
import { usePlan } from '@/lib/plan/usePlan'
import { queryKeys } from '@/lib/query-keys'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'
import {
  anuleazaSarire,
  mutaLinie,
  redenumestePlan,
  seteazaExceptie,
  seteazaParcelePlan,
  stergeLinie,
  stergePlan,
} from '@/lib/supabase/queries/plan'
import { aziRo, ziCuDataRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function subscribeToDayChange(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(timer)
}
const readToday = () => aziRo()
const noServerDay = () => null

const TON_STARE: Record<StareAn, StatusTone> = {
  acum: 'warning',
  planificat: 'info',
  facut: 'success',
  sarit: 'neutral',
  urmeaza: 'neutral',
  nefacut: 'neutral',
  fara_parcele: 'neutral',
}

const TEXT_STARE_PARCELA: Record<StareLinie, string> = {
  acum: 'acum',
  facut: 'făcut',
  planificat: 'planificat',
  urmeaza: 'urmează',
  sarit: 'sărit',
  nefacut: 'nefăcut',
  exceptie: 'nu se aplică aici',
  fara_stadiu: 'fără stadiu pe fișă',
}

type Foaie = null | { tip: 'linie'; linieId: string } | { tip: 'muta'; linieId: string } | { tip: 'parcela'; parcelaId: string } | { tip: 'parcele' } | { tip: 'nume' } | { tip: 'sterge-plan' } | { tip: 'sterge-linie'; linieId: string }

/**
 * „Planul întreg”: pe stadii, cu liniile (produs, doză, scop, metodă, repetare) și starea pe an (făcut / acum / sărit /
 * urmează). „+ Linie”, editarea unei linii, mutarea între stadii (ținut apăsat pe telefon, tras pe desktop), parcelele
 * planului cu excepțiile pe parcelă. Planurile vechi se deschid și se editează aici la fel.
 */
export function PlanIntregClient({ planId }: { planId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
  const { memberRole, memberAccess } = useDashboardAuth()
  const esteProprietar = memberRole !== 'operator'
  const poateScrie = esteProprietar || accessLevelForModule(memberAccess, 'tratamente') === 'write'

  const data = usePlan(azi)
  const plan = data.planuri.find((p) => p.id === planId) ?? null
  const calculat = data.calculate.find((c) => c.plan.id === planId) ?? null

  const [foaie, setFoaie] = useState<Foaie>(null)
  const [linieForm, setLinieForm] = useState<{ open: boolean; linie: LiniePlan | null; stadiu: StadiuCod }>({ open: false, linie: null, stadiu: 'inflorit' })
  const [busy, setBusy] = useState(false)
  const [nume, setNume] = useState('')
  const [parceleAlese, setParceleAlese] = useState<string[]>([])
  const [trasa, setTrasa] = useState<string | null>(null)
  const apasare = useRef<number | null>(null)

  // Anul parcelelor: anul curent, sau cel pentru care s-a făcut planul (toamna se face pentru sezonul următor).
  const anParcele = useMemo(() => {
    if (!plan || !azi) return data.an
    if (parcelePlan(plan.id, data.asocieri, data.an).length > 0) return data.an
    const urmator = anPlanNou(azi)
    return parcelePlan(plan.id, data.asocieri, urmator).length > 0 ? urmator : data.an
  }, [azi, data.an, data.asocieri, plan])
  const parcelaIds = plan ? parcelePlan(plan.id, data.asocieri, anParcele) : []
  const stadii = plan ? stadiiPlan(plan) : []
  const linii = plan ? ordoneazaLinii(plan.linii) : []
  const linieFoaie = foaie && 'linieId' in foaie ? (linii.find((l) => l.id === foaie.linieId) ?? null) : null
  const ordineNoua = Math.max(0, ...linii.map((l) => l.ordine)) + 1

  const ruleaza = async (fn: () => Promise<void>, succes: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: queryKeys.plan })
      toast.success(succes)
      setFoaie(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  const deschideLinieForm = (linie: LiniePlan | null, stadiu?: StadiuCod) => {
    // Foaia se închide înainte să se deschidă formularul (nimic peste un formular pe pași).
    setFoaie(null)
    window.setTimeout(() => setLinieForm({ open: true, linie, stadiu: stadiu ?? linie?.stadiu ?? linii.at(-1)?.stadiu ?? stadii[0] ?? 'inflorit' }), 180)
  }

  const muta = (linieId: string, stadiu: StadiuCod) => {
    const linie = linii.find((l) => l.id === linieId)
    if (!linie || linie.stadiu === stadiu) return
    void ruleaza(() => mutaLinie(linieId, stadiu), `Mutată la „${eticheta(stadiu, plan?.cultura_tip)}”.`)
  }

  // Ținut apăsat (telefon): „Mută în alt stadiu”.
  const pornesteApasare = (linieId: string) => {
    if (!poateScrie) return
    if (apasare.current) window.clearTimeout(apasare.current)
    apasare.current = window.setTimeout(() => {
      apasare.current = null
      setFoaie({ tip: 'muta', linieId })
    }, 550)
  }
  const opresteApasare = () => {
    if (apasare.current) window.clearTimeout(apasare.current)
    apasare.current = null
  }

  const textParcele = parcelaIds.map((id) => data.numeParcele.get(id) ?? 'Parcelă').join(', ')
  const stadiiAfisate = trasa ? stadii : stadii.filter((s) => linii.some((l) => l.stadiu === s))

  return (
    <AppShell
      header={<ScreenHeader title={plan?.nume ?? 'Planul'} backHref="/tratamente?tab=plan" />}
      bottomBarFixed
      bottomBar={
        plan && poateScrie ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">
              <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschideLinieForm(null)}>
                <Plus aria-hidden />
                Linie
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {data.loading || !azi ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă planul">
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : !plan ? (
          <EmptyState icon={<CalendarRange />} title="Planul nu mai există" description="Poate a fost șters. Întoarce-te la Tratamente › Plan." />
        ) : (
          <>
            <p className={cn('-mt-2 text-fg-muted', kitText.secondary)}>
              {parcelaIds.length > 0 ? `Pe ${textParcele}${anParcele !== data.an ? ` (${anParcele})` : ''}` : `Fără parcele în ${anParcele}`}
              {plan.arhivat ? ' · arhivat' : ''}
            </p>

            <div className="hidden md:block">
              {poateScrie ? (
                <Button type="button" variant="primary" size="touch" onClick={() => deschideLinieForm(null)}>
                  <Plus aria-hidden />
                  Linie
                </Button>
              ) : null}
            </div>

            {linii.length === 0 ? (
              <EmptyState icon={<CalendarRange />} title="Nicio linie încă" description="Adaugă liniile planului, stadiu cu stadiu: produsul, doza, scopul și, dacă vrei, repetarea." />
            ) : null}

            {stadiiAfisate.map((stadiu) => {
              const aleStadiului = linii.filter((l) => l.stadiu === stadiu)
              return (
                <section
                  key={stadiu}
                  className={cn('space-y-2 rounded-box', trasa && 'border border-dashed border-border-strong p-2')}
                  aria-label={eticheta(stadiu, plan.cultura_tip)}
                  onDragOver={(event) => {
                    if (trasa) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (trasa) muta(trasa, stadiu)
                    setTrasa(null)
                  }}
                >
                  <h3 className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>{eticheta(stadiu, plan.cultura_tip)}</h3>
                  {aleStadiului.length === 0 ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>Lasă linia aici.</p> : null}
                  <ul className="space-y-2">
                    {aleStadiului.map((linie) => {
                      const stare = calculat ? stareLinieAn(linie, calculat.calcul) : null
                      const sarit = stare?.stare === 'sarit'
                      return (
                        <li
                          key={linie.id}
                          draggable={poateScrie}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', linie.id)
                            setTrasa(linie.id)
                          }}
                          onDragEnd={() => setTrasa(null)}
                          onPointerDown={(event) => {
                            if (event.pointerType !== 'mouse') pornesteApasare(linie.id)
                          }}
                          onPointerUp={opresteApasare}
                          onPointerLeave={opresteApasare}
                          onPointerCancel={opresteApasare}
                          onContextMenu={(event) => {
                            if (poateScrie) event.preventDefault()
                          }}
                        >
                          <ListRow
                            avatar={false}
                            leading={
                              poateScrie ? (
                                <span className="hidden size-6 shrink-0 items-center justify-center text-fg-subtle md:flex [&_svg]:size-5" aria-hidden>
                                  <GripVertical />
                                </span>
                              ) : undefined
                            }
                            title={<span className={cn(sarit && 'text-fg-muted line-through')}>{titluLinie(linie)}</span>}
                            detail={detaliuLinie(linie) || undefined}
                            trailing={stare && stare.stare !== 'fara_parcele' ? <StatusPill tone={TON_STARE[stare.stare]}>{ETICHETA_STARE_AN[stare.stare]}</StatusPill> : undefined}
                            onClick={() => setFoaie({ tip: 'linie', linieId: linie.id })}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {poateScrie && linii.length > 1 ? (
              <p className={cn('px-1 text-fg-muted', kitText.helper)}>Ține apăsat pe o linie ca s-o muți în alt stadiu; pe calculator, trage-o.</p>
            ) : null}

            <section className="space-y-2" aria-labelledby="parcelele-planului">
              <h3 id="parcelele-planului" className={cn('px-1 pt-2 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
                Parcelele planului
              </h3>
              <ul className="space-y-2">
                {parcelaIds.map((parcelaId) => {
                  const exceptii = linii.filter((l) => calculat?.calcul.stari.get(cheieStare(l.id, parcelaId))?.stare === 'exceptie').length
                  const curente = data.stadii.get(parcelaId) ?? []
                  return (
                    <li key={parcelaId}>
                      <ListRow
                        avatar={false}
                        title={data.numeParcele.get(parcelaId) ?? 'Parcelă'}
                        detail={[
                          curente.length > 0 ? curente.map((c) => eticheta(c.stadiu, plan.cultura_tip, c.cohort)).join(' · ') : 'fără stadiu pe fișă',
                          exceptii > 0 ? (exceptii === 1 ? '1 linie nu se aplică aici' : `${exceptii} linii nu se aplică aici`) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        onClick={() => setFoaie({ tip: 'parcela', parcelaId })}
                      />
                    </li>
                  )
                })}
              </ul>
              {poateScrie ? (
                <Button
                  type="button"
                  variant="neutral"
                  size="touch"
                  className="w-full"
                  onClick={() => {
                    setParceleAlese(parcelaIds)
                    setFoaie({ tip: 'parcele' })
                  }}
                >
                  Schimbă parcelele
                </Button>
              ) : null}
            </section>

            {poateScrie ? (
              <div className="flex flex-col gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="quiet"
                  size="touch"
                  className="w-full"
                  onClick={() => {
                    setNume(plan.nume)
                    setFoaie({ tip: 'nume' })
                  }}
                >
                  Redenumește planul
                </Button>
                {esteProprietar ? (
                  <Button type="button" variant="quiet" size="touch" className="w-full text-danger-text" onClick={() => setFoaie({ tip: 'sterge-plan' })}>
                    Șterge planul
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </ScreenBody>

      {/* ─── Linia: detalii, starea pe parcele, sărit, editare ─── */}
      <BottomSheet
        open={foaie?.tip === 'linie' && Boolean(linieFoaie)}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title={linieFoaie ? titluLinie(linieFoaie) : 'Linia'}
        footer={
          linieFoaie && poateScrie ? (
            <div className="flex flex-col gap-2.5">
              <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschideLinieForm(linieFoaie)}>
                Editează linia
              </Button>
              <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setFoaie({ tip: 'muta', linieId: linieFoaie.id })}>
                Mută în alt stadiu
              </Button>
              {esteProprietar ? (
                <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setFoaie({ tip: 'sterge-linie', linieId: linieFoaie.id })}>
                  Șterge linia
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {linieFoaie && plan ? (
          <div className="space-y-3">
            <SummaryList>
              <SummaryRow label="Stadiul" value={eticheta(linieFoaie.stadiu, plan.cultura_tip, linieFoaie.cohort)} />
              {linieFoaie.produse.map((p, i) => (
                <SummaryRow key={`${p.nume}-${i}`} label={i === 0 ? 'Produse' : ''} value={p.nume} />
              ))}
              {detaliuLinie(linieFoaie) ? <SummaryRow label="Cum" value={detaliuLinie(linieFoaie)} /> : null}
              {linieFoaie.scop ? <SummaryRow label="Scopul" value={linieFoaie.scop} /> : null}
            </SummaryList>
            {parcelaIds.length > 0 ? (
              <section className="space-y-2">
                <p className={cn('font-bold text-fg', kitText.secondary)}>Pe parcele, în {data.an}</p>
                <ul className="space-y-2">
                  {parcelaIds.map((parcelaId) => {
                    const s = calculat?.calcul.stari.get(cheieStare(linieFoaie.id, parcelaId))
                    if (!s) return null
                    const detaliu = [
                      TEXT_STARE_PARCELA[s.stare],
                      s.ultima ? `ultima ${ziCuDataRo(s.ultima)}` : null,
                      s.urmatoarea && s.stare === 'facut' ? `din nou ${ziCuDataRo(s.urmatoarea)}` : null,
                      s.motiv,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <li key={parcelaId}>
                        <ListRow
                          avatar={false}
                          title={data.numeParcele.get(parcelaId) ?? 'Parcelă'}
                          detail={detaliu}
                          trailing={
                            s.stare === 'sarit' && poateScrie && data.disponibil ? (
                              <Button
                                type="button"
                                variant="neutral"
                                size="touch"
                                loading={busy}
                                onClick={() => void ruleaza(() => anuleazaSarire({ linieId: linieFoaie.id, parcelaIds: [parcelaId], an: data.an }), 'Linia revine pe parcelă.')}
                              >
                                Nu mai sar
                              </Button>
                            ) : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      {/* ─── Mută în alt stadiu ─── */}
      <BottomSheet open={foaie?.tip === 'muta' && Boolean(linieFoaie)} onOpenChange={(open) => (open ? null : setFoaie(null))} title="Mută în stadiul">
        <ul className="space-y-2">
          {stadii.map((stadiu) => (
            <li key={stadiu}>
              <ListRow
                avatar={false}
                title={eticheta(stadiu, plan?.cultura_tip)}
                trailing={linieFoaie?.stadiu === stadiu ? <StatusPill tone="info">acum aici</StatusPill> : undefined}
                disabled={busy}
                onClick={() => linieFoaie && muta(linieFoaie.id, stadiu)}
              />
            </li>
          ))}
        </ul>
      </BottomSheet>

      {/* ─── Parcela: excepțiile ─── */}
      <BottomSheet
        open={foaie?.tip === 'parcela'}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title={foaie?.tip === 'parcela' ? `Pe ${data.numeParcele.get(foaie.parcelaId) ?? 'parcelă'}` : 'Parcela'}
        description="Ce linii se aplică pe parcela asta"
      >
        {foaie?.tip === 'parcela' ? (
          data.disponibil ? (
            <ul className="space-y-2">
              {linii.map((linie) => {
                const exceptie = calculat?.calcul.stari.get(cheieStare(linie.id, foaie.parcelaId))?.stare === 'exceptie'
                return (
                  <li key={linie.id}>
                    <ToggleRow
                      title={`${eticheta(linie.stadiu, plan?.cultura_tip)} · ${titluLinie(linie)}`}
                      subtitle={exceptie ? 'Nu se aplică aici' : 'Se aplică'}
                      checked={!exceptie}
                      disabled={!poateScrie || busy}
                      onCheckedChange={(checked) =>
                        void ruleaza(() => seteazaExceptie({ linieId: linie.id, parcelaId: foaie.parcelaId, exceptie: !checked }), checked ? 'Linia se aplică din nou aici.' : 'Linia nu se mai aplică aici.')
                      }
                    />
                  </li>
                )
              })}
            </ul>
          ) : (
            <Notice tone="info" title="Excepțiile pe parcelă vor merge după actualizarea bazei de date" />
          )
        ) : null}
      </BottomSheet>

      {/* ─── Parcelele planului ─── */}
      <BottomSheet
        open={foaie?.tip === 'parcele'}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title={`Parcelele planului, în ${anParcele}`}
        footer={
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            loading={busy}
            onClick={() => plan && void ruleaza(() => seteazaParcelePlan(plan.id, parceleAlese, anParcele), 'Parcelele s-au salvat.')}
          >
            Salvează
          </Button>
        }
      >
        <div className="space-y-2">
          {data.parcele.map((parcela) => (
            <CheckRow
              key={parcela.id}
              title={parcela.nume_parcela?.trim() || 'Parcelă'}
              detail={parcela.cultura ?? undefined}
              checked={parceleAlese.includes(parcela.id)}
              onCheckedChange={(checked) => setParceleAlese((previous) => (checked ? [...previous, parcela.id] : previous.filter((id) => id !== parcela.id)))}
            />
          ))}
          <p className={cn('text-fg-muted', kitText.helper)}>O parcelă are un singur plan pe an: dacă avea altul, trece pe acesta.</p>
        </div>
      </BottomSheet>

      {/* ─── Numele ─── */}
      <BottomSheet
        open={foaie?.tip === 'nume'}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title="Numele planului"
        footer={
          <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy} disabled={!nume.trim()} onClick={() => plan && void ruleaza(() => redenumestePlan(plan.id, nume), 'Numele s-a salvat.')}>
            Salvează
          </Button>
        }
      >
        <BigInput label="Numele" value={nume} onChange={(event) => setNume(event.target.value)} />
      </BottomSheet>

      {/* ─── Ștergerile (doar proprietarul) ─── */}
      <BottomSheet
        open={foaie?.tip === 'sterge-linie' && Boolean(linieFoaie)}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title="Ștergi linia?"
        footer={
          <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy} onClick={() => linieFoaie && void ruleaza(() => stergeLinie(linieFoaie.id), 'Linia s-a șters.')}>
            Șterge linia
          </Button>
        }
      >
        <p className={cn('text-fg', kitText.base)}>Tratamentele deja făcute din ea rămân în jurnal, dar nu mai apar ca făcute în plan.</p>
      </BottomSheet>
      <BottomSheet
        open={foaie?.tip === 'sterge-plan'}
        onOpenChange={(open) => (open ? null : setFoaie(null))}
        title="Ștergi planul?"
        footer={
          <Button
            type="button"
            variant="danger"
            size="touch-lg"
            className="w-full"
            loading={busy}
            onClick={() =>
              plan &&
              void ruleaza(async () => {
                await stergePlan(plan.id)
                router.replace('/tratamente?tab=plan')
              }, 'Planul s-a șters.')
            }
          >
            Șterge planul
          </Button>
        }
      >
        <p className={cn('text-fg', kitText.base)}>Se șterg planul și liniile lui. Tratamentele deja făcute rămân în jurnal.</p>
      </BottomSheet>

      {plan ? (
        <LinieStepForm
          open={linieForm.open}
          onOpenChange={(open) => setLinieForm((previous) => ({ ...previous, open }))}
          planId={plan.id}
          culturaTip={plan.cultura_tip}
          stadii={stadii}
          linie={linieForm.linie}
          stadiuInitial={linieForm.stadiu}
          ordineNoua={ordineNoua}
          catalog={data.catalog}
        />
      ) : null}
    </AppShell>
  )
}
