'use client'

import { useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { AppDrawer } from '@/components/app/AppDrawer'
import {
  getParcelFormDefaults,
  parcelFormSchema,
  ParcelForm,
  type ParcelFormValues,
} from '@/components/parcele/ParcelForm'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { createParcela } from '@/lib/supabase/queries/parcele'
import { toast } from '@/lib/ui/toast'
import { parseLocalizedNumber } from '@/lib/utils/area'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

interface AddParcelDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  soiuriDisponibile: string[]
  onCreated: () => void
}

const toDecimal = (value: string) => parseLocalizedNumber(value)
const toFloatOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
const generateParcelCode = () => `PAR-${Date.now().toString().slice(-6)}`

export function AddParcelDrawer({
  open,
  onOpenChange,
  soiuriDisponibile,
  onCreated,
}: AddParcelDrawerProps) {
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)

  const form = useForm<ParcelFormValues>({
    resolver: zodResolver(parcelFormSchema),
    defaultValues: getParcelFormDefaults(),
  })

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'parcele', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'parcele', status: 'abandoned' })
    }
    if (!open) {
      form.reset(getParcelFormDefaults())
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (values: ParcelFormValues) => {
      const parcela = await createParcela({
        id_parcela: generateParcelCode(),
        nume_parcela: values.nume_parcela.trim(),
        rol: values.rol,
        apare_in_dashboard: values.apare_in_dashboard,
        contribuie_la_productie: values.contribuie_la_productie,
        status_operational: values.status_operational,
        tip_unitate: values.tip_unitate,
        suprafata_m2: toDecimal(values.suprafata_m2),
        latitudine: toFloatOrNull(values.latitudine) ?? undefined,
        longitudine: toFloatOrNull(values.longitudine) ?? undefined,
        an_plantare: new Date().getFullYear(),
        status: values.status,
        observatii: values.observatii?.trim() || undefined,
      })

      return parcela
    },
    onSuccess: (_parcela, values) => {
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'parcele', status: 'success' })
      track('parcela_add', {
        suprafata: Number(values.suprafata_m2.replace(',', '.')) || 0,
        tip_unitate: values.tip_unitate,
      })
      hapticSuccess()
      toast.success('Teren adăugat')
      onOpenChange(false)
      onCreated()
    },
    onError: (error: Error) => {
      trackEvent({ eventName: 'create_failed', moduleName: 'parcele', status: 'failed' })
      hapticError()
      toast.error(error.message)
    },
  })

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă teren"
      description="Configurezi rapid un teren nou și verifici rezumatul din dreapta înainte de salvare."
      desktopFormWide
      showCloseButton
      contentClassName="lg:max-w-[min(94vw,68rem)] xl:max-w-[min(92vw,72rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => createMutation.mutate(values))}
          saving={createMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
        <ParcelForm form={form} soiuriDisponibile={soiuriDisponibile} />
      </form>
    </AppDrawer>
  )
}
