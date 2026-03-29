'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { desfiinteazaCultura, type Cultura } from '@/lib/supabase/queries/culturi'
import { toast } from '@/lib/ui/toast'

const schema = z.object({
  data_desfiintare: z.string().min(1, 'Data desființării este obligatorie'),
  motiv_desfiintare: z.string(),
})

type FormValues = z.infer<typeof schema>

interface DesfiinteazaCulturaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  onDesfiintat: () => void
}

export function DesfiinteazaCulturaDialog({
  open,
  onOpenChange,
  cultura,
  onDesfiintat,
}: DesfiinteazaCulturaDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      data_desfiintare: new Date().toISOString().slice(0, 10),
      motiv_desfiintare: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        data_desfiintare: new Date().toISOString().slice(0, 10),
        motiv_desfiintare: '',
      })
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!cultura) throw new Error('Cultură lipsă')
      return desfiinteazaCultura(cultura.id, {
        data_desfiintare: values.data_desfiintare,
        motiv_desfiintare: values.motiv_desfiintare || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Cultura a fost desființată și marcată ca inactivă.')
      onOpenChange(false)
      onDesfiintat()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  if (!cultura) return null

  const culturaNume = [cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desființează cultură"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => mutation.mutate(values))}
          saving={mutation.isPending}
          cancelLabel="Renunță"
          saveLabel="Desființează"
        />
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">⚠️ {culturaNume}</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Cultura va fi marcată ca inactivă și nu va fi ștearsă din baza de date. Toate datele
            istorice (recoltări, activități, etape) rămân intacte.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="data_desfiintare">Data desființării *</Label>
            <Input
              id="data_desfiintare"
              type="date"
              className="agri-control h-12"
              {...form.register('data_desfiintare')}
            />
            {form.formState.errors.data_desfiintare ? (
              <p className="text-xs text-red-600">
                {form.formState.errors.data_desfiintare.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="motiv_desfiintare">Motiv (opțional)</Label>
            <Textarea
              id="motiv_desfiintare"
              rows={3}
              className="agri-control w-full px-3 py-2 text-base"
              placeholder="Ex: Boală, Îngheț, Rotație culturi..."
              {...form.register('motiv_desfiintare')}
            />
          </div>
        </form>
      </div>
    </AppDialog>
  )
}
