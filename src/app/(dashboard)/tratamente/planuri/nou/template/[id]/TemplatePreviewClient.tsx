'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, Leaf } from 'lucide-react'

import {
  clonezaTemplateInPlanNou,
  type TemplateLiniePreview,
  type TemplatePreview,
} from '@/app/(dashboard)/tratamente/planuri/templates/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { withPlaceholderOption } from '@/lib/ui/app-select-utils'
import type { PlanWizardParcelaOption } from '@/lib/supabase/queries/tratamente'
import { getLabelPentruGrup, type StadiuCod } from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'

type TemplatePreviewClientProps = {
  linii: TemplateLiniePreview[]
  parcele: PlanWizardParcelaOption[]
  template: TemplatePreview
}

function groupLines(linii: TemplateLiniePreview[]) {
  const groups = new Map<string, TemplateLiniePreview[]>()

  for (const linie of linii) {
    const label = getLabelPentruGrup(linie.stadiu_trigger as StadiuCod, 'rubus', { cohort: linie.cohort_trigger })
    groups.set(label, [...(groups.get(label) ?? []), linie])
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

function methodIcon(method: TemplateLiniePreview['metoda_aplicare']) {
  if (method === 'fertirigare') return '💧'
  if (method === 'fertilizare_baza' || method === 'granulat_sol') return '🌾'
  if (method === 'capcana_pus' || method === 'capcana_verificat') return '🪤'
  if (method === 'foliar') return '🍃'
  return '🌱'
}

export function TemplatePreviewClient({ linii, parcele, template }: TemplatePreviewClientProps) {
  const router = useRouter()
  const [planName, setPlanName] = useState(`Plan ${template.nume} ${getCurrentSezon()}`)
  const [parcelaId, setParcelaId] = useState('')
  const [saving, setSaving] = useState(false)
  const groups = useMemo(() => groupLines(linii), [linii])
  const parcelaAppSelectOptions = useMemo(
    () =>
      withPlaceholderOption(
        parcele.map((parcela) => ({
          value: parcela.id,
          label: parcela.nume_parcela ?? parcela.id_parcela ?? parcela.id,
        })),
        { value: '', label: 'Selectează parcelă' }
      ),
    [parcele]
  )

  const handleClone = async () => {
    if (!planName.trim()) {
      toast.error('Completează numele planului.')
      return
    }

    setSaving(true)
    try {
      const result = await clonezaTemplateInPlanNou({
        templateId: template.id,
        numePlan: planName,
        parcelaId,
        an: getCurrentSezon(),
      })
      toast.success('Planul a fost creat din template.')
      router.push(`/tratamente/planuri/${result.planId}/editor`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Template-ul nu a putut fi folosit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      header={
        <PageHeader
          title={template.nume}
          subtitle={`${template.nr_interventii} intervenții · ${template.durata_sezon_estimata ?? 'sezon complet'}`}
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-0 py-3 md:grid-cols-[minmax(0,1fr)_22rem] md:py-5">
        <div className="space-y-4">
          <AppCard className="rounded-[24px] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] [font-weight:750]">
                  Despre template
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {template.descriere}
                </p>
              </div>
            </div>
          </AppCard>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] [font-weight:750]">
                Intervenții
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)] [font-weight:650]">
                <CalendarDays className="h-3.5 w-3.5" />
                {linii.length}
              </span>
            </div>

            {groups.map((group) => (
              <AppCard key={group.label} className="rounded-[24px] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <h2 className="text-sm text-[var(--text-primary)] [font-weight:750]">
                    {group.label} ({group.items.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {group.items.map((linie) => (
                    <div key={linie.id} className="rounded-2xl bg-[var(--surface-card-muted)] p-3">
                      <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                        <span aria-hidden>{methodIcon(linie.metoda_aplicare)}</span> {linie.scop}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {[linie.produs_sugerat_nume, linie.produs_sugerat_doza_text].filter(Boolean).join(' · ') || 'Fără produs sugerat'}
                      </p>
                    </div>
                  ))}
                </div>
              </AppCard>
            ))}
          </section>
        </div>

        <aside className="md:sticky md:top-4 md:self-start">
          <AppCard className="rounded-[24px] p-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-plan-name">Numele planului tău</Label>
                <Input
                  id="template-plan-name"
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder="Plan Maravilla 2026"
                />
              </div>
              <AppSelect
                id="template-plan-parcela"
                label="Asociază cu parcelă (opțional)"
                placeholder="Selectează parcelă"
                value={parcelaId}
                options={parcelaAppSelectOptions}
                showSearchThreshold={8}
                triggerClassName="h-11 rounded-xl text-sm"
                onChange={setParcelaId}
              />
              <Button
                type="button"
                className="w-full bg-[var(--agri-primary)] text-white"
                disabled={saving || !planName.trim()}
                onClick={() => void handleClone()}
              >
                {saving ? 'Se creează...' : 'Folosește acest template'}
              </Button>
            </div>
          </AppCard>
        </aside>
      </div>
    </AppShell>
  )
}
