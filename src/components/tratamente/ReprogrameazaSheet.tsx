'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
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

const formSchema = z.object({
  data_planificata: z.string().trim().min(1, 'Data nouă este obligatorie.'),
  motiv: z.string().optional(),
})

export type ReprogrameazaFormValues = z.infer<typeof formSchema>

interface ReprogrameazaSheetProps {
  defaultDate: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ReprogrameazaFormValues) => Promise<void> | void
  open: boolean
  pending?: boolean
}

export function ReprogrameazaSheet({
  defaultDate,
  onOpenChange,
  onSubmit,
  open,
  pending = false,
}: ReprogrameazaSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const form = useForm<ReprogrameazaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data_planificata: defaultDate,
      motiv: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({ data_planificata: defaultDate, motiv: '' })
    }
  }, [defaultDate, form, open])

  const save = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      <div className="space-y-2">
        <Label htmlFor="replanificare-data">Data nouă</Label>
        <Input id="replanificare-data" type="date" {...form.register('data_planificata')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="replanificare-motiv">Observații</Label>
        <Textarea id="replanificare-motiv" rows={4} {...form.register('motiv')} />
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] rounded-none">
          <SheetHeader>
            <SheetTitle>Reprogramează aplicarea</SheetTitle>
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
      title="Reprogramează aplicarea"
      footer={<DialogFormActions onCancel={() => onOpenChange(false)} onSave={save} saving={pending} />}
    >
      {content}
    </AppDialog>
  )
}
