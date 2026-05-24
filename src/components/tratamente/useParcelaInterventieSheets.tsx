'use client'

import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { listCapcaneActiveAction } from '@/app/(dashboard)/tratamente/capcane/actions'
import { cn } from '@/lib/utils'
import type { MetodaAplicare } from '@/types/tratamente-metode'

import { MarkCapcanaSheet } from './MarkCapcanaSheet'
import { MarkAplicataSheet } from './MarkAplicataSheet'
import {
  SelectorCapcaneActiveSheet,
  type SelectorCapcanaActivaItem,
} from './SelectorCapcaneActiveSheet'
import { IntervenitiePickerSheet } from './IntervenitiePickerSheet'
import { VerificaCapcanaSheet } from './VerificaCapcanaSheet'

export type MarkAplicataSheetManualProps = Pick<
  ComponentProps<typeof MarkAplicataSheet>,
  | 'defaultCantitateMl'
  | 'defaultCohortLaAplicare'
  | 'defaultOperator'
  | 'defaultStadiu'
  | 'defaultManualData'
  | 'defaultManualParcelaId'
  | 'defaultManualParcelaLabel'
  | 'defaultManualStatus'
  | 'configurareSezon'
  | 'grupBiologic'
  | 'isRubusMixt'
  | 'manualParcele'
  | 'meteoSnapshot'
  | 'onSubmit'
  | 'pending'
  | 'produseEfective'
  | 'produseFitosanitare'
  | 'produsePlanificate'
>

export type UseParcelaInterventieSheetsParams = {
  parcelaId?: string
  parcele?: Array<{ id: string; nume_parcela: string; suprafata_ha: number | null }>
  fenofazaCurenta?: string | null
  markAplicataProps: MarkAplicataSheetManualProps
}

export function useParcelaInterventieSheets({
  parcelaId,
  parcele = [],
  fenofazaCurenta = null,
  markAplicataProps,
}: UseParcelaInterventieSheetsParams) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedMetoda, setSelectedMetoda] = useState<MetodaAplicare | null>(null)
  const [aplicareSheetOpen, setAplicareSheetOpen] = useState(false)
  const [montaCapcanaSheetOpen, setMontaCapcanaSheetOpen] = useState(false)
  const [selectorCapcaneActiveOpen, setSelectorCapcaneActiveOpen] = useState(false)
  const [verificaCapcanaSheetOpen, setVerificaCapcanaSheetOpen] = useState(false)
  const [selectedCapcana, setSelectedCapcana] = useState<SelectorCapcanaActivaItem | null>(null)
  const [capcaneActive, setCapcaneActive] = useState<SelectorCapcanaActivaItem[]>([])
  const [capcaneLoading, setCapcaneLoading] = useState(false)
  const [capcaneError, setCapcaneError] = useState<string | null>(null)

  const parcelaNameById = useMemo(
    () =>
      new Map(
        parcele.map((parcela) => [parcela.id, parcela.nume_parcela || 'Parcelă'] as const)
      ),
    [parcele]
  )

  const loadCapcaneActive = useCallback(async () => {
    setCapcaneLoading(true)
    setCapcaneError(null)

    try {
      const result = await listCapcaneActiveAction({
        parcelaId,
        parcelaIds: parcelaId ? undefined : parcele.map((parcela) => parcela.id),
      })

      if (!result.ok) {
        setCapcaneError(result.error)
        setCapcaneActive([])
        return
      }

      setCapcaneActive(
        result.data.map((capcana) => ({
          id: capcana.id,
          tipCapcana: capcana.tip_capcana,
          nrBucati: capcana.nr_bucati,
          parcelaNume: parcelaNameById.get(capcana.parcela_id) ?? 'Parcelă',
          dataMontare: capcana.data_montare,
          dataUrmatoareaVerificare: capcana.data_urmatoarea_verificare,
        }))
      )
    } catch {
      setCapcaneError('Nu am putut încărca capcanele. Încearcă din nou.')
      setCapcaneActive([])
    } finally {
      setCapcaneLoading(false)
    }
  }, [parcelaId, parcele, parcelaNameById])

  useEffect(() => {
    if (!selectorCapcaneActiveOpen) return
    void loadCapcaneActive()
  }, [loadCapcaneActive, selectorCapcaneActiveOpen])

  const handlePick = (metoda: MetodaAplicare) => {
    setSelectedMetoda(metoda)
    setPickerOpen(false)

    if (metoda === 'capcana_pus') {
      setMontaCapcanaSheetOpen(true)
      return
    }

    if (metoda === 'capcana_verificat') {
      setSelectorCapcaneActiveOpen(true)
      return
    }

    setAplicareSheetOpen(true)
  }

  const openApplyPicker = useCallback(() => {
    setPickerOpen(true)
  }, [])

  const openVerifyCapcana = useCallback(() => {
    void loadCapcaneActive()
    setSelectorCapcaneActiveOpen(true)
  }, [loadCapcaneActive])

  const openMountCapcana = useCallback(() => {
    setMontaCapcanaSheetOpen(true)
  }, [])

  const renderSheets = (): ReactNode => (
    <>
      <IntervenitiePickerSheet open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePick} />

      {selectedMetoda &&
      selectedMetoda !== 'capcana_pus' &&
      selectedMetoda !== 'capcana_verificat' ? (
        <MarkAplicataSheet
          {...markAplicataProps}
          defaultMetoda={selectedMetoda}
          mode="manual"
          open={aplicareSheetOpen}
          onOpenChange={setAplicareSheetOpen}
        />
      ) : null}

      <MarkCapcanaSheet
        open={montaCapcanaSheetOpen}
        onOpenChange={setMontaCapcanaSheetOpen}
        parcelaId={parcelaId}
        parcele={parcele}
        fenofazaCurenta={fenofazaCurenta}
        onSuccess={() => router.refresh()}
      />

      <SelectorCapcaneActiveSheet
        open={selectorCapcaneActiveOpen}
        onOpenChange={setSelectorCapcaneActiveOpen}
        items={capcaneActive}
        loading={capcaneLoading}
        error={capcaneError}
        onRetry={() => void loadCapcaneActive()}
        onPick={(capcana) => {
          setSelectedCapcana(capcana)
          setSelectorCapcaneActiveOpen(false)
          setVerificaCapcanaSheetOpen(true)
        }}
      />

      {selectedCapcana ? (
        <VerificaCapcanaSheet
          open={verificaCapcanaSheetOpen}
          onOpenChange={setVerificaCapcanaSheetOpen}
          capcanaMontata={selectedCapcana}
          onSuccess={() => {
            router.refresh()
            setSelectedCapcana(null)
          }}
        />
      ) : null}
    </>
  )

  const renderFab = (className?: string): ReactNode => (
    <button
      type="button"
      onClick={openApplyPicker}
      aria-label="Adaugă intervenție"
      className={cn(
        'fixed bottom-[calc(var(--app-nav-clearance)+1rem)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--agri-primary)] text-white shadow-[0_4px_20px_rgba(13,155,92,0.2),0_1px_3px_rgba(13,155,92,0.15)] transition active:scale-[0.985] lg:hidden',
        className
      )}
      data-parcela-id={parcelaId ?? undefined}
    >
      <Plus size={24} strokeWidth={2.5} />
    </button>
  )

  return {
    capcaneActive,
    capcaneError,
    capcaneLoading,
    loadCapcaneActive,
    openApplyPicker,
    openMountCapcana,
    openVerifyCapcana,
    renderFab,
    renderSheets,
  }
}
