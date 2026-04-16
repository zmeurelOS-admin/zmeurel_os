'use client'

import { UseFormReturn } from 'react-hook-form'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatM2ToHa } from '@/lib/utils/area'
import { toast } from '@/lib/ui/toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ParcelUsageFields, applyScopDefaults } from '@/components/parcele/ParcelUsageFields'
import type { ParcelaScop, StatusOperational } from '@/lib/parcele/dashboard-relevance'

export interface ParcelaFormData {
  nume_parcela: string
  rol: ParcelaScop
  apare_in_dashboard: boolean
  contribuie_la_productie: boolean
  status_operational: StatusOperational
  suprafata_m2: string
  latitudine: string
  longitudine: string
  soi_plantat: string
  an_plantare: string
  nr_plante: string
  status: string
  observatii: string
}

interface ParcelaFormProps {
  form: UseFormReturn<ParcelaFormData>
  soiuriDisponibile: string[]
}

export const IOS_INPUT_CLASS =
  'h-11 w-full rounded-lg border border-[var(--input)] bg-[var(--agri-surface)] px-3 text-sm text-[var(--agri-text)] transition-all duration-150 placeholder:text-[var(--text-hint)] focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500'

export const IOS_LABEL_CLASS = 'text-sm font-medium text-[var(--button-muted-text)]'

export const IOS_SELECT_TRIGGER_CLASS =
  'h-11 w-full rounded-lg border border-[var(--input)] bg-[var(--agri-surface)] px-3 text-sm text-[var(--agri-text)] transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500'

export function ParcelaForm({ form, soiuriDisponibile }: ParcelaFormProps) {
  const suprafataValue = form.watch('suprafata_m2')
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoStatus, setGeoStatus] = useState<{ state: 'idle' | 'denied' | 'error' | 'unsupported'; message?: string }>({
    state: 'idle',
  })

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus({ state: 'unsupported', message: 'Poți adăuga manual coordonatele.' })
      toast.error('Browserul nu suportă geolocalizare')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        form.setValue('latitudine', String(lat), { shouldDirty: true, shouldValidate: true })
        form.setValue('longitudine', String(lng), { shouldDirty: true, shouldValidate: true })
        setGeoLoading(false)
        setGeoStatus({ state: 'idle' })
        toast.success('Locație detectată')
      },
      (error) => {
        setGeoLoading(false)
        
        if (error.code === 1) {
          setGeoStatus({ state: 'denied', message: 'Locația nu e disponibilă. Poți adăuga coordonatele manual mai târziu.' })
          toast.error('Permite accesul la locație din setările browserului')
          return
        }
        setGeoStatus({ state: 'error', message: 'Nu s-a putut determina locația. Încearcă din nou.' })
        toast.error(error.code === 3 ? 'Timeout. Încearcă din nou.' : 'Locația nu e disponibilă. Adaugă manual coordonatele.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="nume_parcela" className={IOS_LABEL_CLASS}>
          Nume Parcelă *
        </Label>
        <Input
          id="nume_parcela"
          placeholder="ex: Parcelă Nord"
          className={IOS_INPUT_CLASS}
          {...form.register('nume_parcela')}
        />
        {form.formState.errors.nume_parcela && (
          <p className="text-sm text-destructive">
            {form.formState.errors.nume_parcela.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="suprafata_m2" className={IOS_LABEL_CLASS}>
          Suprafață (m2) *
        </Label>
        <Input
          id="suprafata_m2"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          step="0.01"
          placeholder="0.00"
          className={IOS_INPUT_CLASS}
          {...form.register('suprafata_m2')}
        />
        <p className="text-xs text-muted-foreground">≈ {formatM2ToHa(suprafataValue)}</p>
        {form.formState.errors.suprafata_m2 && (
          <p className="text-sm text-destructive">
            {form.formState.errors.suprafata_m2.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className={IOS_LABEL_CLASS}>Scop</Label>
        <Select
          value={form.watch('rol')}
          onValueChange={(value) => {
            const next = value as Parameters<typeof applyScopDefaults>[0]
            form.setValue('rol', next, { shouldDirty: true })
            const defs = applyScopDefaults(next)
            form.setValue('apare_in_dashboard', defs.apare_in_dashboard, { shouldDirty: true })
            form.setValue('contribuie_la_productie', defs.contribuie_la_productie, { shouldDirty: true })
          }}
        >
          <SelectTrigger className={IOS_SELECT_TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comercial">Producție comercială</SelectItem>
            <SelectItem value="personal">Uz personal</SelectItem>
            <SelectItem value="experimental">Experimental</SelectItem>
            <SelectItem value="inactiv">Inactiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="soi_plantat" className={IOS_LABEL_CLASS}>
          Soi / cultură
        </Label>
        <Select
          value={form.watch('soi_plantat')}
          onValueChange={(value) => form.setValue('soi_plantat', value)}
        >
          <SelectTrigger className={IOS_SELECT_TRIGGER_CLASS}>
            <SelectValue placeholder="Selectează soi..." />
          </SelectTrigger>
          <SelectContent>
            {soiuriDisponibile.map((soi) => (
              <SelectItem key={soi} value={soi}>
                {soi}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={IOS_LABEL_CLASS}>Situație operațională</Label>
        <Select
          value={form.watch('status_operational')}
          onValueChange={(value) => form.setValue('status_operational', value as ParcelaFormData['status_operational'])}
        >
          <SelectTrigger className={IOS_SELECT_TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activ">Activ</SelectItem>
            <SelectItem value="in_pauza">În pauză</SelectItem>
            <SelectItem value="neproductiv">Neproductiv</SelectItem>
            <SelectItem value="infiintare">În înființare</SelectItem>
            <SelectItem value="arhivat">Arhivat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label className={IOS_LABEL_CLASS}>Locație</Label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="latitudine" className={IOS_LABEL_CLASS}>
              Latitudine
            </Label>
            <Input
              id="latitudine"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="47.6514"
              className={IOS_INPUT_CLASS}
              {...form.register('latitudine')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitudine" className={IOS_LABEL_CLASS}>
              Longitudine
            </Label>
            <Input
              id="longitudine"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="26.2553"
              className={IOS_INPUT_CLASS}
              {...form.register('longitudine')}
            />
          </div>
          <div className="md:pb-[2px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full md:w-auto"
              onClick={handleUseCurrentLocation}
              disabled={geoStatus.state === 'denied' || geoLoading}
              title={geoStatus.state === 'denied' ? 'Permite accesul la locație' : undefined}
            >
              {geoLoading ? 'Se detectează...' : 'Folosește locația curentă'}
            </Button>
          </div>
        </div>
        {geoStatus.message ? <p className="text-xs text-muted-foreground">{geoStatus.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="an_plantare" className={IOS_LABEL_CLASS}>
          An Plantare *
        </Label>
        <Input
          id="an_plantare"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="2000"
          max={new Date().getFullYear()}
          placeholder={String(new Date().getFullYear())}
          className={IOS_INPUT_CLASS}
          {...form.register('an_plantare')}
        />
        {form.formState.errors.an_plantare && (
          <p className="text-sm text-destructive">
            {form.formState.errors.an_plantare.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status" className={IOS_LABEL_CLASS}>
          Status *
        </Label>
        <Select
          value={form.watch('status')}
          onValueChange={(value) => form.setValue('status', value)}
        >
          <SelectTrigger className={IOS_SELECT_TRIGGER_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Activ">Activ</SelectItem>
            <SelectItem value="Inactiv">Inactiv</SelectItem>
            <SelectItem value="In Pregatire">In Pregatire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nr_plante" className={IOS_LABEL_CLASS}>
          Numar Plante
        </Label>
        <Input
          id="nr_plante"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          className={IOS_INPUT_CLASS}
          {...form.register('nr_plante')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observatii" className={IOS_LABEL_CLASS}>
          Observații
        </Label>
        <Textarea
          id="observatii"
          placeholder="Detalii suplimentare..."
          className="w-full rounded-lg border border-[var(--input)] bg-[var(--agri-surface)] px-3 py-2 text-sm text-[var(--agri-text)] transition-all duration-150 placeholder:text-[var(--text-hint)] focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500"
          {...form.register('observatii')}
        />
      </div>

      <ParcelUsageFields
        className="md:col-span-2"
        scop={form.watch('rol')}
        apareInDashboard={form.watch('apare_in_dashboard')}
        contribuieLaProductie={form.watch('contribuie_la_productie')}
        disableCommercialToggles
        onApareChange={(v) => form.setValue('apare_in_dashboard', v, { shouldDirty: true })}
        onContribuieChange={(v) => form.setValue('contribuie_la_productie', v, { shouldDirty: true })}
      />
    </div>
  )
}
