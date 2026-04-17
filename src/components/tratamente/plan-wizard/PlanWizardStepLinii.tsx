'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

import {
  filterProduseForCulture,
  formatDoza,
  getProdusDisplayName,
  getStadiuMeta,
  inferDoseUnitFromProduct,
  STADIU_OPTIONS,
  suggestDoseFromProduct,
} from '@/components/tratamente/plan-wizard/helpers'
import {
  createEmptyLine,
  ensureConsecutiveOrdine,
  linieDraftSchema,
  type LinieDozaUnitate,
  type PlanWizardLinieDraft,
} from '@/components/tratamente/plan-wizard/types'

interface PlanWizardStepLiniiProps {
  culturaTip: string
  linii: PlanWizardLinieDraft[]
  produse: ProdusFitosanitar[]
  onChange: (nextLinii: PlanWizardLinieDraft[]) => void
}

interface LinieEditorProps {
  culturaTip: string
  initialValue: PlanWizardLinieDraft
  onCancel: () => void
  onSave: (linie: PlanWizardLinieDraft) => void
  open: boolean
  produse: ProdusFitosanitar[]
}

type LinieEditorErrors = Partial<Record<'stadiu_trigger' | 'produs_id' | 'doza', string>>

function getLinieErrors(value: PlanWizardLinieDraft): LinieEditorErrors {
  const parsed = linieDraftSchema.safeParse(value)
  if (parsed.success) return {}

  return parsed.error.issues.reduce<LinieEditorErrors>((accumulator, issue) => {
    const key = issue.path[0]
    if (key === 'stadiu_trigger' || key === 'produs_id' || key === 'doza') {
      accumulator[key] = issue.message
    }
    return accumulator
  }, {})
}

function sortByOrdine(linii: PlanWizardLinieDraft[]) {
  return [...linii].sort((first, second) => first.ordine - second.ordine)
}

function moveLinie(
  linii: PlanWizardLinieDraft[],
  lineId: string,
  direction: 'up' | 'down'
): PlanWizardLinieDraft[] {
  const ordered = sortByOrdine(linii)
  const currentIndex = ordered.findIndex((linie) => linie.id === lineId)
  if (currentIndex === -1) return ordered

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= ordered.length) return ordered

  const clone = [...ordered]
  const [item] = clone.splice(currentIndex, 1)
  clone.splice(nextIndex, 0, item)

  return ensureConsecutiveOrdine(clone)
}

function updateLineProduct(
  line: PlanWizardLinieDraft,
  product: ProdusFitosanitar | null
): PlanWizardLinieDraft {
  const nextUnit = inferDoseUnitFromProduct(product)
  const suggestedDose = suggestDoseFromProduct(product, nextUnit)

  return {
    ...line,
    produs_id: product?.id ?? null,
    produs_nume_manual: product ? '' : line.produs_nume_manual,
    dozaUnitate: nextUnit,
    doza: suggestedDose ?? line.doza,
  }
}

function EditorChrome({
  children,
  description,
  isDesktop,
  onCancel,
  onSave,
  open,
  saveDisabled,
  title,
}: {
  children: React.ReactNode
  description: string
  isDesktop: boolean
  onCancel: () => void
  onSave: () => void
  open: boolean
  saveDisabled: boolean
  title: string
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70dvh] overflow-y-auto pr-1">{children}</div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Anulează
            </Button>
            <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={onSave} disabled={saveDisabled}>
              Salvează linia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : null)}>
      <SheetContent side="bottom" className="rounded-t-[28px] pb-0">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="max-h-[68dvh] overflow-y-auto px-4 pb-6">{children}</div>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Anulează
          </Button>
          <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={onSave} disabled={saveDisabled}>
            Salvează linia
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function LinieEditor({
  culturaTip,
  initialValue,
  onCancel,
  onSave,
  open,
  produse,
}: LinieEditorProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [value, setValue] = useState<PlanWizardLinieDraft>(initialValue)
  const [search, setSearch] = useState('')
  const [showAllProducts, setShowAllProducts] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setSearch('')
      setShowAllProducts(false)
    }
  }, [initialValue, open])

  const errors = useMemo(() => getLinieErrors(value), [value])
  const selectedProduct = useMemo(
    () => produse.find((produs) => produs.id === value.produs_id) ?? null,
    [produse, value.produs_id]
  )

  const filteredProducts = useMemo(
    () => filterProduseForCulture(produse, culturaTip, showAllProducts, search).slice(0, 8),
    [culturaTip, produse, search, showAllProducts]
  )

  const saveDisabled = Object.keys(errors).length > 0

  const handleUnitChange = (unitate: LinieDozaUnitate) => {
    setValue((current) => {
      const suggestedDose = suggestDoseFromProduct(selectedProduct, unitate)

      return {
        ...current,
        dozaUnitate: unitate,
        doza: suggestedDose ?? current.doza,
      }
    })
  }

  return (
    <EditorChrome
      description="Alege stadiul, produsul și doza recomandată pentru această aplicare."
      isDesktop={isDesktop}
      onCancel={onCancel}
      onSave={() => onSave(value)}
      open={open}
      saveDisabled={saveDisabled}
      title={initialValue.id === value.id && initialValue.stadiu_trigger ? 'Editează linia' : 'Adaugă linie tratament'}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="linie-stadiu">Stadiu fenologic *</Label>
          <select
            id="linie-stadiu"
            value={value.stadiu_trigger}
            onChange={(event) => setValue((current) => ({ ...current, stadiu_trigger: event.target.value }))}
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Alege stadiul</option>
            {STADIU_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
          {errors.stadiu_trigger ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.stadiu_trigger}</p> : null}
        </div>

        <div className="space-y-3 rounded-[20px] bg-[var(--surface-card-muted)] p-4">
          <div className="space-y-2">
            <Label htmlFor="linie-produs-search">Produs din bibliotecă</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                id="linie-produs-search"
                value={search}
                placeholder="Caută după nume, substanță sau FRAC"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={showAllProducts}
              onChange={(event) => setShowAllProducts(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
            />
            Arată toate produsele
          </label>

          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Nu am găsit produse pentru filtrul curent.
              </p>
            ) : (
              filteredProducts.map((produs) => {
                const isSelected = produs.id === value.produs_id

                return (
                  <button
                    key={produs.id}
                    type="button"
                    className={`flex w-full items-start justify-between rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)]'
                        : 'border-[var(--border-default)] bg-white'
                    }`}
                    onClick={() => setValue((current) => updateLineProduct(current, produs))}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text-primary)] [font-weight:650]">
                        {produs.nume_comercial}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {produs.substanta_activa}
                        {produs.frac_irac ? ` · ${produs.frac_irac}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      {produs.tenant_id === null ? (
                        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
                          Standard
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="text-xs text-[var(--agri-primary)] [font-weight:650]">Selectat</span>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {!selectedProduct ? (
          <div className="space-y-2">
            <Label htmlFor="linie-manual">Nume produs manual</Label>
            <Input
              id="linie-manual"
              value={value.produs_nume_manual ?? ''}
              placeholder="Ex: Produs local / lot test"
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  produs_id: null,
                  produs_nume_manual: event.target.value,
                }))
              }
            />
            {errors.produs_id ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.produs_id}</p> : null}
          </div>
        ) : (
          <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Produs selectat</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                  {selectedProduct.nume_comercial}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">{selectedProduct.substanta_activa}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setValue((current) => ({
                    ...current,
                    produs_id: null,
                    produs_nume_manual: '',
                  }))
                }
              >
                Elimină
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label>Unitate doză *</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['ml/hl', 'l/ha'] as const).map((unitate) => (
              <button
                key={unitate}
                type="button"
                className={`rounded-2xl border px-3 py-3 text-sm [font-weight:650] transition ${
                  value.dozaUnitate === unitate
                    ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                }`}
                onClick={() => handleUnitChange(unitate)}
              >
                {unitate}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="linie-doza">Doză *</Label>
          <Input
            id="linie-doza"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={value.doza > 0 ? String(value.doza) : ''}
            placeholder={value.dozaUnitate === 'ml/hl' ? 'Ex: 200' : 'Ex: 1.5'}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                doza: Number(event.target.value.replace(',', '.')) || 0,
              }))
            }
          />
          <div className="flex items-center justify-between gap-3">
            {errors.doza ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.doza}</p> : <span />}
            {selectedProduct ? (
              <span className="text-xs text-[var(--text-tertiary)]">
                Sugerat: {formatDoza(suggestDoseFromProduct(selectedProduct, value.dozaUnitate), value.dozaUnitate)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="linie-observatii">Observații</Label>
          <Textarea
            id="linie-observatii"
            rows={4}
            value={value.observatii ?? ''}
            placeholder="Note despre ordinea amestecului, fereastra meteo, sensibilități de soi."
            onChange={(event) => setValue((current) => ({ ...current, observatii: event.target.value }))}
          />
        </div>
      </div>
    </EditorChrome>
  )
}

export function PlanWizardStepLinii({
  culturaTip,
  linii,
  produse,
  onChange,
}: PlanWizardStepLiniiProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<PlanWizardLinieDraft | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const orderedLines = useMemo(() => sortByOrdine(linii), [linii])

  const handleAdd = () => {
    setEditingLine(createEmptyLine(orderedLines.length + 1))
    setEditorOpen(true)
  }

  const handleEdit = (linie: PlanWizardLinieDraft) => {
    setEditingLine(linie)
    setEditorOpen(true)
  }

  const handleDelete = (lineId: string) => {
    onChange(ensureConsecutiveOrdine(orderedLines.filter((linie) => linie.id !== lineId)))
    setDeleteConfirmId(null)
  }

  const handleSaveLine = (line: PlanWizardLinieDraft) => {
    const exists = orderedLines.some((item) => item.id === line.id)
    const next = exists
      ? orderedLines.map((item) => (item.id === line.id ? line : item))
      : [...orderedLines, line]

    onChange(ensureConsecutiveOrdine(next))
    setEditorOpen(false)
    setEditingLine(null)
  }

  return (
    <div className="space-y-4">
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Linii de tratament
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Adaugă cel puțin o aplicare și ordonează liniile în secvența dorită.
            </p>
          </div>
          <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adaugă linie</span>
          </Button>
        </div>
      </AppCard>

      {orderedLines.length === 0 ? (
        <AppCard className="rounded-[22px] border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nu ai adăugat încă nicio linie. Începe cu prima aplicare din plan.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={handleAdd}>
            + Adaugă linie tratament
          </Button>
        </AppCard>
      ) : (
        <div className="space-y-3">
          {orderedLines.map((linie, index) => {
            const stadiu = getStadiuMeta(linie.stadiu_trigger)
            const isDeleteConfirming = deleteConfirmId === linie.id

            return (
              <AppCard key={linie.id} className="rounded-[22px] p-4">
                <div className="flex items-start gap-3">
                  <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--text-tertiary)] md:flex">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--surface-card-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                            #{linie.ordine}
                          </span>
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                            {stadiu.emoji} {stadiu.label}
                          </span>
                        </div>
                        <p className="mt-3 truncate text-base text-[var(--text-primary)] [font-weight:650]">
                          {getProdusDisplayName(linie, produse)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {formatDoza(linie.doza, linie.dozaUnitate)}
                        </p>
                        {linie.observatii?.trim() ? (
                          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                            {linie.observatii}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Mută sus linia ${index + 1}`}
                          onClick={() => onChange(moveLinie(orderedLines, linie.id, 'up'))}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Mută jos linia ${index + 1}`}
                          onClick={() => onChange(moveLinie(orderedLines, linie.id, 'down'))}
                          disabled={index === orderedLines.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editează linia ${index + 1}`}
                          onClick={() => handleEdit(linie)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Șterge linia ${index + 1}`}
                          onClick={() => setDeleteConfirmId(isDeleteConfirming ? null : linie.id)}
                        >
                          <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
                        </Button>
                      </div>
                    </div>

                    {isDeleteConfirming ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] bg-[var(--surface-card-muted)] p-3">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Ștergi această linie din plan?
                        </p>
                        <div className="ml-auto flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                            Renunță
                          </Button>
                          <Button type="button" size="sm" className="bg-[var(--soft-danger-text)] text-white" onClick={() => handleDelete(linie.id)}>
                            Confirmă
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </AppCard>
            )
          })}
        </div>
      )}

      {editingLine ? (
        <LinieEditor
          culturaTip={culturaTip}
          initialValue={editingLine}
          onCancel={() => {
            setEditorOpen(false)
            setEditingLine(null)
          }}
          onSave={handleSaveLine}
          open={editorOpen}
          produse={produse}
        />
      ) : null}
    </div>
  )
}
