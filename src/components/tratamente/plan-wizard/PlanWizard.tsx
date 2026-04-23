'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, FilePenLine, Layers3, ShieldCheck, Sprout } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import {
  listCulturiPentruPlanWizardAction,
  listParcelePentruPlanWizardAction,
  listProduseFitosanitarePentruPlanWizardAction,
  upsertPlanTratamentCuLiniiAction,
} from '@/app/(dashboard)/tratamente/planuri/actions'
import { AppCard } from '@/components/ui/app-card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { queryKeys } from '@/lib/query-keys'
import type { PlanTratamentComplet } from '@/lib/supabase/queries/tratamente'

import {
  buildWizardWarnings,
  getGrupBiologicDinCultura,
} from '@/components/tratamente/plan-wizard/helpers'
import { PlanWizardStepInfo } from '@/components/tratamente/plan-wizard/PlanWizardStepInfo'
import { PlanWizardStepLinii } from '@/components/tratamente/plan-wizard/PlanWizardStepLinii'
import { PlanWizardStepRevizuire } from '@/components/tratamente/plan-wizard/PlanWizardStepRevizuire'
import {
  asociereSchema,
  linieDraftSchema,
  planInfoSchema,
  planToWizardValues,
  lineToPayload,
  type PlanWizardInfoData,
  type PlanWizardLinieDraft,
  type PlanWizardRevizuireData,
} from '@/components/tratamente/plan-wizard/types'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { needsCohortSelection } from '@/lib/tratamente/configurare-sezon'
import { getCurrentSezon } from '@/lib/utils/sezon'

interface PlanWizardProps {
  initialData?: PlanTratamentComplet
  configurareSezon?: ConfigurareSezon | null
  onSave: (result: PlanTratamentComplet) => Promise<void> | void
  onCancel: () => void
  preselectedParcelaId?: string
}

type WizardStep = 1 | 2 | 3

type InfoErrors = Partial<Record<keyof PlanWizardInfoData, string>>

const STEPS: Array<{
  id: WizardStep
  icon: React.ComponentType<{ className?: string }>
  subtitle: string
  title: string
}> = [
  { id: 1, icon: Sprout, title: 'Informații plan', subtitle: 'Nume și cultură' },
  { id: 2, icon: Layers3, title: 'Intervenții planificate', subtitle: 'Produse și ordine' },
  { id: 3, icon: ShieldCheck, title: 'Revizuire', subtitle: 'Avertismente și asociere' },
]

function getInfoErrors(value: PlanWizardInfoData): InfoErrors {
  const parsed = planInfoSchema.safeParse(value)
  if (parsed.success) return {}

  return parsed.error.issues.reduce<InfoErrors>((accumulator, issue) => {
    const key = issue.path[0]
    if (key === 'nume' || key === 'cultura_tip' || key === 'descriere') {
      accumulator[key] = issue.message
    }
    return accumulator
  }, {})
}

function isLineValid(linie: PlanWizardLinieDraft) {
  return linieDraftSchema.safeParse(linie).success
}

export function PlanWizard({
  configurareSezon,
  initialData,
  onSave,
  onCancel,
  preselectedParcelaId,
}: PlanWizardProps) {
  const initialValues = useMemo(
    () =>
      initialData
        ? planToWizardValues(initialData)
        : {
            info: {
              nume: '',
              cultura_tip: '',
              descriere: '',
            },
            linii: [],
            revizuire: {
              an: getCurrentSezon(),
              parcele_ids: [],
            },
          },
    [initialData]
  )

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [infoData, setInfoData] = useState<PlanWizardInfoData>(initialValues.info)
  const [liniiData, setLiniiData] = useState<PlanWizardLinieDraft[]>(initialValues.linii)
  const [reviewData, setReviewData] = useState<PlanWizardRevizuireData>(initialValues.revizuire)
  const [isSaving, setIsSaving] = useState(false)
  const [showWarningsDialog, setShowWarningsDialog] = useState(false)
  const hasAppliedPreselection = useRef(false)

  const { data: culturi = [], isLoading: culturiLoading } = useQuery({
    queryKey: ['plan-wizard', 'culturi'],
    queryFn: listCulturiPentruPlanWizardAction,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: produse = [], isLoading: produseLoading } = useQuery({
    queryKey: queryKeys.produseFitosanitare,
    queryFn: listProduseFitosanitarePentruPlanWizardAction,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: parcele = [], isLoading: parceleLoading } = useQuery({
    queryKey: [queryKeys.parcele, 'plan-wizard', infoData.cultura_tip],
    queryFn: () => listParcelePentruPlanWizardAction(infoData.cultura_tip || null),
    enabled: infoData.cultura_tip.trim().length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!preselectedParcelaId || hasAppliedPreselection.current) return
    if (!parcele.some((parcela) => parcela.id === preselectedParcelaId)) return

    setReviewData((current) => ({
      ...current,
      parcele_ids: current.parcele_ids.includes(preselectedParcelaId)
        ? current.parcele_ids
        : [...current.parcele_ids, preselectedParcelaId],
    }))
    hasAppliedPreselection.current = true
  }, [parcele, preselectedParcelaId])

  const culturiOptions = useMemo(() => {
    const values = new Set(culturi)
    if (infoData.cultura_tip.trim()) {
      values.add(infoData.cultura_tip.trim())
    }
    return [...values].sort((first, second) => first.localeCompare(second, 'ro'))
  }, [culturi, infoData.cultura_tip])

  const infoErrors = useMemo(() => getInfoErrors(infoData), [infoData])
  const reviewErrors = useMemo(() => asociereSchema.safeParse(reviewData), [reviewData])
  const grupBiologic = useMemo(
    () => getGrupBiologicDinCultura(infoData.cultura_tip),
    [infoData.cultura_tip]
  )
  const warnings = useMemo(
    () => buildWizardWarnings(liniiData, produse, reviewData.an, grupBiologic),
    [grupBiologic, liniiData, produse, reviewData.an]
  )
  const allowCohortTrigger = useMemo(
    () => needsCohortSelection(grupBiologic, configurareSezon),
    [configurareSezon, grupBiologic]
  )

  const stepValid = {
    1: Object.keys(infoErrors).length === 0,
    2: liniiData.length > 0 && liniiData.every(isLineValid),
    3: reviewErrors.success,
  } satisfies Record<WizardStep, boolean>

  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep)

  const handleContinue = () => {
    if (!stepValid[currentStep]) return
    if (currentStep === 3) {
      void handleSaveAttempt()
      return
    }

    setCurrentStep((current) => (current + 1) as WizardStep)
  }

  const performSave = async () => {
    setIsSaving(true)
    try {
      const result = await upsertPlanTratamentCuLiniiAction(
        {
          id: initialData?.id?.trim() ? initialData.id : null,
          nume: infoData.nume,
          cultura_tip: infoData.cultura_tip,
          descriere: infoData.descriere,
          activ: true,
          arhivat: false,
        },
        liniiData.map(lineToPayload),
        reviewData.parcele_ids,
        reviewData.an
      )

      await onSave(result)
    } finally {
      setIsSaving(false)
      setShowWarningsDialog(false)
    }
  }

  const handleSaveAttempt = async () => {
    if (!stepValid[3]) return
    if (warnings.length > 0) {
      setShowWarningsDialog(true)
      return
    }
    await performSave()
  }

  const currentTitle = STEPS[currentStepIndex]?.title ?? 'Wizard plan'
  const currentSubtitle = STEPS[currentStepIndex]?.subtitle ?? ''

  const content = (
    <>
      {currentStep === 1 ? (
        <PlanWizardStepInfo
          culturi={culturiOptions}
          errors={infoErrors}
          value={infoData}
          onChange={setInfoData}
        />
      ) : null}

      {currentStep === 2 ? (
        <PlanWizardStepLinii
          allowCohortTrigger={allowCohortTrigger}
          culturaTip={infoData.cultura_tip}
          grupBiologic={grupBiologic}
          linii={liniiData}
          produse={produse}
          onChange={setLiniiData}
        />
      ) : null}

      {currentStep === 3 ? (
        <PlanWizardStepRevizuire
          info={infoData}
          linii={liniiData}
          parcele={parcele}
          produse={produse}
          value={reviewData}
          warnings={warnings}
          onChange={setReviewData}
        />
      ) : null}
    </>
  )

  return (
    <>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(220px,24%)_minmax(0,1fr)] md:gap-5">
        <div className="md:sticky md:top-4 md:self-start">
          {isDesktop ? (
            <AppCard className="rounded-[24px] p-4">
              <div className="space-y-4">
                {STEPS.map((step, index) => {
                  const Icon = step.icon
                  const isActive = step.id === currentStep
                  const isCompleted = currentStep > step.id

                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={`flex w-full items-start gap-3 rounded-[20px] p-3 text-left transition ${
                        isActive
                          ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)]'
                          : 'hover:bg-[var(--surface-card-muted)]'
                      }`}
                      onClick={() => {
                        if (step.id <= currentStep || stepValid[(step.id - 1) as WizardStep]) {
                          setCurrentStep(step.id)
                        }
                      }}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          isCompleted
                            ? 'bg-[var(--agri-primary)] text-white'
                            : isActive
                              ? 'bg-[var(--surface-card)] text-[var(--agri-primary)]'
                              : 'bg-[var(--surface-card-muted)] text-[var(--text-tertiary)]'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{step.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{step.subtitle}</p>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">{index + 1}</span>
                    </button>
                  )
                })}
              </div>
            </AppCard>
          ) : (
            <div className="sticky top-0 z-20 rounded-[24px] bg-[var(--bg)]/95 pb-2 pt-1 backdrop-blur-sm">
              <AppCard className="rounded-[24px] p-3">
                <div className="flex items-center justify-between gap-3">
                  {STEPS.map((step) => {
                    const isActive = step.id === currentStep
                    const isCompleted = currentStep > step.id

                    return (
                      <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm [font-weight:650] ${
                            isCompleted
                              ? 'bg-[var(--agri-primary)] text-white'
                              : isActive
                                ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,white)] text-[var(--agri-primary)]'
                                : 'bg-[var(--surface-card-muted)] text-[var(--text-tertiary)]'
                          }`}
                        >
                          {step.id}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs text-[var(--text-primary)] [font-weight:650]">{step.title}</p>
                          <p className="truncate text-[11px] text-[var(--text-tertiary)]">{step.subtitle}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AppCard>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="space-y-4">
            <AppCard className="rounded-[24px] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Pasul {currentStep} din 3
                  </p>
                  <h1 className="text-xl tracking-[-0.03em] text-[var(--text-primary)] [font-weight:750]">
                    {currentTitle}
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">{currentSubtitle}</p>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  {culturiLoading || produseLoading || (currentStep === 3 && parceleLoading) ? (
                    <span className="text-xs text-[var(--text-tertiary)]">Se încarcă datele…</span>
                  ) : null}
                </div>
              </div>
            </AppCard>

            {content}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-4 rounded-t-[28px] bg-[var(--bg)]/96 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur-sm">
        <AppCard className="rounded-[24px] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setCurrentStep((current) => (current - 1) as WizardStep)}>
                  <ChevronLeft className="h-4 w-4" />
                  Înapoi
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Renunță
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={currentStep === 3 ? 'default' : 'outline'}
                className={currentStep === 3 ? 'bg-[var(--agri-primary)] text-white' : undefined}
                onClick={handleContinue}
                disabled={!stepValid[currentStep] || isSaving || culturiLoading || produseLoading}
              >
                {isSaving
                  ? 'Se salvează...'
                  : currentStep === 3
                    ? initialData?.id?.trim()
                      ? 'Actualizează plan'
                      : 'Salvează plan'
                    : 'Continuă'}
              </Button>
            </div>
          </div>
        </AppCard>
      </div>

      <AlertDialog open={showWarningsDialog} onOpenChange={setShowWarningsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planul are avertismente</AlertDialogTitle>
            <AlertDialogDescription>
              Planul are {warnings.length} avertisment{warnings.length === 1 ? '' : 'e'}. Poți reveni la revizuire sau îl poți salva acum.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revizuiește</AlertDialogCancel>
            <AlertDialogAction onClick={() => void performSave()}>
              Salvează oricum
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
