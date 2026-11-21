'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { BigInput, BigTextarea, Notice, StepForm, StepFormTitle, SuccessScreen, useStepForm } from '@/components/kit'
import { getConditiiMediuLabel } from '@/lib/parcele/culturi'
import { numarRo } from '@/lib/parcele/formular-parcela'
import { createSolarClimateLog } from '@/lib/supabase/queries/solar-tracking'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

export interface MicroclimatStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string
  parcelaNume: string
  tipUnitate: string | null | undefined
}

const STEPS = ['microclimat'] as const

/** O înregistrare de microclimat (temperatură, umiditate, notă) în `solar_climate_logs`, ca până acum. */
export function MicroclimatStepForm({ open, onOpenChange, parcelaId, parcelaNume, tipUnitate }: MicroclimatStepFormProps) {
  const queryClient = useQueryClient()
  const form = useStepForm({ steps: STEPS, open, analytics: false })
  const eticheta = getConditiiMediuLabel(tipUnitate)
  const [temperatura, setTemperatura] = useState('')
  const [umiditate, setUmiditate] = useState('')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setTemperatura('')
    setUmiditate('')
    setNota('')
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  const t = numarRo(temperatura)
  const u = numarRo(umiditate)
  const tBun = t !== null && Number.isFinite(t)
  const uBun = u !== null && Number.isFinite(u) && u >= 0 && u <= 100
  const canSave = tBun && uBun && !saving

  const save = async () => {
    if (!canSave || t === null || u === null) return
    setSaving(true)
    setSaveError(null)
    try {
      await createSolarClimateLog({ unitate_id: parcelaId, temperatura: t, umiditate: u, observatii: nota.trim() || undefined })
      void queryClient.invalidateQueries({ queryKey: ['solar_climate_logs'] })
      hapticSuccess()
      setSaved(`${temperatura.trim()} °C · ${umiditate.trim()}%`)
      form.markSuccess()
    } catch (error) {
      hapticError()
      setSaveError(error instanceof Error && error.message ? error.message : 'Nu s-a salvat. Încearcă din nou.')
      form.markFailed()
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      title={eticheta}
      description="Temperatura și umiditatea din solar, acum."
      stepLabel={eticheta}
      footer={{ primary: { label: saving ? 'Se salvează…' : 'Salvează', onClick: () => void save(), loading: saving, disabled: !canSave } }}
      success={saved ? <SuccessScreen title="Salvat" description={saved} primaryAction={{ label: 'Gata', onClick: () => onOpenChange(false) }} /> : undefined}
    >
      <div className="space-y-5">
        <StepFormTitle eyebrow={parcelaNume}>{eticheta} acum</StepFormTitle>
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <BigInput
            label="Temperatură (°C)"
            value={temperatura}
            onChange={(event) => setTemperatura(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            error={temperatura.trim() && !tBun ? 'Un număr, ex. 24.' : undefined}
          />
          <BigInput
            label="Umiditate (%)"
            value={umiditate}
            onChange={(event) => setUmiditate(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            error={umiditate.trim() && !uBun ? 'Între 0 și 100.' : undefined}
          />
        </div>
        <BigTextarea label="Notă (opțional)" value={nota} onChange={(event) => setNota(event.target.value)} rows={2} maxLength={300} placeholder="ex. aerisit la prânz" />
      </div>
    </StepForm>
  )
}
