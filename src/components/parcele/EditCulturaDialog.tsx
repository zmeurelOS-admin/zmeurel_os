'use client'

// FLUX LEGACY SOLAR — decuplat de modulul Tratamente.
// Scrie în culturi.stadiu și culture_stage_logs.
// Nu modifica fără plan explicit de migrare.
// Vezi AGENTS.md secțiunea "Fluxuri legacy".

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { NumericField } from '@/components/app/NumericField'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CUSTOM_CULTURA_OPTION,
  getCulturaFieldConfig,
  getCulturiOptions,
  getTipPlantaPlaceholder,
  getTipPlantaSelectValue,
} from '@/lib/parcele/culturi'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateCultura, type Cultura } from '@/lib/supabase/queries/culturi'
import { toast } from '@/lib/ui/toast'

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())

const schema = z.object({
  tip_planta: z.string().trim().min(1, 'Tipul plantei este obligatoriu'),
  soi: z.string(),
  suprafata_ocupata: z
    .string()
    .trim()
    .refine((v) => !v || (Number.isFinite(toDecimal(v)) && toDecimal(v) > 0), {
      message: 'Suprafața trebuie să fie un număr pozitiv',
    }),
  nr_plante: z
    .string()
    .trim()
    .refine((v) => !v || Number.isInteger(Number(v)), {
      message: 'Numărul de plante trebuie să fie întreg',
    }),
  nr_randuri: z
    .string()
    .trim()
    .refine((v) => !v || Number.isInteger(Number(v)), {
      message: 'Numărul de rânduri trebuie să fie întreg',
    }),
  distanta_intre_randuri: z
    .string()
    .trim()
    .refine((v) => !v || (Number.isFinite(toDecimal(v)) && toDecimal(v) > 0), {
      message: 'Distanța trebuie să fie un număr pozitiv',
    }),
  sistem_irigare: z.string(),
  data_plantarii: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), {
    message: 'Data plantării nu este validă',
  }),
  stadiu: z.string(),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface EditCulturaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  tipUnitate?: string | null
  onSaved: () => void
}

function toFormValues(cultura: Cultura): FormValues {
  return {
    tip_planta: cultura.tip_planta ?? '',
    soi: cultura.soi ?? '',
    suprafata_ocupata: cultura.suprafata_ocupata != null ? String(cultura.suprafata_ocupata) : '',
    nr_plante: cultura.nr_plante != null ? String(cultura.nr_plante) : '',
    nr_randuri: cultura.nr_randuri != null ? String(cultura.nr_randuri) : '',
    distanta_intre_randuri:
      cultura.distanta_intre_randuri != null ? String(cultura.distanta_intre_randuri) : '',
    sistem_irigare: cultura.sistem_irigare ?? '',
    data_plantarii: (cultura.data_plantarii ?? '').slice(0, 10),
    stadiu: cultura.stadiu ?? 'crestere',
    observatii: cultura.observatii ?? '',
  }
}

export function EditCulturaDialog({
  open,
  onOpenChange,
  cultura,
  tipUnitate,
  onSaved,
}: EditCulturaDialogProps) {
  const [customTipPlantaOverride, setCustomTipPlantaOverride] = useState<{
    culturaId: string | null
    enabled: boolean
  }>({
    culturaId: null,
    enabled: false,
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tip_planta: '',
      soi: '',
      suprafata_ocupata: '',
      nr_plante: '',
      nr_randuri: '',
      distanta_intre_randuri: '',
      sistem_irigare: '',
      data_plantarii: '',
      stadiu: 'crestere',
      observatii: '',
    },
  })
  const tipPlanta = useWatch({ control: form.control, name: 'tip_planta' })
  const stadiu = useWatch({ control: form.control, name: 'stadiu' })
  const tipPlantaOptions = getCulturiOptions(tipUnitate)
  const currentCulturaId = cultura?.id ?? null
  const forceCustomTipPlantaInput =
    customTipPlantaOverride.enabled && customTipPlantaOverride.culturaId === currentCulturaId
  const resolvedTipPlantaSelectValue = getTipPlantaSelectValue(tipPlanta, tipUnitate)
  const tipPlantaSelectValue =
    forceCustomTipPlantaInput || resolvedTipPlantaSelectValue === CUSTOM_CULTURA_OPTION
      ? CUSTOM_CULTURA_OPTION
      : resolvedTipPlantaSelectValue
  const fieldConfig = getCulturaFieldConfig(tipUnitate)

  useEffect(() => {
    if (open && cultura) {
      form.reset(toFormValues(cultura))
    }
  }, [open, cultura, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!cultura) throw new Error('Cultură lipsă')
      return updateCultura(cultura.id, {
        tip_planta: values.tip_planta,
        soi: values.soi || null,
        suprafata_ocupata: values.suprafata_ocupata ? toDecimal(values.suprafata_ocupata) : null,
        nr_plante: values.nr_plante ? Number(values.nr_plante) : null,
        nr_randuri: values.nr_randuri ? Number(values.nr_randuri) : null,
        distanta_intre_randuri: values.distanta_intre_randuri
          ? toDecimal(values.distanta_intre_randuri)
          : null,
        sistem_irigare: values.sistem_irigare || null,
        data_plantarii: values.data_plantarii || null,
        stadiu: values.stadiu,
        observatii: values.observatii || null,
      })
    },
    onSuccess: () => {
      toast.success('Cultură actualizată')
      setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
      onOpenChange(false)
      onSaved()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  if (!cultura) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
        }
        onOpenChange(nextOpen)
      }}
      title="Editează cultură"
      footer={
        <DialogFormActions
          onCancel={() => {
            setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
            onOpenChange(false)
          }}
          onSave={form.handleSubmit((values) => mutation.mutate(values))}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form
        className="space-y-4 pb-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="space-y-2">
          <Label>Tip plantă *</Label>
          <Select
            value={tipPlantaSelectValue || undefined}
            onValueChange={(value) => {
              if (value === CUSTOM_CULTURA_OPTION) {
                setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: true })
                form.setValue(
                  'tip_planta',
                  tipPlanta && !tipPlantaOptions.includes(tipPlanta) ? tipPlanta : '',
                  { shouldDirty: true, shouldValidate: true }
                )
                return
              }

              setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
              form.setValue('tip_planta', value, { shouldDirty: true, shouldValidate: true })
            }}
          >
            <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
              <SelectValue placeholder="Alege tipul de plantă" />
            </SelectTrigger>
            <SelectContent>
              {tipPlantaOptions.map((option) => (
                <SelectItem
                  key={option}
                  value={option === 'Altele' ? CUSTOM_CULTURA_OPTION : option}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipPlantaSelectValue === CUSTOM_CULTURA_OPTION ? (
            <Input
              id="edit_tip_planta"
              className="agri-control h-12"
              placeholder={getTipPlantaPlaceholder(tipUnitate)}
              {...form.register('tip_planta')}
            />
          ) : null}
          {form.formState.errors.tip_planta ? (
            <p className="text-xs text-red-600">{form.formState.errors.tip_planta.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_soi">Soi</Label>
          <Input
            id="edit_soi"
            className="agri-control h-12"
            placeholder="Ex: Siriana F1"
            {...form.register('soi')}
          />
        </div>

        <NumericField
          id="edit_suprafata_ocupata"
          label="Suprafață ocupată (mp)"
          placeholder="Ex: 200"
          {...form.register('suprafata_ocupata')}
          error={form.formState.errors.suprafata_ocupata?.message}
        />

        <NumericField
          id="edit_nr_plante"
          label={fieldConfig.plantCountLabel}
          placeholder="Ex: 300"
          {...form.register('nr_plante')}
          error={form.formState.errors.nr_plante?.message}
        />

        {fieldConfig.showRowCount ? (
          <NumericField
            id="edit_nr_randuri"
            label={fieldConfig.rowCountLabel}
            placeholder="Ex: 8"
            {...form.register('nr_randuri')}
            error={form.formState.errors.nr_randuri?.message}
          />
        ) : null}

        {fieldConfig.showRowSpacing ? (
          <div className="space-y-2">
            <Label htmlFor="edit_distanta">{fieldConfig.rowSpacingLabel}</Label>
            <Input
              id="edit_distanta"
              className="agri-control h-12"
              inputMode="decimal"
              placeholder="Ex: 0.8"
              {...form.register('distanta_intre_randuri')}
            />
            {form.formState.errors.distanta_intre_randuri ? (
              <p className="text-xs text-red-600">
                {form.formState.errors.distanta_intre_randuri.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="edit_sistem_irigare">Sistem irigare</Label>
          <Input
            id="edit_sistem_irigare"
            className="agri-control h-12"
            placeholder="Ex: Picurare"
            {...form.register('sistem_irigare')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_data_plantarii">Data plantării</Label>
          <Input
            id="edit_data_plantarii"
            type="date"
            className="agri-control h-12"
            {...form.register('data_plantarii')}
          />
          {form.formState.errors.data_plantarii ? (
            <p className="text-xs text-red-600">{form.formState.errors.data_plantarii.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Stadiu</Label>
          <Select
            value={stadiu}
            onValueChange={(value) => form.setValue('stadiu', value, { shouldDirty: true })}
          >
            <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
              <SelectValue placeholder="Alege stadiul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plantare">🌱 Plantare</SelectItem>
              <SelectItem value="crestere">🌿 Creștere</SelectItem>
              <SelectItem value="inflorire">🌸 Înflorire</SelectItem>
              <SelectItem value="cules">🫐 Cules</SelectItem>
              <SelectItem value="repaus">❄️ Repaus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_observatii_cultura">Observații</Label>
          <Textarea
            id="edit_observatii_cultura"
            rows={3}
            className="agri-control w-full px-3 py-2 text-base"
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
