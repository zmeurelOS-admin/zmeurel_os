'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { queryKeys } from '@/lib/query-keys'
import {
  AJUSTARE_STOC_TIP_LABELS,
  AJUSTARE_STOC_TIPURI,
  createAjustareStoc,
  type AjustareStocTip,
} from '@/lib/supabase/queries/ajustari-stoc'

interface AjustareStocDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  disponibilKg: number
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function AjustareStocDialog({ open, onOpenChange, disponibilKg }: AjustareStocDialogProps) {
  const queryClient = useQueryClient()
  const [tip, setTip] = useState<AjustareStocTip>('pierdere')
  const [cantitate, setCantitate] = useState('')
  const [data, setData] = useState(todayIso())
  const [motiv, setMotiv] = useState('')

  const resetForm = () => {
    setTip('pierdere')
    setCantitate('')
    setData(todayIso())
    setMotiv('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const cantitateNum = useMemo(() => {
    const parsed = Number(String(cantitate).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }, [cantitate])

  const isScadere = tip !== 'corectie_plus'
  const depasesteDisponibil = isScadere && cantitateNum > disponibilKg

  const createMutation = useMutation({
    mutationFn: createAjustareStoc,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ajustariStoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziStockSummaryAzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      trackEvent({ eventName: 'create_success', moduleName: 'stocuri', status: 'success' })
      toast.success('Ajustare de stoc salvată')
      handleOpenChange(false)
    },
    onError: (error: Error) => {
      trackEvent({ eventName: 'create_failed', moduleName: 'stocuri', status: 'failed' })
      toast.error(error.message)
    },
  })

  const handleSave = () => {
    if (createMutation.isPending) return
    if (cantitateNum <= 0) {
      toast.error('Introdu o cantitate mai mare decât 0.')
      return
    }
    if (!data) {
      toast.error('Selectează data ajustării.')
      return
    }
    createMutation.mutate({
      tip,
      cantitateKg: cantitateNum,
      data,
      motiv: motiv.trim() || null,
    })
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Ajustează stocul"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => {
            if (!createMutation.isPending) handleOpenChange(false)
          }}
          onSave={handleSave}
          saving={createMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="aj_tip">Tip ajustare</Label>
          <select
            id="aj_tip"
            className="agri-control h-12 w-full px-3 text-base md:h-11"
            value={tip}
            onChange={(e) => setTip(e.target.value as AjustareStocTip)}
          >
            {AJUSTARE_STOC_TIPURI.map((value) => (
              <option key={value} value={value}>
                {AJUSTARE_STOC_TIP_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--agri-text-muted)]">
            {isScadere
              ? 'Scade cantitatea din stocul de zmeură proaspătă (doar evidență, fără stoc separat).'
              : 'Adaugă cantitatea la stocul disponibil (corecție de inventar).'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aj_cantitate">Cantitate (kg)</Label>
          <Input
            id="aj_cantitate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            className="agri-control h-12 md:h-11"
            value={cantitate}
            onChange={(e) => setCantitate(e.target.value)}
          />
          {depasesteDisponibil ? (
            <p className="text-xs text-[var(--status-danger-text)]">
              Cantitatea depășește disponibilul curent ({disponibilKg.toFixed(2)} kg) — ajustarea va fi respinsă.
            </p>
          ) : null}
        </div>

        <AppDatePicker
          id="aj_data"
          label="Data ajustării"
          placeholder="Selectează data"
          value={data}
          triggerClassName="h-12 md:h-11"
          onChange={(nextValue) => setData(nextValue)}
        />

        <div className="space-y-2">
          <Label htmlFor="aj_motiv">Motiv (opțional)</Label>
          <Textarea
            id="aj_motiv"
            rows={3}
            className="agri-control min-h-[5rem] w-full px-3 py-2 text-base"
            placeholder="Ex.: 4 kg puse la congelator pentru gem"
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
          />
        </div>
      </div>
    </AppDrawer>
  )
}
