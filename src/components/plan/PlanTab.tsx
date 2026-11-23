'use client'

import { CalendarRange, Droplets, Leaf, Pencil, Repeat, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button, EmptyState, ListRow, Notice, StatusPill, kitText } from '@/components/kit'
import {
  eticheta,
  interventiiText,
  textProduseLinie,
  textRepetare,
  verificarePrincipala,
  detaliuLinie,
  type GrupDeFacut,
  type LiniePlan,
  type PlanTratament,
  type StadiuUrmator,
} from '@/lib/plan'
import type { PlanData } from '@/lib/plan/usePlan'
import { cn } from '@/lib/utils'

import { IntrebareStadiuCard } from './IntrebareStadiuCard'

export interface DeschideLinie {
  plan: PlanTratament
  linie: LiniePlan
  parcelaIds: string[]
  stadiuLabel: string
}

const textParcele = (ids: readonly string[], nume: ReadonlyMap<string, string>) => {
  const lista = ids.map((id) => nume.get(id) ?? 'Parcelă')
  return lista.length > 3 ? `${lista.slice(0, 3).join(', ')} și încă ${lista.length - 3}` : lista.join(' + ')
}

function IconitaLinie({ linie, ton }: { linie: LiniePlan; ton: 'primary' | 'warning' | 'neutral' }) {
  const tip = linie.produse[0]?.tip
  const icon =
    linie.metoda === 'fertirigare' ? <Droplets /> : tip === 'fungicid' || tip === 'insecticid' || tip === 'acaricid' ? <ShieldCheck /> : <Leaf />
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        ton === 'primary' && 'bg-primary-soft text-primary',
        ton === 'warning' && 'bg-warning-bg text-warning-text',
        ton === 'neutral' && 'bg-surface-muted text-fg',
      )}
      aria-hidden
    >
      {icon}
    </span>
  )
}

function SectiuneTitlu({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
      {children}
    </h3>
  )
}

export interface PlanTabProps {
  azi: string
  data: PlanData
  poateScrie: boolean
  onDeschideLinie: (input: DeschideLinie) => void
  onPlanNou: (varianta: 'an_trecut' | 'zero') => void
}

/**
 * Tratamente → Plan: sus „E timpul pentru · <stadiu> · <parcele>” cu intervențiile (fiecare cu verificarea ei:
 * magazie, pauză), jos „Urmează” (stadiile următoare, pe scurt), apoi planurile fermei (și cele vechi). Întrebarea
 * „A început…?” apare deasupra când se apropie stadiul următor. Fără plan: „Fă un plan”, cu cele două variante.
 */
export function PlanTab({ azi, data, poateScrie, onDeschideLinie, onPlanNou }: PlanTabProps) {
  const router = useRouter()
  const anTrecut = data.an - 1

  if (data.loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Se încarcă planul">
        <div className="h-[120px] animate-pulse rounded-card bg-surface-muted" />
        <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    )
  }
  if (data.error) {
    return (
      <Notice tone="danger" title="Planul nu s-a încărcat">
        Verifică internetul și deschide din nou pagina.
      </Notice>
    )
  }

  const intrebari = data.intrebari()
  const cuParcele = data.calculate.filter((c) => c.calcul.parcelaIds.length > 0)
  const grupuri: Array<{ plan: PlanTratament; grup: GrupDeFacut }> = cuParcele.flatMap((c) => c.grupuri.map((grup) => ({ plan: c.plan, grup })))

  const variante = (
    <div className="grid gap-2">
      <ListRow
        avatar={false}
        leading={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5" aria-hidden>
            <Repeat />
          </span>
        }
        title={`Din ce am aplicat în ${anTrecut}`}
        detail="Tratamentele de anul trecut, grupate pe stadii. Păstrezi ce vrei."
        onClick={() => onPlanNou('an_trecut')}
        disabled={!poateScrie}
      />
      <ListRow
        avatar={false}
        leading={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
            <Pencil />
          </span>
        }
        title="De la zero"
        detail="Pui tu liniile, stadiu cu stadiu."
        onClick={() => onPlanNou('zero')}
        disabled={!poateScrie}
      />
    </div>
  )

  return (
    <div className="space-y-3.5">
      {intrebari.map((intrebare) => (
        <IntrebareStadiuCard
          key={intrebare.cheie}
          intrebare={intrebare}
          numeParcela={data.numeParcele.get(intrebare.parcelaId) ?? 'Parcelă'}
          azi={azi}
          poateScrie={poateScrie}
          onAmana={data.amana}
        />
      ))}

      {data.planuri.length === 0 ? (
        <>
          <EmptyState
            icon={<CalendarRange />}
            title="Fă un plan"
            description="Un plan pe cultură, pe stadii: când o parcelă ajunge într-un stadiu, îți arată ce e de făcut și completează tratamentul cu un atins. Aplicația nu vine cu planuri gata făcute."
          />
          {poateScrie ? variante : null}
        </>
      ) : null}

      {grupuri.map(({ plan, grup }) => {
        const label = eticheta(grup.stadiu, plan.cultura_tip)
        return (
          <section key={`${plan.id}:${grup.stadiu}`} className="space-y-2" aria-label={`E timpul pentru ${label}`}>
            <div className="rounded-card bg-primary p-4 text-primary-contrast shadow-1">
              <p className={cn('font-semibold uppercase tracking-wide opacity-90', kitText.helper)}>E timpul pentru</p>
              <p className={cn('mt-1 font-bold leading-tight', kitText.screen)}>
                {label} · {textParcele(grup.parcelaIds, data.numeParcele)}
              </p>
              <p className={cn('mt-1 opacity-90', kitText.secondary)}>
                {interventiiText(grup.linii.length)} din „{plan.nume}”
              </p>
            </div>
            <ul className="space-y-2">
              {grup.linii.map(({ linie, parcelaIds, repetare }) => {
                const verificari = data.verifica(linie, parcelaIds)
                const principala = verificarePrincipala(verificari)
                const detaliu = [
                  linie.scop,
                  detaliuLinie(linie),
                  repetare > 1 ? `a ${repetare}-a aplicare` : null,
                  parcelaIds.length < grup.parcelaIds.length ? textParcele(parcelaIds, data.numeParcele) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={linie.id}>
                    <ListRow
                      avatar={false}
                      leading={<IconitaLinie linie={linie} ton={principala && !principala.ok ? 'warning' : 'primary'} />}
                      title={textProduseLinie(linie)}
                      detail={
                        <span className="flex flex-col items-start gap-1.5">
                          {detaliu ? <span>{detaliu}</span> : null}
                          {principala ? (
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>{principala.text}</span>
                              <StatusPill tone={principala.ok ? 'success' : 'warning'}>{principala.eticheta}</StatusPill>
                            </span>
                          ) : null}
                        </span>
                      }
                      onClick={poateScrie ? () => onDeschideLinie({ plan, linie, parcelaIds, stadiuLabel: label }) : undefined}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {cuParcele.map(({ plan, calcul, grupuri: g, urmeaza }) => (
        <section key={plan.id} className="space-y-2" aria-label={`Planul ${plan.nume}`}>
          {g.length === 0 ? (
            <Notice tone="success" title={`„${plan.nume}”: nimic de făcut acum`}>
              {calcul.parcelaIds.some((id) => (data.stadii.get(id) ?? []).length === 0)
                ? 'Pune stadiul pe fișa parcelelor: planul îți arată ce urmează după stadiul de acum.'
                : 'Când o parcelă ajunge în stadiul unei linii, apare aici.'}
            </Notice>
          ) : null}
          {urmeaza.length > 0 ? (
            <>
              <SectiuneTitlu>Urmează{cuParcele.length > 1 ? ` · ${plan.nume}` : ''}</SectiuneTitlu>
              <ul className="space-y-2">
                {urmeaza.map((u: StadiuUrmator, index) => (
                  <li key={u.stadiu}>
                    <ListRow
                      avatar={false}
                      leading={
                        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted font-bold text-fg', kitText.secondary)} aria-hidden>
                          {index + 1}
                        </span>
                      }
                      title={eticheta(u.stadiu, plan.cultura_tip)}
                      detail={textUrmeaza(u, plan, data.numeParcele)}
                      onClick={() => router.push(`/tratamente/plan/${plan.id}`)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => router.push(`/tratamente/plan/${plan.id}`)}>
            Vezi planul întreg
          </Button>
        </section>
      ))}

      {data.planuri.length > 0 ? (
        <section className="space-y-2" aria-labelledby="planurile-fermei">
          <SectiuneTitlu id="planurile-fermei">Planurile fermei</SectiuneTitlu>
          <ul className="space-y-2">
            {data.planuri.map((plan) => {
              const parcele = data.calculate.find((c) => c.plan.id === plan.id)?.calcul.parcelaIds ?? []
              return (
                <li key={plan.id}>
                  <ListRow
                    avatar={false}
                    title={plan.nume}
                    detail={[
                      plan.linii.length === 1 ? '1 linie' : `${plan.linii.length} linii`,
                      parcele.length > 0 ? `pe ${textParcele(parcele, data.numeParcele)}` : `fără parcele în ${data.an}`,
                      plan.arhivat ? 'arhivat' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    onClick={() => router.push(`/tratamente/plan/${plan.id}`)}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {!data.disponibil && data.planuri.length > 0 ? (
        <p className={cn('px-1 text-fg-muted', kitText.helper)}>„Sar peste” și excepțiile pe parcelă vor merge după actualizarea bazei de date.</p>
      ) : null}
    </div>
  )
}

function textUrmeaza(u: StadiuUrmator, plan: PlanTratament, nume: ReadonlyMap<string, string>): string {
  const parti: string[] = [interventiiText(u.linii.length)]
  const repetare = u.linii.length === 1 ? textRepetare(u.linii[0].repetare) : null
  if (repetare) parti.push(repetare)
  const unde = u.parcele.slice(0, 2).map((p) =>
    p.stadiu ? `${nume.get(p.parcelaId) ?? 'Parcelă'} e încă la ${eticheta(p.stadiu, plan.cultura_tip).toLocaleLowerCase('ro-RO')}` : `${nume.get(p.parcelaId) ?? 'Parcelă'} n-are stadiu`,
  )
  if (unde.length > 0) parti.push(unde.join(', '))
  return parti.join(' · ')
}
