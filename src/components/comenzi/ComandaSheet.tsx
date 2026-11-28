'use client'

import { BottomSheet } from '@/components/kit'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

import { useComandaFisa } from './useComandaFisa'

export interface ComandaSheetProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  comanda: Comanda | null
  clientName: string
  /** Telefonul din fișa clientului, folosit când comanda nu are unul scris. */
  clientTelefon?: string | null
  todayIso: string
  canWrite: boolean
  canDelete: boolean
  /** Există coloana `prioritara` (altfel comutatorul nu apare). */
  hasPrioritara: boolean
  /** Pagina închide foaia, apoi deschide formularul (două ferestre suprapuse nu se deschid). */
  onEdit: (comanda: Comanda) => void
}

/**
 * Foaia unei comenzi: detaliile și tot ce se poate face cu ea (editare, mutare pe altă zi, punere în livrare,
 * livrare directă, încasare, anulare, redeschidere, ștergere). Confirmările sunt în aceeași foaie. Conținutul e în
 * `useComandaFisa` (același și în fișa de desktop, promptul 35).
 */
export function ComandaSheet({ open, onOpenChange, ...rest }: ComandaSheetProps) {
  const fisa = useComandaFisa({ ...rest, activ: open, onClose: () => onOpenChange(false) })

  if (!fisa) {
    return (
      <BottomSheet open={false} onOpenChange={onOpenChange} title="Comandă">
        {null}
      </BottomSheet>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={fisa.title} description={fisa.description}>
      {fisa.content}
    </BottomSheet>
  )
}
