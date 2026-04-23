'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { getCohortaLabel, type Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

import {
  filterProduseForCulture,
  getProdusDraftDisplayName,
  getStadiuOptions,
  inferDoseUnitFromProduct,
  suggestDoseFromProduct,
} from '@/components/tratamente/plan-wizard/helpers'
import {
  createEmptyLineProduct,
  type PlanWizardLinieDraft,
  type PlanWizardLinieProdusDraft,
} from '@/components/tratamente/plan-wizard/types'

export type LinieEditValue = {
  stadiu_trigger: string
  cohort_trigger: Cohorta | null
  tip_interventie: PlanWizardLinieDraft['tip_interventie']
  scop: string | null
  regula_repetare: PlanWizardLinieDraft['regula_repetare']
  interval_repetare_zile: number | null
  numar_repetari_max: number | null
  produs_id: string | null
  produs_nume_manual: string | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string | null
  produse: PlanWizardLinieProdusDraft[]
}

interface LinieEditDialogProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  grupBiologic?: GrupBiologic | null
  initialValue: LinieEditValue
  onOpenChange: (open: boolean) => void
  onSubmit: (data: LinieEditValue) => Promise<void> | void
  open: boolean
  pending?: boolean
  produse: ProdusFitosanitar[]
  title: string
}

const TIP_INTERVENTIE_OPTIONS = [
  { value: 'protectie', label: 'Protecție' },
  { value: 'nutritie', label: 'Nutriție' },
  { value: 'biostimulare', label: 'Biostimulare' },
  { value: 'erbicidare', label: 'Erbicidare' },
  { value: 'igiena', label: 'Igienă' },
  { value: 'monitorizare', label: 'Monitorizare' },
  { value: 'altul', label: 'Altul' },
] as const

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
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

function getValidationError(value: LinieEditValue): string | null {
  if (!value.stadiu_trigger.trim()) return 'Alege fenofaza.'
  if (value.produse.length === 0) return 'Intervenția trebuie să aibă cel puțin un produs.'

  const invalidProduct = value.produse.find((produs) => {
    const hasProdusId = typeof produs.produs_id === 'string' && produs.produs_id.trim().length > 0
    const hasManualName = typeof produs.produs_nume_manual === 'string' && produs.produs_nume_manual.trim().length > 0
    return !hasProdusId && !hasManualName
  })

  if (invalidProduct) return 'Fiecare produs trebuie să fie selectat din bibliotecă sau completat manual.'

  if (
    value.regula_repetare === 'interval' &&
    typeof value.interval_repetare_zile !== 'number' &&
    typeof value.numar_repetari_max !== 'number'
  ) {
    return 'Pentru repetare la interval, completează intervalul sau numărul maxim de repetări.'
  }

  return null
}

function deriveLegacyFirstProduct(value: LinieEditValue): LinieEditValue {
  const first = value.produse[0]

  return {
    ...value,
    produs_id: first?.produs_id ?? null,
    produs_nume_manual: first?.produs_nume_manual ?? null,
    doza_ml_per_hl: first?.doza_ml_per_hl ?? null,
    doza_l_per_ha: first?.doza_l_per_ha ?? null,
  }
}

export function LinieEditDialog({
  allowCohortTrigger = false,
  culturaTip,
  grupBiologic,
  initialValue,
  onOpenChange,
  onSubmit,
  open,
  pending = false,
  produse,
  title,
}: LinieEditDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [value, setValue] = useState<LinieEditValue>(initialValue)
  const [showAllProducts, setShowAllProducts] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    setShowAllProducts(false)
  }, [initialValue, open])

  const stadiuOptions = useMemo(() => getStadiuOptions(grupBiologic), [grupBiologic])
  const produseFiltrate = useMemo(
    () => filterProduseForCulture(produse, culturaTip, showAllProducts, ''),
    [culturaTip, produse, showAllProducts]
  )
  const validationError = getValidationError(value)

  const updateProduct = (produsId: string, update: (produs: PlanWizardLinieProdusDraft) => PlanWizardLinieProdusDraft) => {
    setValue((current) => ({
      ...current,
      produse: withProductOrder(current.produse.map((produs) => (produs.id === produsId ? update(produs) : produs))),
    }))
  }

  const content = (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
            <Label htmlFor="linie-stadiu-select">Fenofază</Label>
          <select
            id="linie-stadiu-select"
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
        </div>

        {allowCohortTrigger ? (
          <div className="space-y-2">
            <Label htmlFor="linie-cohorta-select">Cohortă vizată</Label>
            <select
              id="linie-cohorta-select"
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
            <Label htmlFor="linie-tip-interventie">Tip intervenție</Label>
          <select
            id="linie-tip-interventie"
            value={value.tip_interventie ?? ''}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                tip_interventie: event.target.value ? event.target.value as LinieEditValue['tip_interventie'] : null,
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
                regula_repetare: event.target.value as LinieEditValue['regula_repetare'],
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="linie-interval">Interval repetare zile</Label>
            <Input
              id="linie-interval"
              type="number"
              min="1"
              step="1"
              value={value.interval_repetare_zile ?? ''}
              onChange={(event) => setValue((current) => ({ ...current, interval_repetare_zile: parseOptionalNumber(event.target.value) }))}
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
              onChange={(event) => setValue((current) => ({ ...current, numar_repetari_max: parseOptionalNumber(event.target.value) }))}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
          <Label htmlFor="linie-scop">Scop</Label>
        <Input
          id="linie-scop"
          value={value.scop ?? ''}
          onChange={(event) => setValue((current) => ({ ...current, scop: event.target.value }))}
          placeholder="Ex: prevenție botrytis, corecție calciu"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label>Produse planificate</Label>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Selectează produse din bibliotecă sau completează manual.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setValue((current) => ({
                ...current,
                produse: [...current.produse, createEmptyLineProduct(current.produse.length + 1)],
              }))
            }
          >
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

        <div className="space-y-3">
          {value.produse.map((produsDraft, index) => {
            const selectedProduct = produse.find((produs) => produs.id === produsDraft.produs_id) ?? null

            return (
              <div key={produsDraft.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produs #{index + 1}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{getProdusDraftDisplayName(produsDraft, produse)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută sus produsul ${index + 1}`} disabled={index === 0} onClick={() => setValue((current) => ({ ...current, produse: moveProduct(current.produse, produsDraft.id, 'up') }))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută jos produsul ${index + 1}`} disabled={index === value.produse.length - 1} onClick={() => setValue((current) => ({ ...current, produse: moveProduct(current.produse, produsDraft.id, 'down') }))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Șterge produsul ${index + 1}`} onClick={() => setValue((current) => ({ ...current, produse: withProductOrder(current.produse.filter((produs) => produs.id !== produsDraft.id)) }))}>
                      <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`linie-produs-${produsDraft.id}`}>Produs din bibliotecă</Label>
                    <select
                      id={`linie-produs-${produsDraft.id}`}
                      value={produsDraft.produs_id ?? ''}
                      onChange={(event) => {
                        const product = produse.find((item) => item.id === event.target.value) ?? null
                        updateProduct(produsDraft.id, (current) => updateProductFromCatalog(current, product))
                      }}
                      className="agri-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      <option value="">Adaugă manual</option>
                      {produseFiltrate.map((produs) => (
                        <option key={produs.id} value={produs.id}>{produs.nume_comercial}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`linie-manual-${produsDraft.id}`}>Nume manual</Label>
                    <Input
                      id={`linie-manual-${produsDraft.id}`}
                      value={produsDraft.produs_nume_manual ?? ''}
                      disabled={Boolean(selectedProduct)}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`linie-frac-${produsDraft.id}`}>FRAC/IRAC</Label>
                      <Input
                        id={`linie-frac-${produsDraft.id}`}
                        value={produsDraft.frac_irac_snapshot ?? ''}
                        onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, frac_irac_snapshot: event.target.value }))}
                      />
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
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
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linie-observatii-input">Observații intervenție</Label>
        <Textarea
          id="linie-observatii-input"
          rows={4}
          value={value.observatii ?? ''}
          onChange={(event) => setValue((current) => ({ ...current, observatii: event.target.value }))}
          placeholder="Note despre aplicare, produse sau ordinea tratamentului."
        />
      </div>

      {validationError ? <p className="text-sm text-[var(--soft-danger-text)]">{validationError}</p> : null}
    </div>
  )

  const footer = (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={async () => {
        await onSubmit(deriveLegacyFirstProduct(value))
      }}
      saving={pending}
      disabled={pending || Boolean(validationError)}
      saveLabel="Salvează intervenția"
    />
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={title}
          description="Alege fenofaza, tipul intervenției și produsele planificate."
        footer={footer}
      >
        {content}
      </AppDrawer>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Alege fenofaza, tipul intervenției și produsele planificate."
      footer={footer}
    >
      {content}
    </AppDialog>
  )
}
