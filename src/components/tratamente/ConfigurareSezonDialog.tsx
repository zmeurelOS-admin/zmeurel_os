'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
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
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import {
  getSistemConducereLabel,
  getTipCicluSoiLabel,
  needsConfigurareSezon,
  type SistemConducere,
  type TipCicluSoi,
} from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

const sistemConducereOptions: Array<{ value: SistemConducere; label: string }> = [
  { value: 'primocane_only', label: getSistemConducereLabel('primocane_only') },
  { value: 'mixt_floricane_primocane', label: getSistemConducereLabel('mixt_floricane_primocane') },
]

const tipCicluOptions: Array<{ value: TipCicluSoi; label: string }> = [
  { value: 'determinat', label: getTipCicluSoiLabel('determinat') },
  { value: 'nedeterminat', label: getTipCicluSoiLabel('nedeterminat') },
]

const formSchema = z.object({
  sistem_conducere: z.string().optional(),
  tip_ciclu_soi: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface ConfigurareSezonDialogProps {
  an: number
  configurareSezon: ConfigurareSezon | null
  grupBiologic: GrupBiologic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { sistem_conducere: SistemConducere | null; tip_ciclu_soi: TipCicluSoi | null }) => Promise<void> | void
  pending?: boolean
}

function getDefaultValues(configurareSezon: ConfigurareSezon | null): FormValues {
  return {
    sistem_conducere: configurareSezon?.sistem_conducere ?? '',
    tip_ciclu_soi: configurareSezon?.tip_ciclu_soi ?? '',
  }
}

export function ConfigurareSezonDialog({
  an,
  configurareSezon,
  grupBiologic,
  open,
  onOpenChange,
  onSubmit,
  pending = false,
}: ConfigurareSezonDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const needsSeasonConfig = needsConfigurareSezon(grupBiologic)
  const defaultValues = useMemo(() => getDefaultValues(configurareSezon), [configurareSezon])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(configurareSezon))
    }
  }, [configurareSezon, form, open])

  const save = form.handleSubmit(async (values) => {
    if (!needsSeasonConfig) {
      await onSubmit({ sistem_conducere: null, tip_ciclu_soi: null })
      return
    }

    if (grupBiologic === 'rubus' && !values.sistem_conducere) {
      form.setError('sistem_conducere', { message: 'Selectează sistemul de conducere.' })
      return
    }

    if (grupBiologic === 'solanacee' && !values.tip_ciclu_soi) {
      form.setError('tip_ciclu_soi', { message: 'Selectează tipul de ciclu al soiului.' })
      return
    }

    await onSubmit({
      sistem_conducere: (values.sistem_conducere as SistemConducere | undefined) ?? null,
      tip_ciclu_soi: (values.tip_ciclu_soi as TipCicluSoi | undefined) ?? null,
    })
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      {!needsSeasonConfig ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Nu sunt necesare configurări specifice pentru această cultură.
        </p>
      ) : grupBiologic === 'rubus' ? (
        <div className="space-y-2">
          <Label>Sistem de conducere</Label>
          <Select
            value={form.watch('sistem_conducere') || undefined}
            onValueChange={(value) =>
              form.setValue('sistem_conducere', value, { shouldValidate: true, shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează sistemul" />
            </SelectTrigger>
            <SelectContent>
              {sistemConducereOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.sistem_conducere ? (
            <p className="text-xs text-[var(--status-danger-text)]">
              {form.formState.errors.sistem_conducere.message}
            </p>
          ) : null}
        </div>
      ) : grupBiologic === 'solanacee' ? (
        <div className="space-y-2">
          <Label>Tip ciclu soi</Label>
          <Select
            value={form.watch('tip_ciclu_soi') || undefined}
            onValueChange={(value) =>
              form.setValue('tip_ciclu_soi', value, { shouldValidate: true, shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează tipul de ciclu" />
            </SelectTrigger>
            <SelectContent>
              {tipCicluOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.tip_ciclu_soi ? (
            <p className="text-xs text-[var(--status-danger-text)]">
              {form.formState.errors.tip_ciclu_soi.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  )

  const footer = needsSeasonConfig ? (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={save}
      saving={pending}
      saveLabel="Salvează"
    />
  ) : (
    <div className="flex justify-end">
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-4 text-sm font-semibold text-[var(--button-muted-text)]"
        onClick={() => onOpenChange(false)}
        disabled={pending}
      >
        Închide
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Configurare sezonieră</SheetTitle>
            <p className="text-sm text-[var(--text-secondary)]">Anul {an}</p>
          </SheetHeader>
          <div className="px-4 pb-4">{content}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Configurare sezonieră"
      description={`Anul ${an}`}
      footer={footer}
      desktopFormWide
    >
      {content}
    </AppDialog>
  )
}

