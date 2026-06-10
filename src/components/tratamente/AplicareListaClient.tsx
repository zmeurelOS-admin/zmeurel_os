'use client'

import { useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { deleteAplicareAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicari-actions'
import { EditAplicareButton } from '@/components/tratamente/EditAplicareButton'
import {
  getAplicareInterventieLabel,
  getAplicareProduseSummary,
  getAplicareSourceLabel,
} from '@/components/tratamente/aplicare-ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { METODA_APLICARE_LABEL_RO, normalizeMetodaAplicare } from '@/types/tratamente-metode'

interface AplicareListaClientProps {
  aplicari: AplicareTratamentDetaliu[]
  parcelaId: string
}

type AplicareGroup = {
  dateKey: string
  label: string
  aplicari: AplicareTratamentDetaliu[]
}

function getAplicareDate(aplicare: AplicareTratamentDetaliu): string {
  return aplicare.data_aplicata ?? aplicare.data_planificata ?? aplicare.created_at
}

function getDateKey(value: string): string {
  return value.slice(0, 10)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getGroupLabel(value: string): string {
  return capitalize(format(parseISO(value), 'EEEE, d MMMM yyyy', { locale: ro }))
}

function getAccentClass(aplicare: AplicareTratamentDetaliu): string {
  if (aplicare.status === 'aplicata' || aplicare.status === 'aplicata_partial') {
    return 'bg-[var(--agri-primary)]'
  }
  if (aplicare.status === 'anulata' || aplicare.status === 'omisa') {
    return 'bg-[var(--text-secondary)]'
  }
  return 'bg-[var(--status-danger-text)]'
}

function getQuantityLabel(aplicare: AplicareTratamentDetaliu): string | null {
  const firstProduct = aplicare.produse_aplicare?.[0]
  if (firstProduct?.cantitate_text?.trim()) return firstProduct.cantitate_text.trim()
  if (typeof firstProduct?.cantitate_totala === 'number' && firstProduct.unitate_cantitate) {
    return `${firstProduct.cantitate_totala} ${firstProduct.unitate_cantitate}`
  }
  if (typeof aplicare.doza_ml_per_hl === 'number') return `${aplicare.doza_ml_per_hl} ml/hl`
  if (typeof aplicare.doza_l_per_ha === 'number') return `${aplicare.doza_l_per_ha} l/ha`
  return null
}

function getProductType(aplicare: AplicareTratamentDetaliu): string | null {
  const firstProduct = aplicare.produse_aplicare?.[0]
  return firstProduct?.tip_snapshot?.trim() || firstProduct?.produs?.tip?.trim() || aplicare.produs?.tip?.trim() || null
}

function getMethodLabel(aplicare: AplicareTratamentDetaliu): string | null {
  const method = normalizeMetodaAplicare(aplicare.metoda_aplicare)
  return method ? METODA_APLICARE_LABEL_RO[method] : null
}

export function AplicareListaClient({ aplicari, parcelaId }: AplicareListaClientProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedAplicare, setSelectedAplicare] = useState<AplicareTratamentDetaliu | null>(null)
  const [isPending, startTransition] = useTransition()

  const groups = useMemo<AplicareGroup[]>(() => {
    const grouped = new Map<string, AplicareTratamentDetaliu[]>()
    aplicari.forEach((aplicare) => {
      const key = getDateKey(getAplicareDate(aplicare))
      grouped.set(key, [...(grouped.get(key) ?? []), aplicare])
    })

    return Array.from(grouped.entries())
      .sort(([first], [second]) => second.localeCompare(first))
      .map(([dateKey, items]) => ({
        dateKey,
        label: getGroupLabel(dateKey),
        aplicari: items,
      }))
  }, [aplicari])

  const handleDelete = () => {
    if (!selectedAplicare) return

    startTransition(async () => {
      const result = await deleteAplicareAction(selectedAplicare.id, parcelaId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicare ștearsă')
      setSelectedAplicare(null)
      setExpandedId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 text-sm text-[var(--text-primary)] [font-weight:700]">
              {group.label}
            </h2>
            <div className="h-px flex-1 bg-[var(--divider)]" />
            <span className="shrink-0 rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] [font-weight:700]">
              {group.aplicari.length}
            </span>
          </div>

          <div className="space-y-2">
            {group.aplicari.map((aplicare) => {
              const expanded = expandedId === aplicare.id
              const productsSummary = getAplicareProduseSummary(aplicare)
              const quantity = getQuantityLabel(aplicare)
              const productType = getProductType(aplicare)
              const method = getMethodLabel(aplicare)
              const parcelaLabel =
                aplicare.parcela?.nume_parcela ?? aplicare.parcela?.id_parcela ?? 'Parcelă'
              const meta = [parcelaLabel, quantity, productType ?? method].filter(Boolean)
              const isManual = getAplicareSourceLabel(aplicare) === 'Manuală'

              return (
                <article
                  key={aplicare.id}
                  className="flex overflow-hidden rounded-[18px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]"
                >
                  <span className={cn('w-1.5 shrink-0', getAccentClass(aplicare))} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="flex min-h-[76px] w-full items-center gap-3 px-3.5 py-3 text-left transition active:scale-[0.985]"
                      onClick={() => setExpandedId((current) => (current === aplicare.id ? null : aplicare.id))}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="min-w-0 truncate text-sm text-[var(--text-primary)] [font-weight:700]">
                            {productsSummary.title}
                          </h3>
                          {isManual ? (
                            <span className="shrink-0 rounded-full bg-[var(--surface-card-muted)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] [font-weight:700]">
                              Manuală
                            </span>
                          ) : null}
                        </div>
                        {productsSummary.detail ? (
                          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                            {productsSummary.detail}
                          </p>
                        ) : null}
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                          {meta.join(' · ')}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
                          expanded && 'rotate-180'
                        )}
                      />
                    </button>

                    {expanded ? (
                      <div className="border-t border-[var(--divider)] px-3.5 pb-3.5 pt-3">
                        <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] [font-weight:700]">
                            Scop
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-primary)]">
                            {aplicare.scop?.trim() || getAplicareInterventieLabel(aplicare)}
                          </p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <EditAplicareButton
                            aplicareId={aplicare.id}
                            variant="outline"
                            className="min-h-11 flex-1"
                          >
                            Editează
                          </EditAplicareButton>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 flex-1 border-[var(--status-danger-border)] text-[var(--status-danger-text)]"
                            disabled={isPending}
                            onClick={() => setSelectedAplicare(aplicare)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Șterge
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <AlertDialog
        open={selectedAplicare !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedAplicare(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi această aplicare?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea nu poate fi anulată. Va fi ștearsă doar aplicarea selectată și produsele asociate ei.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
            >
              {isPending ? 'Se șterge...' : 'Șterge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
