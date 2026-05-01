'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { InterventiePlanificataFormSummary } from '@/components/tratamente/InterventiePlanificataFormSummary'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
  FormDialogLayout,
} from '@/components/ui/form-dialog-layout'
import {
  Dialog,
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
import { ProdusFitosanitarPicker } from '@/components/tratamente/ProdusFitosanitarPicker'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { queryKeys } from '@/lib/query-keys'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { getCohortaLabel, type Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { saveProdusFitosanitarInLibraryAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'

import {
  filterProduseForCulture,
  formatDoza,
  getProdusDisplayName,
  getProdusDraftDisplayName,
  getStadiuMeta,
  getStadiuOptions,
  inferDoseUnitFromProduct,
  suggestDoseFromProduct,
} from '@/components/tratamente/plan-wizard/helpers'
import {
  createEmptyLine,
  createEmptyLineProduct,
  ensureConsecutiveOrdine,
  linieDraftSchema,
  type PlanWizardLinieDraft,
  type PlanWizardLinieProdusDraft,
} from '@/components/tratamente/plan-wizard/types'

interface PlanWizardStepLiniiProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  grupBiologic?: GrupBiologic | null
  linii: PlanWizardLinieDraft[]
  produse: ProdusFitosanitar[]
  onChange: (nextLinii: PlanWizardLinieDraft[]) => void
}

interface LinieEditorProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  grupBiologic?: GrupBiologic | null
  initialValue: PlanWizardLinieDraft
  onCancel: () => void
  onSave: (linie: PlanWizardLinieDraft) => void
  open: boolean
  produse: ProdusFitosanitar[]
}

type LinieEditorErrors = Partial<Record<'stadiu_trigger' | 'produse' | 'regula_repetare', string>>

const TIP_INTERVENTIE_OPTIONS = [
  { value: 'protectie', label: 'Protecție' },
  { value: 'nutritie', label: 'Nutriție' },
  { value: 'biostimulare', label: 'Biostimulare' },
  { value: 'erbicidare', label: 'Erbicidare' },
  { value: 'igiena', label: 'Igienă' },
  { value: 'monitorizare', label: 'Monitorizare' },
  { value: 'altul', label: 'Altul' },
] as const

const TIP_INTERVENTIE_LABELS = new Map(TIP_INTERVENTIE_OPTIONS.map((option) => [option.value, option.label]))

function getLinieErrors(value: PlanWizardLinieDraft): LinieEditorErrors {
  const parsed = linieDraftSchema.safeParse(value)
  if (parsed.success) return {}

  return parsed.error.issues.reduce<LinieEditorErrors>((accumulator, issue) => {
    const key = issue.path[0]
    if (key === 'stadiu_trigger' || key === 'produse' || key === 'regula_repetare') {
      accumulator[key] = issue.message
    }
    if (key === 'produs_id') {
      accumulator.produse = issue.message
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

function withProductOrder(produse: PlanWizardLinieProdusDraft[]) {
  return produse.map((produs, index) => ({ ...produs, ordine: index + 1 }))
}

function moveProduct(
  produse: PlanWizardLinieProdusDraft[],
  produsId: string,
  direction: 'up' | 'down'
) {
  const currentIndex = produse.findIndex((produs) => produs.id === produsId)
  if (currentIndex === -1) return produse

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= produse.length) return produse

  const clone = [...produse]
  const [item] = clone.splice(currentIndex, 1)
  clone.splice(nextIndex, 0, item)
  return withProductOrder(clone)
}

function updateProductFromCatalog(
  draft: PlanWizardLinieProdusDraft,
  product: ProdusFitosanitar | null
): PlanWizardLinieProdusDraft {
  if (!product) {
    return {
      ...draft,
      produs_id: null,
      produs_nume_snapshot: null,
    }
  }

  const nextUnit = inferDoseUnitFromProduct(product)
  const suggestedDose = suggestDoseFromProduct(product, nextUnit)

  return {
    ...draft,
    produs_id: product.id,
    produs_nume_manual: '',
    produs_nume_snapshot: product.nume_comercial,
    substanta_activa_snapshot: product.substanta_activa ?? '',
    tip_snapshot: product.tip ?? '',
    frac_irac_snapshot: product.frac_irac ?? '',
    phi_zile_snapshot: product.phi_zile ?? null,
    doza_ml_per_hl: nextUnit === 'ml/hl' ? suggestedDose ?? draft.doza_ml_per_hl : draft.doza_ml_per_hl,
    doza_l_per_ha: nextUnit === 'l/ha' ? suggestedDose ?? draft.doza_l_per_ha : draft.doza_l_per_ha,
  }
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function productDoseLabel(produs: PlanWizardLinieProdusDraft) {
  const doses = [
    produs.doza_ml_per_hl !== null && produs.doza_ml_per_hl !== undefined
      ? formatDoza(produs.doza_ml_per_hl, 'ml/hl')
      : null,
    produs.doza_l_per_ha !== null && produs.doza_l_per_ha !== undefined
      ? formatDoza(produs.doza_l_per_ha, 'l/ha')
      : null,
  ].filter(Boolean)

  return doses.length > 0 ? doses.join(' · ') : 'Doză necompletată'
}

function formatDoseSummary(produs: PlanWizardLinieProdusDraft): string | null {
  const values = [
    typeof produs.doza_ml_per_hl === 'number' ? `${produs.doza_ml_per_hl} ml/hl` : null,
    typeof produs.doza_l_per_ha === 'number' ? `${produs.doza_l_per_ha} l/ha` : null,
  ].filter(Boolean)

  return values.length > 0 ? values.join(' · ') : null
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
        <FormDialogLayout
          title={title}
          description={description}
          footer={
            <DialogFormActions
              onCancel={onCancel}
              onSave={onSave}
              disabled={saveDisabled}
              saveLabel="Salvează intervenția"
            />
          }
          showCloseButton
          desktopFormWide
          contentClassName="md:w-[min(96vw,84rem)] md:max-w-none"
        >
          {children}
        </FormDialogLayout>
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
            Salvează intervenția
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function LinieEditor({
  allowCohortTrigger = false,
  culturaTip,
  grupBiologic,
  initialValue,
  onCancel,
  onSave,
  open,
  produse,
}: LinieEditorProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [value, setValue] = useState<PlanWizardLinieDraft>(initialValue)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setValue(initialValue)
        setShowAllProducts(false)
      })
    }
  }, [initialValue, open])

  const errors = useMemo(() => getLinieErrors(value), [value])
  const stadiuOptions = useMemo(() => getStadiuOptions(grupBiologic), [grupBiologic])
  const filteredProducts = useMemo(
    () => filterProduseForCulture(produse, culturaTip, showAllProducts, ''),
    [culturaTip, produse, showAllProducts]
  )
  const saveProductToLibrary = useMutation({
    mutationFn: saveProdusFitosanitarInLibraryAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
    },
  })
  const saveDisabled = Object.keys(errors).length > 0
  const selectedStadiuLabel = useMemo(() => {
    const option = stadiuOptions.find((item) => item.value === value.stadiu_trigger)
    return option?.label ?? value.stadiu_trigger.trim() ?? null
  }, [stadiuOptions, value.stadiu_trigger])
  const summaryProducts = useMemo(
    () =>
      value.produse.map((produsDraft) => ({
        id: produsDraft.id,
        name: getProdusDraftDisplayName(produsDraft, produse),
        doseLabel: formatDoseSummary(produsDraft),
        metaLabel: [
          produsDraft.frac_irac_snapshot?.trim() ? `FRAC ${produsDraft.frac_irac_snapshot.trim()}` : null,
          typeof produsDraft.phi_zile_snapshot === 'number' ? `PHI ${produsDraft.phi_zile_snapshot} zile` : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      })),
    [produse, value.produse]
  )

  const updateProduct = (produsId: string, update: (produs: PlanWizardLinieProdusDraft) => PlanWizardLinieProdusDraft) => {
    setValue((current) => ({
      ...current,
      produse: withProductOrder(current.produse.map((produs) => (produs.id === produsId ? update(produs) : produs))),
    }))
  }

  const addProduct = () => {
    setValue((current) => ({
      ...current,
      produse: [...current.produse, createEmptyLineProduct(current.produse.length + 1)],
    }))
  }

  const removeProduct = (produsId: string) => {
    setValue((current) => ({
      ...current,
      produse: withProductOrder(current.produse.filter((produs) => produs.id !== produsId)),
    }))
  }

  const productsBlock = (
    <div className="space-y-2 rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <Label>Produse planificate *</Label>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Adaugă unul sau mai multe produse folosite în aceeași intervenție.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addProduct}>
          <Plus className="h-4 w-4" />
          Adaugă produs
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={showAllProducts}
          onChange={(event) => setShowAllProducts(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
        />
        Arată toate produsele din bibliotecă
      </label>

      {value.produse.length === 0 ? (
        <p className="rounded-2xl border border-[var(--soft-danger-border)] bg-[var(--soft-danger-bg)] p-3 text-sm text-[var(--soft-danger-text)]">
          Intervenția trebuie să aibă cel puțin un produs.
        </p>
      ) : null}

      <div className="space-y-2">
        {value.produse.map((produsDraft, index) => {
          const selectedProduct = produse.find((produs) => produs.id === produsDraft.produs_id) ?? null
          const availableProducts =
            selectedProduct && !filteredProducts.some((produs) => produs.id === selectedProduct.id)
              ? [selectedProduct, ...filteredProducts]
              : filteredProducts

          return (
            <div
              key={produsDraft.id}
              className="rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-card)] p-2"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2.5">
                <div>
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produs #{index + 1}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {getProdusDraftDisplayName(produsDraft, produse)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută sus produsul ${index + 1}`} disabled={index === 0} onClick={() => setValue((current) => ({ ...current, produse: moveProduct(current.produse, produsDraft.id, 'up') }))}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută jos produsul ${index + 1}`} disabled={index === value.produse.length - 1} onClick={() => setValue((current) => ({ ...current, produse: moveProduct(current.produse, produsDraft.id, 'down') }))}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Șterge produsul ${index + 1}`} onClick={() => removeProduct(produsDraft.id)}>
                    <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 md:gap-x-3">
                <div className="space-y-2">
                  <Label htmlFor={`linie-produs-${produsDraft.id}`}>Produs din bibliotecă</Label>
                  <ProdusFitosanitarPicker
                    produse={availableProducts}
                    value={produsDraft.produs_id ?? null}
                    selectedLabel={
                      (produsDraft.produs_nume_snapshot || produsDraft.produs_nume_manual || '').trim() || null
                    }
                    onChange={(product) =>
                      updateProduct(produsDraft.id, (current) => {
                        if (!product) {
                          const fallbackName = current.produs_nume_snapshot || current.produs_nume_manual || ''
                          return {
                            ...current,
                            produs_id: null,
                            produs_nume_manual: fallbackName,
                            produs_nume_snapshot: fallbackName || null,
                          }
                        }

                        return updateProductFromCatalog(current, product)
                      })
                    }
                    onCreateProduct={saveProductToLibrary.mutateAsync}
                    placeholder="Adaugă manual"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`linie-manual-${produsDraft.id}`}>Nume manual</Label>
                  <Input
                    id={`linie-manual-${produsDraft.id}`}
                    value={produsDraft.produs_nume_manual ?? ''}
                    disabled={Boolean(produsDraft.produs_id)}
                    placeholder="Ex: Produs local / lot test"
                    onChange={(event) =>
                      updateProduct(produsDraft.id, (current) => ({
                        ...current,
                        produs_id: null,
                        produs_nume_manual: event.target.value,
                        produs_nume_snapshot: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`linie-substanta-${produsDraft.id}`}>Substanță activă</Label>
                  <Input
                    id={`linie-substanta-${produsDraft.id}`}
                    value={produsDraft.substanta_activa_snapshot ?? ''}
                    onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, substanta_activa_snapshot: event.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-2">
                    <Label htmlFor={`linie-tip-produs-${produsDraft.id}`}>Tip produs</Label>
                    <Input
                      id={`linie-tip-produs-${produsDraft.id}`}
                      value={produsDraft.tip_snapshot ?? ''}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, tip_snapshot: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`linie-frac-${produsDraft.id}`}>FRAC/IRAC</Label>
                    <Input
                      id={`linie-frac-${produsDraft.id}`}
                      value={produsDraft.frac_irac_snapshot ?? ''}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, frac_irac_snapshot: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 md:col-span-2">
                  <div className="space-y-2">
                    <Label htmlFor={`linie-phi-${produsDraft.id}`}>PHI zile</Label>
                    <Input
                      id={`linie-phi-${produsDraft.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={produsDraft.phi_zile_snapshot ?? ''}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, phi_zile_snapshot: parseOptionalNumber(event.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`linie-doza-ml-${produsDraft.id}`}>Doză ml/hl</Label>
                    <Input
                      id={`linie-doza-ml-${produsDraft.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={produsDraft.doza_ml_per_hl ?? ''}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, doza_ml_per_hl: parseOptionalNumber(event.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`linie-doza-l-${produsDraft.id}`}>Doză l/ha</Label>
                    <Input
                      id={`linie-doza-l-${produsDraft.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={produsDraft.doza_l_per_ha ?? ''}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, doza_l_per_ha: parseOptionalNumber(event.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`linie-produs-note-${produsDraft.id}`}>Observații produs</Label>
                  <Textarea
                    id={`linie-produs-note-${produsDraft.id}`}
                    rows={2}
                    value={produsDraft.observatii ?? ''}
                    onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, observatii: event.target.value }))}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {errors.produse ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.produse}</p> : null}
    </div>
  )

  const mobileContent = (
    <div className="space-y-4">
      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="linie-stadiu">Fenofază *</Label>
          <select
            id="linie-stadiu"
            value={value.stadiu_trigger}
            onChange={(event) => setValue((current) => ({ ...current, stadiu_trigger: event.target.value }))}
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Alege fenofaza</option>
            {stadiuOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
          {errors.stadiu_trigger ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.stadiu_trigger}</p> : null}
        </div>

        {allowCohortTrigger ? (
          <div className="space-y-2">
            <Label htmlFor="linie-cohorta">Cohortă vizată</Label>
            <select
              id="linie-cohorta"
              value={value.cohort_trigger ?? ''}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  cohort_trigger: event.target.value ? (event.target.value as Cohorta) : null,
                }))
              }
              className="agri-control h-11 w-full rounded-xl px-3 text-sm"
            >
              <option value="">Ambele cohorte</option>
              <option value="floricane">Doar {getCohortaLabel('floricane')}</option>
              <option value="primocane">Doar {getCohortaLabel('primocane')}</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="linie-tip-interventie">Tip intervenție</Label>
          <select
            id="linie-tip-interventie"
            value={value.tip_interventie ?? ''}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                tip_interventie: event.target.value ? event.target.value as PlanWizardLinieDraft['tip_interventie'] : null,
              }))
            }
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Nespecificat</option>
            {TIP_INTERVENTIE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="linie-regula">Regulă repetare</Label>
          <select
            id="linie-regula"
            value={value.regula_repetare}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                regula_repetare: event.target.value as PlanWizardLinieDraft['regula_repetare'],
              }))
            }
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="fara_repetare">Fără repetare</option>
            <option value="interval">Repetare la interval</option>
          </select>
        </div>
      </div>

      {value.regula_repetare === 'interval' ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="linie-interval">Interval repetare zile</Label>
            <Input
              id="linie-interval"
              type="number"
              min="1"
              step="1"
              value={value.interval_repetare_zile ?? ''}
              onChange={(event) =>
                setValue((current) => ({ ...current, interval_repetare_zile: parseOptionalNumber(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linie-repetari">Număr repetări maxim</Label>
            <Input
              id="linie-repetari"
              type="number"
              min="1"
              step="1"
              value={value.numar_repetari_max ?? ''}
              onChange={(event) =>
                setValue((current) => ({ ...current, numar_repetari_max: parseOptionalNumber(event.target.value) }))
              }
            />
          </div>
          {errors.regula_repetare ? <p className="text-sm text-[var(--soft-danger-text)] md:col-span-2">{errors.regula_repetare}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="linie-scop">Scop</Label>
        <Input
          id="linie-scop"
          value={value.scop ?? ''}
          placeholder="Ex: prevenție botrytis, corecție calciu"
          onChange={(event) => setValue((current) => ({ ...current, scop: event.target.value }))}
        />
      </div>

      {productsBlock}

      <div className="space-y-2">
        <Label htmlFor="linie-observatii">Observații intervenție</Label>
        <Textarea
          id="linie-observatii"
          rows={4}
          value={value.observatii ?? ''}
          placeholder="Note despre ordinea amestecului, fereastra meteo, sensibilități de soi."
          onChange={(event) => setValue((current) => ({ ...current, observatii: event.target.value }))}
        />
      </div>
    </div>
  )

  const desktopContent = (
    <DesktopFormGrid
      className="md:grid-cols-[minmax(0,1fr)_18rem] md:gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-5"
      aside={
        <InterventiePlanificataFormSummary
          stadiuLabel={selectedStadiuLabel}
          cohortLabel={value.cohort_trigger ? getCohortaLabel(value.cohort_trigger) : null}
          tipInterventie={
            value.tip_interventie ? TIP_INTERVENTIE_LABELS.get(value.tip_interventie) ?? value.tip_interventie : null
          }
          scop={value.scop ?? null}
          regulaRepetare={value.regula_repetare === 'interval' ? 'Repetare la interval' : 'Fără repetare'}
          intervalLabel={
            value.regula_repetare === 'interval' && typeof value.interval_repetare_zile === 'number'
              ? `${value.interval_repetare_zile} zile`
              : null
          }
          repetariLabel={
            value.regula_repetare === 'interval' && typeof value.numar_repetari_max === 'number'
              ? `${value.numar_repetari_max}`
              : null
          }
          products={summaryProducts}
          className="md:rounded-[22px] md:p-4 lg:p-5"
        />
      }
    >
      <FormDialogSection>
        <DesktopFormPanel>
          <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
            <div className="space-y-2">
              <Label htmlFor="linie-stadiu">Fenofază *</Label>
              <select
                id="linie-stadiu"
                value={value.stadiu_trigger}
                onChange={(event) => setValue((current) => ({ ...current, stadiu_trigger: event.target.value }))}
                className="agri-control h-11 w-full rounded-xl px-3 text-sm"
              >
                <option value="">Alege fenofaza</option>
                {stadiuOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.emoji} {option.label}
                  </option>
                ))}
              </select>
              {errors.stadiu_trigger ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.stadiu_trigger}</p> : null}
            </div>

            {allowCohortTrigger ? (
              <div className="space-y-2">
                <Label htmlFor="linie-cohorta">Cohortă vizată</Label>
                <select
                  id="linie-cohorta"
                  value={value.cohort_trigger ?? ''}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      cohort_trigger: event.target.value ? (event.target.value as Cohorta) : null,
                    }))
                  }
                  className="agri-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  <option value="">Ambele cohorte</option>
                  <option value="floricane">Doar {getCohortaLabel('floricane')}</option>
                  <option value="primocane">Doar {getCohortaLabel('primocane')}</option>
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="linie-tip-interventie">Tip intervenție</Label>
              <select
                id="linie-tip-interventie"
                value={value.tip_interventie ?? ''}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    tip_interventie: event.target.value ? event.target.value as PlanWizardLinieDraft['tip_interventie'] : null,
                  }))
                }
                className="agri-control h-11 w-full rounded-xl px-3 text-sm"
              >
                <option value="">Nespecificat</option>
                {TIP_INTERVENTIE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linie-scop">Scop</Label>
              <Input
                id="linie-scop"
                value={value.scop ?? ''}
                placeholder="Ex: prevenție botrytis, corecție calciu"
                onChange={(event) => setValue((current) => ({ ...current, scop: event.target.value }))}
              />
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>

      <FormDialogSection>
        <DesktopFormPanel>{productsBlock}</DesktopFormPanel>
      </FormDialogSection>

      <FormDialogSection>
        <DesktopFormPanel>
          <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
            <div className="space-y-2">
              <Label htmlFor="linie-regula">Regulă repetare</Label>
              <select
                id="linie-regula"
                value={value.regula_repetare}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    regula_repetare: event.target.value as PlanWizardLinieDraft['regula_repetare'],
                  }))
                }
                className="agri-control h-11 w-full rounded-xl px-3 text-sm"
              >
                <option value="fara_repetare">Fără repetare</option>
                <option value="interval">Repetare la interval</option>
              </select>
            </div>

            {value.regula_repetare === 'interval' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="linie-interval">Interval repetare zile</Label>
                  <Input
                    id="linie-interval"
                    type="number"
                    min="1"
                    step="1"
                    value={value.interval_repetare_zile ?? ''}
                    onChange={(event) =>
                      setValue((current) => ({ ...current, interval_repetare_zile: parseOptionalNumber(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linie-repetari">Număr repetări maxim</Label>
                  <Input
                    id="linie-repetari"
                    type="number"
                    min="1"
                    step="1"
                    value={value.numar_repetari_max ?? ''}
                    onChange={(event) =>
                      setValue((current) => ({ ...current, numar_repetari_max: parseOptionalNumber(event.target.value) }))
                    }
                  />
                </div>
                {errors.regula_repetare ? <p className="text-sm text-[var(--soft-danger-text)] md:col-span-2">{errors.regula_repetare}</p> : null}
              </>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="linie-observatii">Observații intervenție</Label>
              <Textarea
                id="linie-observatii"
                rows={4}
                value={value.observatii ?? ''}
                placeholder="Note despre ordinea amestecului, fereastra meteo, sensibilități de soi."
                onChange={(event) => setValue((current) => ({ ...current, observatii: event.target.value }))}
              />
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )

  return (
    <EditorChrome
      description="Alege fenofaza, tipul intervenției și produsele planificate pentru aceeași intervenție."
      isDesktop={isDesktop}
      onCancel={onCancel}
      onSave={() => onSave(value)}
      open={open}
      saveDisabled={saveDisabled}
      title={initialValue.id === value.id && initialValue.stadiu_trigger ? 'Editează intervenția' : 'Adaugă intervenție'}
    >
      {isDesktop ? desktopContent : mobileContent}
    </EditorChrome>
  )
}

export function PlanWizardStepLinii({
  allowCohortTrigger = false,
  culturaTip,
  grupBiologic,
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
              Intervenții planificate
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Adaugă intervenții pe fenofaze și configurează unul sau mai multe produse pentru fiecare.
            </p>
          </div>
          <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adaugă intervenție</span>
          </Button>
        </div>
      </AppCard>

      {orderedLines.length === 0 ? (
        <AppCard className="rounded-[22px] border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nu ai adăugat încă nicio intervenție. Începe cu prima fenofază din plan.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={handleAdd}>
            + Adaugă intervenție
          </Button>
        </AppCard>
      ) : (
        <div className="space-y-3">
          {orderedLines.map((linie, index) => {
            const stadiu = getStadiuMeta(linie.stadiu_trigger, grupBiologic, linie.cohort_trigger)
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
                          {linie.tip_interventie ? (
                            <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                              {TIP_INTERVENTIE_OPTIONS.find((option) => option.value === linie.tip_interventie)?.label ?? linie.tip_interventie}
                            </span>
                          ) : null}
                          {allowCohortTrigger ? (
                            <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                              {linie.cohort_trigger ? getCohortaLabel(linie.cohort_trigger) : 'Ambele cohorte'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 truncate text-base text-[var(--text-primary)] [font-weight:650]">
                          {getProdusDisplayName(linie, produse)}
                        </p>
                        <div className="mt-2 space-y-1">
                          {linie.produse.map((produs) => (
                            <p key={produs.id} className="text-sm text-[var(--text-secondary)]">
                              {getProdusDraftDisplayName(produs, produse)} · {productDoseLabel(produs)}
                            </p>
                          ))}
                        </div>
                        {linie.scop?.trim() ? (
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">{linie.scop}</p>
                        ) : null}
                        {linie.observatii?.trim() ? (
                          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                            {linie.observatii}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută sus intervenția ${index + 1}`} onClick={() => onChange(moveLinie(orderedLines, linie.id, 'up'))} disabled={index === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută jos intervenția ${index + 1}`} onClick={() => onChange(moveLinie(orderedLines, linie.id, 'down'))} disabled={index === orderedLines.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editează intervenția ${index + 1}`} onClick={() => handleEdit(linie)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Șterge intervenția ${index + 1}`} onClick={() => setDeleteConfirmId(isDeleteConfirming ? null : linie.id)}>
                          <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
                        </Button>
                      </div>
                    </div>

                    {isDeleteConfirming ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] bg-[var(--surface-card-muted)] p-3">
                        <p className="text-sm text-[var(--text-secondary)]">Ștergi această intervenție din plan?</p>
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
          allowCohortTrigger={allowCohortTrigger}
          culturaTip={culturaTip}
          grupBiologic={grupBiologic}
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
