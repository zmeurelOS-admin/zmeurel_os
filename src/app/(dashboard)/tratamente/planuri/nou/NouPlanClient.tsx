'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, FilePlus2, Leaf, Sparkles } from 'lucide-react'

import { creeazaPlanGolAction } from '@/app/(dashboard)/tratamente/planuri/actions'
import type { TemplatePreview } from '@/app/(dashboard)/tratamente/planuri/templates/actions'
import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/ui/toast'

type NouPlanClientProps = {
  culturi: string[]
  templates: TemplatePreview[]
}

function cohortLabel(cohort: TemplatePreview['cohort']) {
  if (cohort === 'primocane') return 'Primocane'
  if (cohort === 'floricane') return 'Floricane'
  return 'Mixt'
}

export function NouPlanClient({ culturi, templates }: NouPlanClientProps) {
  const router = useRouter()
  const [blankOpen, setBlankOpen] = useState(false)
  const [blankName, setBlankName] = useState('')
  const [blankCulture, setBlankCulture] = useState(culturi[0] ?? 'zmeur')
  const [savingBlank, setSavingBlank] = useState(false)

  const handleCreateBlank = async () => {
    if (!blankName.trim()) {
      toast.error('Completează numele planului.')
      return
    }

    setSavingBlank(true)
    try {
      const result = await creeazaPlanGolAction({
        nume: blankName,
        culturaTip: blankCulture,
      })
      toast.success('Planul gol a fost creat.')
      router.push(`/tratamente/planuri/${result.planId}/editor`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Planul nu a putut fi creat.')
    } finally {
      setSavingBlank(false)
    }
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Adaugă plan"
          subtitle="Alege de unde pornești"
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6 px-0 py-3 md:py-5">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] [font-weight:750]">
            <Sparkles className="h-4 w-4 text-[var(--agri-primary)]" />
            Recomandat — pornești rapid
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template, index) => (
              <button
                key={template.id}
                type="button"
                className="w-full rounded-[24px] bg-[var(--surface-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]"
                onClick={() => router.push(`/tratamente/planuri/nou/template/${template.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]">
                    <Leaf className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base text-[var(--text-primary)] [font-weight:750]">{template.nume}</h2>
                      {index === 0 ? (
                        <span className="rounded-full bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] px-2.5 py-1 text-[11px] text-[var(--agri-primary)] [font-weight:750]">
                          Cel mai folosit
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {template.descriere ?? `Template pentru ${template.cultura_tip}.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)] [font-weight:650]">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {template.nr_interventii} intervenții
                      </span>
                      <span className="rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)] [font-weight:650]">
                        {cohortLabel(template.cohort)}
                      </span>
                      <span className="rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)] [font-weight:650]">
                        Editabil
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] [font-weight:750]">
            Avansat
          </p>
          <button
            type="button"
            className="w-full rounded-[24px] bg-[var(--surface-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]"
            onClick={() => setBlankOpen(true)}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
                <FilePlus2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base text-[var(--text-primary)] [font-weight:750]">Plan gol</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Construiești de la zero, intervenție cu intervenție.
                </p>
              </div>
            </div>
          </button>
        </section>
      </div>

      <AppDialog
        open={blankOpen}
        onOpenChange={setBlankOpen}
        title="Plan gol"
        description="Completează datele minime și continuă în editor."
        footer={
          <DialogFormActions
            onCancel={() => setBlankOpen(false)}
            onSave={() => void handleCreateBlank()}
            saveLabel="Creează plan"
            saving={savingBlank}
            disabled={savingBlank || !blankName.trim()}
          />
        }
        showCloseButton
        desktopFormCompact
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blank-plan-name">Nume plan</Label>
            <Input
              id="blank-plan-name"
              value={blankName}
              onChange={(event) => setBlankName(event.target.value)}
              placeholder="Plan Maravilla 2026"
            />
          </div>
          <AppSelect
            id="blank-plan-culture"
            label="Cultură"
            value={blankCulture}
            options={(culturi.length > 0 ? culturi : ['zmeur']).map((cultura) => ({
              value: cultura,
              label: cultura,
              emoji: '🌱',
            }))}
            triggerClassName="h-11 rounded-xl text-sm"
            onChange={setBlankCulture}
          />
        </div>
      </AppDialog>
    </AppShell>
  )
}
