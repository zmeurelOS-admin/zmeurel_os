'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

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
import { Textarea } from '@/components/ui/textarea'
import { updateCultura, type Cultura } from '@/lib/supabase/queries/culturi'
import { createCultureStageLog } from '@/lib/supabase/queries/solar-tracking'
import { toast } from '@/lib/ui/toast'

const schema = z.object({
  stadiu: z.string().min(1, 'Stadiul este obligatoriu'),
  data: z.string().min(1, 'Data este obligatorie'),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface AddStadiuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  parcelaId: string | null
  onUpdated: () => void
}

const STADII = [
  { value: 'incoltit', label: '🌱 Încolțit' },
  { value: 'vegetativ', label: '🌿 Vegetativ' },
  { value: 'inflorit', label: '🌸 Înflorit' },
  { value: 'fructificare', label: '🍅 Fructificare' },
  { value: 'recoltare', label: '🫐 Recoltare' },
  { value: 'seceta', label: '☀️ Secetă' },
  { value: 'daunator', label: '🐛 Dăunător' },
  { value: 'altele', label: '📝 Altele' },
]

export function AddStadiuDialog({
  open,
  onOpenChange,
  cultura,
  parcelaId,
  onUpdated,
}: AddStadiuDialogProps) {
  const today = new Date().toISOString().slice(0, 10)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stadiu: '', data: today, observatii: '' },
  })

  useEffect(() => {
    if (open) form.reset({ stadiu: '', data: today, observatii: '' })
  }, [open, form, today])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!cultura) throw new Error('Cultură nedefinită')
      if (!parcelaId) throw new Error('Solar nedefinit')

      await Promise.all([
        updateCultura(cultura.id, { stadiu: values.stadiu }),
        createCultureStageLog({
          unitate_id: parcelaId,
          etapa: values.stadiu,
          data: values.data,
          observatii: values.observatii || undefined,
        }),
      ])
    },
    onSuccess: () => {
      toast.success('Stadiu actualizat')
      onOpenChange(false)
      onUpdated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stadiuValue = useWatch({ control: form.control, name: 'stadiu' }) || ''

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ stadiu: '', data: today, observatii: '' })
        onOpenChange(next)
      }}
      title="Adaugă stadiu cultură"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((v) => mutation.mutate(v))}
          saving={mutation.isPending}
          saveLabel="Salvează"
          cancelLabel="Anulează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        {cultura ? (
          <div
            style={{
              background: 'rgba(45,106,79,0.07)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#2D6A4F',
            }}
          >
            {[cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Stadiu *</Label>
          <Select
            value={stadiuValue}
            onValueChange={(value) => form.setValue('stadiu', value, { shouldValidate: true })}
          >
            <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
              <SelectValue placeholder="Alege stadiul" />
            </SelectTrigger>
            <SelectContent>
              {STADII.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.stadiu ? (
            <p className="text-xs text-red-600">{form.formState.errors.stadiu.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="data_stadiu">Data *</Label>
          <Input
            id="data_stadiu"
            type="date"
            className="agri-control h-12"
            {...form.register('data')}
          />
          {form.formState.errors.data ? (
            <p className="text-xs text-red-600">{form.formState.errors.data.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="observatii_stadiu">Observații (opțional)</Label>
          <Textarea
            id="observatii_stadiu"
            rows={2}
            className="agri-control w-full px-3 py-2 text-base"
            placeholder="Ex: Primele flori apărute, Atac de afide..."
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
