import { Sprout } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'

import { OnboardingStep } from './OnboardingStep'

interface OnboardingBannerProps {
  arePlan: boolean
  areParceleCuPlan: boolean
  areStadii: boolean
}

export function OnboardingBanner({
  arePlan,
  areParceleCuPlan,
  areStadii,
}: OnboardingBannerProps) {
  if (arePlan && areParceleCuPlan && areStadii) {
    return null
  }

  return (
    <AppCard className="rounded-[22px] border border-[color:color-mix(in_srgb,var(--agri-primary)_14%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_4%,var(--surface-card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))] text-[var(--agri-primary)] shadow-[var(--shadow-soft)]">
          <Sprout className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg text-[var(--text-primary)] [font-weight:750]">
            Bun venit în modulul Protecție & Nutriție!
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Urmează 3 pași simpli pentru a începe și pentru a vedea recomandările complete pe parcele.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <OnboardingStep
          step={1}
          label="Creează primul plan"
          description="Poți porni din wizard sau dintr-un import Excel existent."
          status={arePlan ? 'completed' : 'active'}
          ctaHref="/tratamente/planuri/nou"
          ctaLabel="Începe"
        />
        <OnboardingStep
          step={2}
          label="Asociază planul la o parcelă"
          description="Leagă planul de parcela potrivită și sezonul curent."
          status={areParceleCuPlan ? 'completed' : arePlan ? 'active' : 'pending'}
        />
        <OnboardingStep
          step={3}
          label="Înregistrează fenofaza curentă"
          description="După primul stadiu observat, dashboard-ul poate propune aplicările relevante."
          status={areStadii ? 'completed' : areParceleCuPlan ? 'active' : 'pending'}
        />
      </div>
    </AppCard>
  )
}
