'use client'

import { useMemo } from 'react'
import { Sprout, TreePine, Warehouse } from 'lucide-react'
import { type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { ActivityTypeCombobox } from '@/components/activitati-agricole/ActivityTypeCombobox'
import {
  DesktopFormAside,
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  formatActivityTypeLabel,
  type ActivityOption,
} from '@/lib/activitati/activity-options'
export const activitateAgricolaFormSchema = z.object({
  data_aplicare: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  tip_activitate: z.string().min(1, 'Tipul activității este obligatoriu'),
  produs_utilizat: z.string().optional(),
  doza: z.string().optional(),
  timp_pauza_zile: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Timpul de pauză trebuie să fie un număr valid',
    }),
  observatii: z.string().optional(),
})

export type ActivitateAgricolaFormValues = z.infer<typeof activitateAgricolaFormSchema>

export function getActivitateAgricolaFormDefaults(): ActivitateAgricolaFormValues {
  return {
    data_aplicare: new Date().toISOString().split('T')[0],
    parcela_id: '',
    tip_activitate: '',
    produs_utilizat: '',
    doza: '',
    timp_pauza_zile: '0',
    observatii: '',
  }
}

export interface ActivitateAgricolaParcelaOption {
  id: string
  nume_parcela: string | null
  tip_unitate?: string | null
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeUnitType(value: string | null | undefined): 'solar' | 'livada' | 'camp' | 'other' {
  const normalized = normalizeText(value)
  if (!normalized) return 'other'
  if (normalized.includes('solar') || normalized.includes('sera')) return 'solar'
  if (normalized.includes('livada') || normalized.includes('livad')) return 'livada'
  if (normalized.includes('camp') || normalized.includes('cultura')) return 'camp'
  return 'other'
}

function getUnitIcon(tipUnitate: string | null | undefined) {
  const unitType = normalizeUnitType(tipUnitate)
  if (unitType === 'solar') {
    return <Warehouse className="h-3.5 w-3.5 text-[var(--status-info-text)]" aria-hidden />
  }
  if (unitType === 'livada') {
    return <TreePine className="h-3.5 w-3.5 text-[var(--status-success-text)]" aria-hidden />
  }
  if (unitType === 'camp') {
    return <Sprout className="h-3.5 w-3.5 text-[var(--status-warning-text)]" aria-hidden />
  }
  return <Sprout className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
}

function formatTerrainLabel(parcela: ActivitateAgricolaParcelaOption | null | undefined): string {
  if (!parcela) return '—'
  return parcela.tip_unitate ? `${parcela.nume_parcela || 'Teren'} (${parcela.tip_unitate})` : parcela.nume_parcela || 'Teren'
}

function formatDateLabel(value: string | null | undefined): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  const parsed = new Date(current)
  if (Number.isNaN(parsed.getTime())) return current
  return parsed.toLocaleDateString('ro-RO')
}

function ActivityAgricolaFormSummary({
  dataLabel,
  terrainLabel,
  activityLabel,
  notesLabel,
}: {
  dataLabel: string
  terrainLabel: string
  activityLabel: string
  notesLabel: string
}) {
  return (
    <DesktopFormAside title="Rezumat activitate" className="md:rounded-[22px] md:p-4 lg:p-[1.125rem]">
      <dl className="space-y-1.5 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{dataLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Teren</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{terrainLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip operațiune</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{activityLabel}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Note</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-[var(--text-primary)]">{notesLabel}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}

interface ActivitateAgricolaFormProps {
  form: UseFormReturn<ActivitateAgricolaFormValues>
  parcele: ActivitateAgricolaParcelaOption[]
  activityOptions: ActivityOption[]
  selectedParcelaId: string
  selectedTip: string
  contextParcelaLabel?: string | null
}

export function ActivitateAgricolaForm({
  form,
  parcele,
  activityOptions,
  selectedParcelaId,
  selectedTip,
  contextParcelaLabel,
}: ActivitateAgricolaFormProps) {
  const selectedTerrain = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId) ?? null,
    [parcele, selectedParcelaId]
  )
  const terrainOptions = useMemo(
    () => [
      { value: '', label: 'Selectează teren' },
      ...parcele.map((parcela) => ({
        value: parcela.id,
        label: formatTerrainLabel(parcela),
      })),
    ],
    [parcele]
  )
  const observedDate = form.watch('data_aplicare')
  const observedNotes = form.watch('observatii')
  const notesLabel = observedNotes?.trim() ? observedNotes.trim() : '—'
  const terrainLabel = selectedTerrain ? formatTerrainLabel(selectedTerrain) : contextParcelaLabel?.trim() || '—'

  return (
    <DesktopFormGrid
      className="md:grid-cols-[minmax(0,1fr)_16.5rem] md:gap-3.5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]"
      aside={
        <ActivityAgricolaFormSummary
          dataLabel={formatDateLabel(observedDate)}
          terrainLabel={terrainLabel}
          activityLabel={formatActivityTypeLabel(selectedTip)}
          notesLabel={notesLabel}
        />
      }
    >
      <FormDialogSection>
        <DesktopFormPanel>
          <div className="grid gap-3 md:grid-cols-2 md:gap-3">
            <AppDatePicker
              id="act_data"
              label="Data aplicare"
              placeholder="Selectează data"
              value={observedDate ?? ''}
              triggerClassName="h-11 md:h-10"
              onChange={(nextValue) =>
                form.setValue('data_aplicare', nextValue, { shouldDirty: true, shouldValidate: true })
              }
              error={form.formState.errors.data_aplicare?.message}
            />

            <AppSelect
              id="act_parcela"
              label="Teren"
              placeholder="Selectează teren"
              value={selectedParcelaId}
              options={terrainOptions}
              showSearchThreshold={10}
              searchPlaceholder="Caută teren..."
              triggerClassName="h-11 text-[15px] md:h-10"
              listClassName="max-h-72"
              menuClassName="w-[var(--radix-popover-trigger-width)]"
              onChange={(nextValue) =>
                form.setValue('parcela_id', nextValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              getOptionLeadingIcon={(option) => {
                if (!option.value) {
                  return <Sprout className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
                }
                const parcela = parcele.find((item) => item.id === option.value)
                return parcela ? getUnitIcon(parcela.tip_unitate) : null
              }}
            />

            <div className="space-y-1.5 md:col-span-2">
              <ActivityTypeCombobox
                id="act_tip"
                label="Tip operațiune"
                options={activityOptions}
                value={selectedTip}
                showSearchThreshold={12}
                triggerClassName="h-11 text-[15px] md:h-10"
                listClassName="max-h-72"
                menuClassName="w-[var(--radix-popover-trigger-width)]"
                onChange={(nextValue) =>
                  form.setValue('tip_activitate', nextValue, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.tip_activitate?.message}
                getOptionDisplayLabel={(option) => formatActivityTypeLabel(option.label)}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="act_obs">Note</Label>
              <Textarea
                id="act_obs"
                rows={3}
                className="agri-control min-h-[4.5rem] w-full px-3 py-2 text-base md:min-h-[5rem]"
                placeholder="Detalii utile despre operațiune"
                {...form.register('observatii')}
              />
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )
}
