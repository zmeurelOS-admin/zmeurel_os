'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Layers3, ListChecks, Sprout } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import {
  listParcelePentruPlanWizardAction,
  listProduseFitosanitarePentruPlanWizardAction,
  upsertPlanTratamentCuLiniiAction,
} from '@/app/(dashboard)/tratamente/planuri/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { withPlaceholderOption } from '@/lib/ui/app-select-utils'
import { queryKeys } from '@/lib/query-keys'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'

import { PlanWizard } from './PlanWizard'
import {
  buildTemplateWizardValues,
  groupTemplateLinesByStage,
  PLAN_TEMPLATES,
  type PlanTemplate,
} from './templates'
import { lineToPayload } from './types'

interface PlanTemplateStartScreenProps {
  configurareSezon?: ConfigurareSezon | null
  preselectedParcelaId?: string
}

const currentYear = getCurrentSezon()

function defaultTemplatePlanName(template: PlanTemplate) {
  return `Plan ${template.title} ${currentYear}`
}

export function PlanTemplateStartScreen({
  configurareSezon,
  preselectedParcelaId,
}: PlanTemplateStartScreenProps) {
  const router = useRouter()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [planName, setPlanName] = useState('')
  const [selectedParcelaId, setSelectedParcelaId] = useState(preselectedParcelaId ?? '')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [showBlankWizard, setShowBlankWizard] = useState(false)

  const selectedTemplate = useMemo(
    () => PLAN_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  )

  const { data: produse = [], isLoading: produseLoading } = useQuery({
    queryKey: queryKeys.produseFitosanitare,
    queryFn: listProduseFitosanitarePentruPlanWizardAction,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: parcele = [], isLoading: parceleLoading } = useQuery({
    queryKey: [queryKeys.parcele, 'plan-template-start', 'zmeur'],
    queryFn: () => listParcelePentruPlanWizardAction('zmeur'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const previewGroups = selectedTemplate ? groupTemplateLinesByStage(selectedTemplate) : []
  const parcelaAppSelectOptions = useMemo(
    () =>
      withPlaceholderOption(
        parcele.map((parcela) => ({
          value: parcela.id,
          label: parcela.nume_parcela ?? parcela.id,
        })),
        { value: '', label: 'Alege parcela' }
      ),
    [parcele]
  )
  const canUseTemplate =
    Boolean(selectedTemplate) &&
    planName.trim().length > 0 &&
    selectedParcelaId.trim().length > 0 &&
    !produseLoading &&
    !parceleLoading &&
    !isSavingTemplate

  const handleSelectTemplate = (template: PlanTemplate) => {
    setSelectedTemplateId(template.id)
    setPlanName((current) => current.trim() || defaultTemplatePlanName(template))
    setShowBlankWizard(false)
  }

  const handleUseTemplate = async () => {
    if (!selectedTemplate || !canUseTemplate) return

    setIsSavingTemplate(true)
    try {
      const values = buildTemplateWizardValues(selectedTemplate, produse, {
        an: currentYear,
        nume: planName,
        parcelaId: selectedParcelaId,
      })
      const result = await upsertPlanTratamentCuLiniiAction(
        {
          id: null,
          nume: values.info.nume,
          cultura_tip: values.info.cultura_tip,
          descriere: values.info.descriere,
          activ: true,
          arhivat: false,
        },
        values.linii.map(lineToPayload),
        values.revizuire.parcele_ids,
        values.revizuire.an
      )

      toast.success('Planul a fost creat din template.')
      router.push(`/tratamente/planuri/${result.id}/editeaza`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Planul nu a putut fi creat.')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  if (showBlankWizard) {
    return (
      <AppShell header={<PageHeader title="Plan gol" subtitle="Pornește de la zero, fără template" expandRightSlotOnMobile />}>
        <div className="mx-auto w-full max-w-7xl px-0 py-3 md:py-4">
          <PlanWizard
            configurareSezon={configurareSezon}
            preselectedParcelaId={preselectedParcelaId}
            onCancel={() => setShowBlankWizard(false)}
            onSave={(result) => {
              toast.success('Planul de tratament a fost salvat.')
              router.push(`/tratamente/planuri/${result.id}/editeaza`)
              router.refresh()
            }}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Plan nou"
          subtitle="Alege un template local sau pornește de la un plan gol"
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-0 py-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:py-4">
        <section className="space-y-4">
          <AppCard className="rounded-[24px] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]">
                <Sprout className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:750]">
                  Template-uri tratamente
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Catalog local pentru Sprint 6. Nu mai depindem de fișiere externe.
                </p>
              </div>
            </div>
          </AppCard>

          <div className="grid gap-3">
            {PLAN_TEMPLATES.map((template) => {
              const isActive = selectedTemplateId === template.id

              return (
                <button
                  key={template.id}
                  type="button"
                  className={`w-full rounded-[24px] bg-[var(--surface-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985] ${
                    isActive ? 'ring-2 ring-[var(--agri-primary)]' : ''
                  }`}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base text-[var(--text-primary)] [font-weight:750]">{template.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{template.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] px-3 py-1 text-xs text-[var(--agri-primary)] [font-weight:650]">
                      {template.badge}
                    </span>
                  </div>
                </button>
              )
            })}

            <button
              type="button"
              className="w-full rounded-[24px] bg-[var(--surface-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]"
              onClick={() => {
                setSelectedTemplateId(null)
                setShowBlankWizard(true)
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
                  <FilePlus2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-base text-[var(--text-primary)] [font-weight:750]">Plan gol</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Intră în wizard fără intervenții precompletate.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {selectedTemplate ? (
            <>
              <AppCard className="rounded-[24px] p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:750]">
                        Preview {selectedTemplate.title}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {selectedTemplate.lines.length} intervenții grupate pe fenofază.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan-template-name">Nume plan</Label>
                      <Input
                        id="plan-template-name"
                        value={planName}
                        onChange={(event) => setPlanName(event.target.value)}
                        placeholder="Plan Maravilla 2026"
                      />
                    </div>
                    <AppSelect
                      id="plan-template-parcela"
                      label="Parcelă"
                      placeholder="Alege parcela"
                      value={selectedParcelaId}
                      options={parcelaAppSelectOptions}
                      showSearchThreshold={8}
                      triggerClassName="h-10 rounded-xl text-sm"
                      onChange={setSelectedParcelaId}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-[var(--agri-primary)] text-white sm:w-auto"
                    onClick={() => void handleUseTemplate()}
                    disabled={!canUseTemplate}
                  >
                    {isSavingTemplate ? 'Se creează planul...' : 'Folosește template'}
                  </Button>
                </div>
              </AppCard>

              <div className="space-y-3">
                {previewGroups.map((group) => (
                  <AppCard key={group.label} className="rounded-[24px] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm text-[var(--text-primary)] [font-weight:750]">{group.label}</h3>
                      <span className="rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)] [font-weight:650]">
                        {group.lines.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.lines.map((line, index) => (
                        <div key={`${group.label}-${index}`} className="rounded-2xl bg-[var(--surface-card-muted)] p-3">
                          <div className="flex items-start gap-2">
                            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                            <div className="min-w-0">
                              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{line.scop}</p>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                {line.produse.map((produs) => produs.numeComercial).join(' + ')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AppCard>
                ))}
              </div>
            </>
          ) : (
            <AppCard className="rounded-[24px] p-5">
              <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:750]">
                Selectează un template
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Preview-ul și câmpurile de creare apar aici după alegerea unui template.
              </p>
            </AppCard>
          )}
        </section>
      </div>
    </AppShell>
  )
}
