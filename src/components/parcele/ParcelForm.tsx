'use client'

import { type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { NumericField } from '@/components/app/NumericField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatM2ToHa, parseLocalizedNumber } from '@/lib/utils/area'
import { toast } from '@/lib/ui/toast'

export interface ParcelFormValues {
  nume_parcela: string
  tip_unitate: 'camp' | 'solar' | 'livada' | 'cultura_mare'
  tip_fruct: string
  suprafata_m2: string
  latitudine: string
  longitudine: string
  soi_plantat: string
  cultura: string
  soi: string
  crop_rows: Array<{
    id: string
    culture: string
    variety: string
    plantCount: string
  }>
  nr_randuri: string
  an_plantare: string
  nr_plante: string
  distanta_intre_randuri: string
  sistem_irigare: string
  data_plantarii: string
  status: string
  observatii: string
}

const toDecimal = (value: string) => parseLocalizedNumber(value)

export const parcelFormSchema = z.object({
  nume_parcela: z.string().trim().min(1, 'Numele terenului este obligatoriu'),
  tip_unitate: z.enum(['camp', 'solar', 'livada', 'cultura_mare']),
  tip_fruct: z.string(),
  suprafata_m2: z
    .string()
    .trim()
    .min(1, 'Suprafața este obligatorie')
    .refine((value) => Number.isFinite(toDecimal(value)) && toDecimal(value) > 0, {
      message: 'Suprafața trebuie să fie un număr valid',
    }),
  latitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Latitudinea trebuie să fie un număr valid',
    }),
  longitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Longitudinea trebuie să fie un număr valid',
    }),
  soi_plantat: z.string(),
  cultura: z.string(),
  soi: z.string(),
  crop_rows: z.array(
    z.object({
      id: z.string(),
      culture: z.string(),
      variety: z.string(),
      plantCount: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
        message: 'Numărul de plante trebuie să fie un număr întreg',
      }),
    }),
  ),
  nr_randuri: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numărul de rânduri trebuie să fie un număr întreg',
  }),
  an_plantare: z.string(),
  nr_plante: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numărul de plante trebuie să fie un număr întreg',
  }),
  distanta_intre_randuri: z
    .string()
    .trim()
    .refine((value) => !value || (Number.isFinite(toDecimal(value)) && toDecimal(value) > 0), {
      message: 'Distanța între rânduri trebuie să fie un număr valid',
    }),
  sistem_irigare: z.string(),
  data_plantarii: z.string().trim().refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: 'Data plantării nu este validă',
  }),
  status: z.string().trim().min(1, 'Statusul este obligatoriu'),
  observatii: z.string(),
})

export const getParcelFormDefaults = (): ParcelFormValues => ({
  nume_parcela: '',
  tip_unitate: 'camp',
  tip_fruct: '',
  suprafata_m2: '',
  latitudine: '',
  longitudine: '',
  soi_plantat: '',
  cultura: '',
  soi: '',
  crop_rows: [{ id: 'crop-1', culture: '', variety: '', plantCount: '' }],
  nr_randuri: '',
  an_plantare: String(new Date().getFullYear()),
  nr_plante: '',
  distanta_intre_randuri: '',
  sistem_irigare: '',
  data_plantarii: '',
  status: 'Activ',
  observatii: '',
})

interface ParcelFormProps {
  form: UseFormReturn<ParcelFormValues>
  soiuriDisponibile: string[]
}

const selectTriggerClass = 'agri-control h-12 w-full px-3 text-base'

export function ParcelForm({ form, soiuriDisponibile: _soiuriDisponibile }: ParcelFormProps) {
  void _soiuriDisponibile

  const tipUnitate = form.watch('tip_unitate')
  const suprafataValue = form.watch('suprafata_m2')

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocația nu este disponibilă în acest browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        form.setValue('latitudine', String(lat), { shouldDirty: true, shouldValidate: true })
        form.setValue('longitudine', String(lng), { shouldDirty: true, shouldValidate: true })
        toast.success('Locația curentă a fost completată')
      },
      (error) => {
        const message =
          error.code === 1
            ? 'Accesul la locație a fost refuzat'
            : 'Nu am putut obține locația curentă'
        toast.error(message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tip unitate *</Label>
        <Select
          value={tipUnitate}
          onValueChange={(value: 'camp' | 'solar' | 'livada' | 'cultura_mare') =>
            form.setValue('tip_unitate', value, { shouldDirty: true, shouldValidate: true })
          }
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege tipul unității" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="camp">Câmp</SelectItem>
            <SelectItem value="cultura_mare">Cultură mare</SelectItem>
            <SelectItem value="solar">Solar</SelectItem>
            <SelectItem value="livada">Livadă</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nume_parcela">Nume teren *</Label>
        <input
          id="nume_parcela"
          className="agri-control h-12 w-full px-3 text-base"
          placeholder="Teren Nord"
          {...form.register('nume_parcela')}
        />
        {form.formState.errors.nume_parcela ? (
          <p className="text-xs text-red-600">{form.formState.errors.nume_parcela.message}</p>
        ) : null}
      </div>

      <NumericField
        id="suprafata_m2"
        label="Suprafață (m²) *"
        placeholder="1200"
        {...form.register('suprafata_m2')}
        error={form.formState.errors.suprafata_m2?.message}
      />
      <p className="text-xs text-muted-foreground">≈ {formatM2ToHa(suprafataValue)}</p>

      <div className="space-y-2">
        <Label>Locație</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="latitudine">Latitudine</Label>
            <NumericField
              id="latitudine"
              label=""
              placeholder="47.6514"
              step="any"
              {...form.register('latitudine')}
              error={form.formState.errors.latitudine?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitudine">Longitudine</Label>
            <NumericField
              id="longitudine"
              label=""
              placeholder="26.2553"
              step="any"
              {...form.register('longitudine')}
              error={form.formState.errors.longitudine?.message}
            />
          </div>
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={handleUseCurrentLocation}>
          📍 Folosește locația curentă
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Status *</Label>
        <Select
          value={form.watch('status')}
          onValueChange={(value) => form.setValue('status', value, { shouldDirty: true })}
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege statusul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Activ">Activ</SelectItem>
            <SelectItem value="Inactiv">Inactiv</SelectItem>
            <SelectItem value="In Pregatire">În pregătire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observatii">Observații</Label>
        <Textarea
          id="observatii"
          rows={4}
          placeholder="Detalii suplimentare"
          className="agri-control w-full px-3 py-2 text-base"
          {...form.register('observatii')}
        />
      </div>
    </div>
  )
}
