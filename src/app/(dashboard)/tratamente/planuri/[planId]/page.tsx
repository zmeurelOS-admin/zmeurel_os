import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { ParceleAsignateList } from '@/components/tratamente/ParceleAsignateList'
import { PlanDetailHeader } from '@/components/tratamente/PlanDetailHeader'
import { PlanLiniiList } from '@/components/tratamente/PlanLiniiList'
import {
  countAplicariPlan,
  getPlanTratamentComplet,
  listAplicariParcela,
  listParcelePentruPlanWizard,
  listProduseFitosanitare,
} from '@/lib/supabase/queries/tratamente'
import { getConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'
import { needsCohortSelection } from '@/lib/tratamente/configurare-sezon'
import { getGrupBiologicDinCultura } from '@/components/tratamente/plan-wizard/helpers'
import { getCurrentSezon } from '@/lib/utils/sezon'

type PageProps = {
  params: Promise<{ planId: string }>
}

export default async function TratamentePlanDetailPage({ params }: PageProps) {
  const { planId } = await params
  const plan = await getPlanTratamentComplet(planId)

  if (!plan) {
    notFound()
  }

  const [produse, parceleDisponibile, aplicariCount] = await Promise.all([
    listProduseFitosanitare({ activ: true }),
    listParcelePentruPlanWizard(plan.cultura_tip),
    countAplicariPlan(planId),
  ])

  const anCurent = getCurrentSezon()
  const planAn = plan.parcele_asociate[0]?.an ?? null
  const parcelaCod = plan.parcele_asociate[0]?.parcela_cod ?? null
  const planLinieIds = new Set(plan.linii.map((linie) => linie.id))
  const asociereParcelaIds = Array.from(
    new Set(
      plan.parcele_asociate
        .map((asociere) => asociere.parcela_id)
        .filter((parcelaId): parcelaId is string => Boolean(parcelaId))
    )
  )
  // --- FIX 1: calcul aplicate pe linii din aplicările read-only deja disponibile în modul ---
  const aplicariAplicatePlan = (
    await Promise.all(
      asociereParcelaIds.map((parcelaId) => listAplicariParcela(parcelaId, { status: 'aplicata' }))
    )
  ).flat()
  const liniiAplicateIds = new Set(
    aplicariAplicatePlan
      .map((aplicare) => aplicare.plan_linie_id)
      .filter((linieId): linieId is string => typeof linieId === 'string' && planLinieIds.has(linieId))
  )
  const aplicate = liniiAplicateIds.size
  const configurareSezon = plan.parcele_asociate[0]?.parcela_id
    ? await getConfigurareSezon(plan.parcele_asociate[0].parcela_id, anCurent)
    : null
  const grupBiologic = getGrupBiologicDinCultura(plan.cultura_tip)
  const allowCohortTrigger = needsCohortSelection(grupBiologic, configurareSezon)
  // TODO: conectează markAplicataAction când va fi disponibilă în actions.ts.

  return (
    <AppShell
      header={
        <PageHeader
          title={plan.nume}
          subtitle={`${plan.cultura_tip} · ${plan.arhivat ? 'dezactivat' : 'activ'}`}
          expandRightSlotOnMobile
          summary={
            <PlanDetailHeader
              an={planAn}
              aplicate={aplicate}
              countAplicari={aplicariCount}
              culturaTip={plan.cultura_tip}
              descriere={plan.descriere}
              isArchived={plan.arhivat}
              parcelaCod={parcelaCod}
              planId={plan.id}
              planName={plan.nume}
              totalLinii={plan.linii.length}
            />
          }
        />
      }
      bottomInset="calc(var(--app-nav-clearance) + 1rem)"
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 py-3 pb-28 md:py-4 md:pb-8">
        <AppCard className="rounded-[22px] p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Status</p>
              <p className="mt-2 text-base text-[var(--text-primary)] [font-weight:650]">
                {plan.arhivat ? 'Dezactivat' : 'Activ'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Linii</p>
              <p className="mt-2 text-base text-[var(--text-primary)] [font-weight:650]">{plan.linii.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Aplicări asociate</p>
              <p className="mt-2 text-base text-[var(--text-primary)] [font-weight:650]">{aplicariCount}</p>
            </div>
          </div>
          {plan.descriere?.trim() ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{plan.descriere}</p>
          ) : null}
        </AppCard>

        <ParceleAsignateList
          anCurent={anCurent}
          parceleAsociate={plan.parcele_asociate}
          parceleDisponibile={parceleDisponibile}
          planId={plan.id}
        />

        <PlanLiniiList
          allowCohortTrigger={allowCohortTrigger}
          culturaTip={plan.cultura_tip}
          linii={plan.linii}
          planId={plan.id}
          produse={produse}
        />
      </div>
    </AppShell>
  )
}
