'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { AppSelect } from '@/components/ui/app-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import {
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import {
  buildStadiuAppSelectOptions,
  COHORTA_REQUIRED_APP_SELECT_OPTIONS,
  formatStadiuOptionLabel,
} from '@/lib/ui/app-select-maps'

const sursaValues = ['manual', 'gdd', 'poza'] as const

const formSchema = z.object({
  stadiu: z.string().trim().min(1, 'Selectează o fenofază.'),
  cohort: z.enum(['floricane', 'primocane']).optional(),
  data_observata: z.string().trim().min(1, 'Data observării este obligatorie.'),
  sursa: z.enum(sursaValues, {
    message: 'Selectează sursa.',
  }),
  observatii: z.string().optional(),
})

export type RecordStadiuFormValues = z.infer<typeof formSchema>

interface RecordStadiuSheetProps {
  an: number
  /** Cohorta precompletată din contextul deschiderii (ex. click pe card Floricane/Primocane). */
  defaultCohort?: Cohorta
  cohortPreselectat?: Cohorta
  configurareSezon?: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  isRubusMixt?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: RecordStadiuFormValues) => Promise<void> | void
  pending?: boolean
  suggestedStadiu?: string | null
}

const SURSA_OPTIONS: Array<{ value: (typeof sursaValues)[number]; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'gdd', label: 'GDD' },
  { value: 'poza', label: 'Poză' },
]

function resolveSuggestedStadiu(
  availableStadii: readonly StadiuCod[],
  suggestedStadiu?: string | null
): StadiuCod {
  const fallback = availableStadii[0] ?? 'repaus_vegetativ'
  const normalized = suggestedStadiu ? normalizeStadiu(suggestedStadiu) : null
  return normalized && availableStadii.includes(normalized) ? normalized : fallback
}

function getDefaultValues(
  availableStadii: readonly StadiuCod[],
  suggestedStadiu?: string | null,
  cohortPreselectat?: Cohorta
): RecordStadiuFormValues {
  return {
    stadiu: resolveSuggestedStadiu(availableStadii, suggestedStadiu),
    cohort: cohortPreselectat,
    data_observata: new Date().toISOString().slice(0, 10),
    sursa: 'manual',
    observatii: '',
  }
}

export function RecordStadiuSheet({
  an,
  defaultCohort,
  cohortPreselectat,
  configurareSezon,
  grupBiologic,
  isRubusMixt = false,
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  suggestedStadiu,
}: RecordStadiuSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const resolvedCohortPreselectat = cohortPreselectat ?? defaultCohort
  const availableStadii = useMemo(() => listStadiiPentruGrup(grupBiologic), [grupBiologic])
  const defaultValues = useMemo(
    () => getDefaultValues(availableStadii, suggestedStadiu, resolvedCohortPreselectat),
    [availableStadii, resolvedCohortPreselectat, suggestedStadiu]
  )
  const form = useForm<RecordStadiuFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const selectedStadiu = useWatch({ control: form.control, name: 'stadiu' })
  const selectedSursa = useWatch({ control: form.control, name: 'sursa' })
  const selectedCohort = useWatch({ control: form.control, name: 'cohort' })
  const cohortValue = selectedCohort ?? resolvedCohortPreselectat
  const stadiiOptions = useMemo(
    () =>
      availableStadii.map((value) => ({
        value,
        label: getLabelStadiuContextual(value, configurareSezon ?? null, {
          grupBiologic,
          cohort: cohortValue ?? null,
        }),
      })),
    [availableStadii, configurareSezon, grupBiologic, cohortValue]
  )

  const stadiuAppSelectOptions = useMemo(() => {
    const emojiByCod = Object.fromEntries(
      getStadiuOptions(grupBiologic).map((option) => [option.value, option.emoji])
    )
    return buildStadiuAppSelectOptions(
      stadiiOptions.map((option) => ({
        value: option.value,
        label: option.label,
        emoji: emojiByCod[option.value],
      })),
      'Selectează fenofaza'
    )
  }, [grupBiologic, stadiiOptions])

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(availableStadii, suggestedStadiu, resolvedCohortPreselectat))
    }
  }, [availableStadii, form, open, resolvedCohortPreselectat, suggestedStadiu])

  const save = form.handleSubmit(async (values) => {
    if (isRubusMixt && !values.cohort) {
      form.setError('cohort', { type: 'manual', message: 'Selectează cohorta.' })
      return
    }
    await onSubmit(values)
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      {isRubusMixt ? (
        <AppSelect
          id="record-stadiu-cohort"
          label="Coortă"
          placeholder="Selectează cohorta"
          value={cohortValue ?? ''}
          onChange={(value) =>
            form.setValue('cohort', value as Cohorta, { shouldValidate: true })
          }
          options={COHORTA_REQUIRED_APP_SELECT_OPTIONS}
          error={form.formState.errors.cohort?.message}
        />
      ) : null}

      <AppSelect
        id="record-stadiu-fenofaza"
        label="Fenofază"
        placeholder="Selectează fenofaza"
        value={selectedStadiu ?? ''}
        onChange={(value) => form.setValue('stadiu', value, { shouldValidate: true })}
        options={stadiuAppSelectOptions}
        getOptionDisplayLabel={formatStadiuOptionLabel}
        error={form.formState.errors.stadiu?.message}
      />

      <div className="space-y-2">
        <Label htmlFor="record-stadiu-data">Data observării</Label>
        <Input id="record-stadiu-data" type="date" {...form.register('data_observata')} />
        {form.formState.errors.data_observata ? (
          <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.data_observata.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Sursa</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SURSA_OPTIONS.map((option) => {
            const checked = selectedSursa === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  checked
                    ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_9%,var(--surface-card))] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                }`}
                onClick={() => form.setValue('sursa', option.value, { shouldValidate: true })}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="record-stadiu-observatii">Observații</Label>
        <Textarea
          id="record-stadiu-observatii"
          rows={3}
          placeholder="Ex: Observat la marginea parcelei, după ploaie."
          {...form.register('observatii')}
        />
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-2xl">
          <SheetHeader>
        <SheetTitle>Actualizează fenofaza</SheetTitle>
            <p className="text-sm text-[var(--text-secondary)]">Înregistrare pentru anul {an}</p>
          </SheetHeader>
          <div className="px-4 pb-4">{content}</div>
          <SheetFooter>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-4 text-sm font-semibold text-[var(--button-muted-text)]"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Anulează
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Se salvează...' : 'Salvează'}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Actualizează fenofaza"
      description={`Înregistrare pentru anul ${an}`}
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={pending}
        />
      }
    >
      {content}
    </AppDialog>
  )
}
