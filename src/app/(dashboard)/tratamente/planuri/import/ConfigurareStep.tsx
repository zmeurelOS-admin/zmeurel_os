'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { listParcelePentruPlanWizardAction } from '@/app/(dashboard)/tratamente/planuri/actions'
import { checkConflictPlanAction } from '@/app/(dashboard)/tratamente/planuri/import/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PlanWizardParcelaOption } from '@/lib/supabase/queries/tratamente'

type ImportConfig = {
  parcelaId: string
  an: number
}

type ConfigurareStepProps = {
  onConfigurate: (config: ImportConfig) => void
}

function getParcelaCultureLabel(parcela: PlanWizardParcelaOption) {
  return parcela.tip_fruct?.trim() || parcela.cultura_tip?.trim() || 'cultură neprecizată'
}

export function ConfigurareStep({ onConfigurate }: ConfigurareStepProps) {
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
  const [parcele, setParcele] = useState<PlanWizardParcelaOption[]>([])
  const [selectedParcelaId, setSelectedParcelaId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [isLoadingParcele, setIsLoadingParcele] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<{ conflict: boolean; numePlan?: string }>({
    conflict: false,
  })

  const selectedParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId) ?? null,
    [parcele, selectedParcelaId]
  )

  useEffect(() => {
    let cancelled = false

    async function loadParcele() {
      try {
        setIsLoadingParcele(true)
        setLoadError(null)
        const result = await listParcelePentruPlanWizardAction()
        if (cancelled) return

        setParcele(result)
        if (result.length === 1) {
          setSelectedParcelaId(result[0].id)
        }
      } catch (error) {
        if (cancelled) return
        setLoadError(
          error instanceof Error ? error.message : 'Nu am putut încărca lista de parcele.'
        )
      } finally {
        if (!cancelled) {
          setIsLoadingParcele(false)
        }
      }
    }

    void loadParcele()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedParcelaId) {
      setConflictInfo({ conflict: false })
      return
    }

    let cancelled = false

    async function checkConflict() {
      try {
        setIsCheckingConflict(true)
        const result = await checkConflictPlanAction(selectedParcelaId, selectedYear)
        if (!cancelled) {
          setConflictInfo(result)
        }
      } catch {
        if (!cancelled) {
          setConflictInfo({ conflict: false })
        }
      } finally {
        if (!cancelled) {
          setIsCheckingConflict(false)
        }
      }
    }

    void checkConflict()

    return () => {
      cancelled = true
    }
  }, [selectedParcelaId, selectedYear])

  return (
    <div className="space-y-4">
      <AppCard className="space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-lg [font-weight:700] text-[var(--text-primary)]">
            0. Configurare import
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Alege parcela și anul înainte de upload. Planul importat va fi asociat direct
            în contextul selectat.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="import-parcela">Parcelă</Label>
            <Select
              value={selectedParcelaId}
              onValueChange={setSelectedParcelaId}
              disabled={isLoadingParcele || parcele.length === 0}
            >
              <SelectTrigger id="import-parcela" className="min-h-11">
                <SelectValue
                  placeholder={
                    isLoadingParcele ? 'Se încarcă parcelele...' : 'Alege parcela'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {parcele.map((parcela) => (
                  <SelectItem key={parcela.id} value={parcela.id}>
                    {`${parcela.nume_parcela ?? 'Parcelă fără nume'} — ${getParcelaCultureLabel(parcela)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoadingParcele ? (
              <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Se încarcă lista de parcele...
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-an">Anul planului</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger id="import-an" className="min-h-11">
                <SelectValue placeholder="Alege anul" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Nu am putut încărca configurația</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        {isCheckingConflict && selectedParcela ? (
          <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verific dacă există deja un plan activ pentru parcela selectată.
          </p>
        ) : null}

        {conflictInfo.conflict && selectedParcela ? (
          <Alert className="border-[var(--warning-border)] bg-[var(--warning-bg)]/70">
            <AlertTriangle className="h-4 w-4 text-[var(--warning-text)]" />
            <AlertTitle>Plan activ deja asociat</AlertTitle>
            <AlertDescription className="text-sm text-[var(--warning-text)]">
              Parcela {selectedParcela.nume_parcela ?? 'selectată'} are deja un plan activ pentru{' '}
              {selectedYear}.
              {conflictInfo.numePlan ? ` (${conflictInfo.numePlan})` : ''} Importul va crea un
              plan nou separat — planul existent rămâne neatins.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!selectedParcelaId || isLoadingParcele || Boolean(loadError)}
            onClick={() =>
              onConfigurate({
                parcelaId: selectedParcelaId,
                an: selectedYear,
              })
            }
          >
            Continuă →
          </Button>
        </div>
      </AppCard>
    </div>
  )
}
