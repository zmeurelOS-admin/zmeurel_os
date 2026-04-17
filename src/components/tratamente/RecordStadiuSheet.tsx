'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { STADII_ORDINE } from '@/lib/tratamente/stadiu-ordering'

const sursaValues = ['manual', 'gdd', 'poza'] as const

const formSchema = z.object({
  stadiu: z.string().trim().min(1, 'Selectează un stadiu.'),
  data_observata: z.string().trim().min(1, 'Data observării este obligatorie.'),
  sursa: z.enum(sursaValues, {
    message: 'Selectează sursa.',
  }),
  observatii: z.string().optional(),
})

export type RecordStadiuFormValues = z.infer<typeof formSchema>

interface RecordStadiuSheetProps {
  an: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: RecordStadiuFormValues) => Promise<void> | void
  pending?: boolean
  suggestedStadiu?: string | null
}

const STADII_OPTIONS = Object.entries(STADII_ORDINE)
  .sort((a, b) => a[1].ordine - b[1].ordine)
  .map(([value, config]) => ({ value, label: config.label }))

const SURSA_OPTIONS: Array<{ value: (typeof sursaValues)[number]; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'gdd', label: 'GDD' },
  { value: 'poza', label: 'Poză' },
]

function getDefaultValues(suggestedStadiu?: string | null): RecordStadiuFormValues {
  return {
    stadiu: suggestedStadiu || 'repaus',
    data_observata: new Date().toISOString().slice(0, 10),
    sursa: 'manual',
    observatii: '',
  }
}

export function RecordStadiuSheet({
  an,
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  suggestedStadiu,
}: RecordStadiuSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const defaultValues = useMemo(() => getDefaultValues(suggestedStadiu), [suggestedStadiu])
  const form = useForm<RecordStadiuFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const selectedStadiu = useWatch({ control: form.control, name: 'stadiu' })
  const selectedSursa = useWatch({ control: form.control, name: 'sursa' })

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(suggestedStadiu))
    }
  }, [form, open, suggestedStadiu])

  const save = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      <div className="space-y-2">
        <Label>Stadiu</Label>
        <Select
          value={selectedStadiu}
          onValueChange={(value) => form.setValue('stadiu', value, { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selectează stadiul" />
          </SelectTrigger>
          <SelectContent>
            {STADII_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.stadiu ? (
          <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.stadiu.message}</p>
        ) : null}
      </div>

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
            <SheetTitle>Actualizează stadiu</SheetTitle>
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
      title="Actualizează stadiu"
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
