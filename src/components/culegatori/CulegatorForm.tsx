'use client'

import { type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { CulegatorFormSummary, type CulegatorDialogActivitySummary } from '@/components/culegatori/CulegatorFormSummary'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const culegatorSchema = z.object({
  nume_prenume: z.string().trim().min(2, 'Numele trebuie să aibă minimum 2 caractere'),
  telefon: z.string().optional(),
  tip_angajare: z.string().min(1, 'Selectează tipul de angajare'),
  tarif_lei_kg: z.string().optional(),
  data_angajare: z.string().optional(),
  status_activ: z.boolean(),
  observatii: z.string().optional(),
})

export type CulegatorFormData = z.infer<typeof culegatorSchema>

export function getCulegatorFormDefaults(): CulegatorFormData {
  return {
    nume_prenume: '',
    telefon: '',
    tip_angajare: 'Sezonier',
    tarif_lei_kg: '0',
    data_angajare: '',
    status_activ: true,
    observatii: '',
  }
}

interface CulegatorFormProps {
  form: UseFormReturn<CulegatorFormData>
  mode: 'create' | 'edit'
  recordCode?: string
  activitySummary?: CulegatorDialogActivitySummary | null
}

export function CulegatorForm({
  form,
  mode,
  recordCode,
  activitySummary = null,
}: CulegatorFormProps) {
  const watched = form.watch()

  return (
    <DesktopFormGrid
      className="md:grid-cols-[minmax(0,1fr)_17rem] md:gap-3.5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4"
      aside={
        <CulegatorFormSummary
          title={watched.nume_prenume}
          phone={watched.telefon}
          employmentType={watched.tip_angajare}
          rate={watched.tarif_lei_kg}
          startDate={watched.data_angajare}
          active={Boolean(watched.status_activ)}
          observations={watched.observatii}
          mode={mode}
          recordCode={recordCode}
          activitySummary={activitySummary}
        />
      }
    >
      <FormDialogSection>
        <DesktopFormPanel>
          <div className="grid gap-3 md:grid-cols-2 md:gap-x-3 md:gap-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_nume' : 'culegator_nume'}>Nume și prenume</Label>
              <Input
                id={mode === 'edit' ? 'edit_culegator_nume' : 'culegator_nume'}
                className="agri-control h-11 md:h-10"
                placeholder="Popescu Ion"
                {...form.register('nume_prenume')}
              />
              {form.formState.errors.nume_prenume ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.nume_prenume.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_telefon' : 'culegator_telefon'}>Telefon</Label>
              <Input
                id={mode === 'edit' ? 'edit_culegator_telefon' : 'culegator_telefon'}
                type="tel"
                className="agri-control h-11 md:h-10"
                placeholder="0740123456"
                {...form.register('telefon')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_tip' : 'culegator_tip'}>Tip angajare</Label>
              <select
                id={mode === 'edit' ? 'edit_culegator_tip' : 'culegator_tip'}
                className="agri-control h-11 w-full px-3 text-base md:h-10 md:text-sm"
                {...form.register('tip_angajare')}
              >
                <option value="Sezonier">🍓 Sezonier</option>
                <option value="Permanent">🧑‍🌾 Permanent</option>
                <option value="Zilier">📅 Zilier</option>
                <option value="Colaborator">🤝 Colaborator</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_tarif' : 'culegator_tarif'}>Tarif (lei/kg)</Label>
              <Input
                id={mode === 'edit' ? 'edit_culegator_tarif' : 'culegator_tarif'}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="agri-control h-11 md:h-10"
                placeholder="0"
                {...form.register('tarif_lei_kg')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_data' : 'culegator_data'}>Data angajare</Label>
              <Input
                id={mode === 'edit' ? 'edit_culegator_data' : 'culegator_data'}
                type="date"
                className="agri-control h-11 md:h-10"
                {...form.register('data_angajare')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_activ' : 'culegator_activ'}>Status</Label>
              <label
                htmlFor={mode === 'edit' ? 'edit_culegator_activ' : 'culegator_activ'}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
              >
                <input
                  id={mode === 'edit' ? 'edit_culegator_activ' : 'culegator_activ'}
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                  checked={Boolean(watched.status_activ)}
                  onChange={(event) => form.setValue('status_activ', event.target.checked, { shouldDirty: true })}
                />
                <span>Culegător activ</span>
              </label>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={mode === 'edit' ? 'edit_culegator_obs' : 'culegator_obs'}>Observații</Label>
              <Textarea
                id={mode === 'edit' ? 'edit_culegator_obs' : 'culegator_obs'}
                rows={3}
                className="agri-control min-h-[4.5rem] w-full px-3 py-2 text-base md:min-h-[5rem]"
                placeholder="Detalii utile despre colaborare"
                {...form.register('observatii')}
              />
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )
}
