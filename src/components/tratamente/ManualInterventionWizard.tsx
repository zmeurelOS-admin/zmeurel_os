'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Search, Sparkles } from 'lucide-react'

import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'
import type { MetodaAplicare } from '@/types/tratamente-metode'

type WizardStep = 1 | 2 | 3
type ProductFilter = 'toate' | 'ingrasamant' | 'foliar' | 'fungicid' | 'insecticid'
type QuantityUnit = 'g' | 'kg' | 'ml' | 'l'

type SelectedProduct = {
  catalogProduct: ProdusFitosanitar | null
  manualName: string
}

interface ManualInterventionWizardProps {
  dateValue: string
  manualParcele: Array<{ value: string; label: string }>
  observations: string
  onDateChange: (value: string) => void
  onMethodChange: (method: MetodaAplicare, tipSelect: string) => void
  onObservationsChange: (value: string) => void
  onParcelChange: (value: string) => void
  onProductChange: (product: ProdusFitosanitar | null) => void
  onManualProductNameChange: (value: string) => void
  onQuantityChange: (value: string, unit: QuantityUnit) => void
  onScopeChange: (value: string) => void
  onSubmit: () => void
  open: boolean
  pending: boolean
  produse: ProdusFitosanitar[]
  quantityUnit: QuantityUnit
  quantityValue: string
  scopeValue: string
  selectedMethod: MetodaAplicare | null
  selectedParcelaId: string
  selectedProduct: SelectedProduct | null
}

const METHOD_OPTIONS: Array<{
  label: string
  emoji: string
  method: MetodaAplicare
  tipSelect: string
}> = [
  { label: 'Fertirigare', emoji: '💧', method: 'fertirigare', tipSelect: 'fertirigare' },
  { label: 'Foliar', emoji: '🌿', method: 'foliar', tipSelect: 'foliar' },
  { label: 'Sol', emoji: '🪱', method: 'granulat_sol', tipSelect: 'aplicare_sol' },
]

const FILTER_OPTIONS: Array<{ label: string; value: ProductFilter }> = [
  { label: 'Toate', value: 'toate' },
  { label: 'Îngrășământ', value: 'ingrasamant' },
  { label: 'Foliar', value: 'foliar' },
  { label: 'Fungicid', value: 'fungicid' },
  { label: 'Insecticid', value: 'insecticid' },
]

const SCOPE_OPTIONS = [
  { label: 'Fertilizare', value: 'fertilizare_baza' },
  { label: 'Înflorire', value: 'stimulare_inflorire' },
  { label: 'Fructificare', value: 'stimulare_fructificare' },
  { label: 'Protecție fungică', value: 'protectie_fungica' },
  { label: 'Protecție insecticidă', value: 'protectie_insecticida' },
] as const

const QUANTITY_UNITS: QuantityUnit[] = ['g', 'kg', 'ml', 'l']

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function productMatchesFilter(product: ProdusFitosanitar, filter: ProductFilter): boolean {
  if (filter === 'toate') return true
  return normalizeSearch(product.tip ?? '') === filter
}

function productAccentClass(product: ProdusFitosanitar): string {
  switch (normalizeSearch(product.tip ?? '')) {
    case 'fungicid':
      return 'bg-[var(--status-info-text)]'
    case 'insecticid':
      return 'bg-[var(--status-warning-text)]'
    case 'ingrasamant':
    case 'foliar':
      return 'bg-[var(--agri-primary)]'
    default:
      return 'bg-[var(--text-secondary)]'
  }
}

function productDescription(product: ProdusFitosanitar): string {
  return [
    product.substanta_activa?.trim() || null,
    product.frac_irac?.trim() ? `FRAC/IRAC ${product.frac_irac.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function ProgressIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={`Pasul ${step} din 3`}>
      {(['Context', 'Produs', 'Detalii'] as const).map((label, index) => {
        const itemStep = (index + 1) as WizardStep
        const active = itemStep <= step
        return (
          <div key={label} className="space-y-1.5">
            <div
              className={cn(
                'h-1.5 rounded-full transition-colors',
                active ? 'bg-[var(--agri-primary)]' : 'bg-[var(--surface-card-muted)]'
              )}
            />
            <p
              className={cn(
                'text-center text-[11px] [font-weight:650]',
                itemStep === step ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              )}
            >
              {label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function ManualInterventionWizard({
  dateValue,
  manualParcele,
  observations,
  onDateChange,
  onMethodChange,
  onObservationsChange,
  onParcelChange,
  onProductChange,
  onManualProductNameChange,
  onQuantityChange,
  onScopeChange,
  onSubmit,
  open,
  pending,
  produse,
  quantityUnit,
  quantityValue,
  scopeValue,
  selectedMethod,
  selectedParcelaId,
  selectedProduct,
}: ManualInterventionWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('toate')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step !== 2) return
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [step])

  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search)
    return produse.filter((product) => {
      if (!productMatchesFilter(product, filter)) return false
      if (!query) return true
      return normalizeSearch(
        [
          product.nume_comercial,
          product.substanta_activa,
          product.tip,
          product.frac_irac,
        ]
          .filter(Boolean)
          .join(' ')
      ).includes(query)
    })
  }, [filter, produse, search])

  const canContinue = Boolean(selectedMethod && selectedParcelaId && dateValue.trim())
  const canSave = Boolean(
    selectedProduct &&
      (selectedProduct.catalogProduct || selectedProduct.manualName.trim()) &&
      quantityValue.trim()
  )

  if (!open) return null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <ProgressIndicator step={step} />

      {step === 1 ? (
        <div className="space-y-5">
          <div className="space-y-2.5">
            <div>
              <h3 className="text-lg text-[var(--text-primary)] [font-weight:750]">Contextul intervenției</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Alege metoda, momentul și parcela.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {METHOD_OPTIONS.map((option) => {
                const selected = selectedMethod === option.method
                return (
                  <button
                    key={option.method}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      'flex min-h-24 flex-col items-center justify-center gap-2 rounded-[20px] border px-2 py-3 text-center transition active:scale-[0.985]',
                      selected
                        ? 'border-[var(--agri-primary)] bg-[var(--agri-primary-light)] text-[var(--agri-primary-dark)] shadow-[var(--shadow-soft)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]'
                    )}
                    onClick={() => onMethodChange(option.method, option.tipSelect)}
                  >
                    <span className="text-2xl" aria-hidden>{option.emoji}</span>
                    <span className="text-sm [font-weight:700]">{option.label}</span>
                    {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <AppDatePicker
            id="manual-wizard-date"
            label="Data aplicării"
            mode="datetime"
            placeholder="Selectează data și ora"
            value={dateValue}
            triggerClassName="h-12 rounded-xl"
            onChange={onDateChange}
          />

          <div className="space-y-2.5">
            <Label>Parcelă</Label>
            <div className="flex flex-wrap gap-2">
              {manualParcele.map((parcela) => (
                <button
                  key={parcela.value}
                  type="button"
                  aria-pressed={selectedParcelaId === parcela.value}
                  className={cn(
                    'min-h-11 rounded-xl border px-4 py-2 text-sm transition active:scale-[0.985] [font-weight:650]',
                    selectedParcelaId === parcela.value
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)] text-white'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]'
                  )}
                  onClick={() => onParcelChange(parcela.value)}
                >
                  {parcela.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            className="min-h-12 w-full rounded-xl"
            disabled={!canContinue}
            onClick={() => setStep(2)}
          >
            Continuă
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="sticky top-0 z-10 space-y-3 bg-[var(--surface-card)] pb-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => setStep(1)} aria-label="Înapoi la context">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h3 className="text-lg text-[var(--text-primary)] [font-weight:750]">Alege produsul</h3>
                <p className="text-sm text-[var(--text-secondary)]">Caută în biblioteca fermei.</p>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 rounded-xl pl-10 text-[16px]"
                placeholder="Nume, substanță, tip sau FRAC/IRAC"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  className={cn(
                    'min-h-9 shrink-0 rounded-full border px-3 text-xs transition [font-weight:650]',
                    filter === option.value
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)] text-white'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                  )}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredProducts.map((product) => {
              const description = productDescription(product)
              return (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full overflow-hidden rounded-2xl bg-[var(--surface-card)] text-left shadow-[var(--shadow-soft)] transition active:scale-[0.985]"
                  onClick={() => {
                    onProductChange(product)
                    setStep(3)
                  }}
                >
                  <span className={cn('w-1.5 shrink-0', productAccentClass(product))} />
                  <span className="min-w-0 flex-1 px-4 py-3.5">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-sm text-[var(--text-primary)] [font-weight:700]">
                        {product.nume_comercial}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--surface-card-muted)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] [font-weight:700]">
                        {product.tip}
                      </span>
                    </span>
                    {description ? (
                      <span className="mt-1 block text-xs text-[var(--text-secondary)]">{description}</span>
                    ) : null}
                  </span>
                </button>
              )
            })}

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl bg-[var(--surface-card-muted)] px-4 py-5 text-center text-sm text-[var(--text-secondary)]">
                Nu am găsit produse pentru filtrul ales.
              </div>
            ) : null}

            <button
              type="button"
              className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--agri-primary)] bg-[var(--agri-primary-light)] px-4 py-3 text-left text-[var(--agri-primary-dark)] transition active:scale-[0.985]"
              onClick={() => {
                onProductChange(null)
                setStep(3)
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-card)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm [font-weight:700]">Adaugă produs manual</span>
                <span className="mt-0.5 block text-xs opacity-80">Pentru un produs care nu este încă în bibliotecă.</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && selectedProduct ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg text-[var(--text-primary)] [font-weight:750]">Detaliile aplicării</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Completează cantitatea și detaliile opționale.</p>
            </div>
            <button
              type="button"
              className="text-sm text-[var(--agri-primary)] [font-weight:700]"
              onClick={() => setStep(2)}
            >
              Schimbă produsul
            </button>
          </div>

          <div className="rounded-[20px] bg-[var(--agri-primary-light)] p-4 shadow-[var(--shadow-soft)]">
            {selectedProduct.catalogProduct ? (
              <>
                <p className="text-sm text-[var(--agri-primary-dark)] [font-weight:750]">
                  {selectedProduct.catalogProduct.nume_comercial}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {productDescription(selectedProduct.catalogProduct) || selectedProduct.catalogProduct.tip}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="manual-wizard-product-name">Nume produs</Label>
                <Input
                  id="manual-wizard-product-name"
                  value={selectedProduct.manualName}
                  onChange={(event) => onManualProductNameChange(event.target.value)}
                  className="h-12 bg-[var(--surface-card)] text-[16px]"
                  placeholder="Ex: fertilizant foliar nou"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-wizard-quantity">Cantitate aplicată</Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                id="manual-wizard-quantity"
                value={quantityValue}
                onChange={(event) => onQuantityChange(event.target.value, quantityUnit)}
                inputMode="decimal"
                className="h-12 text-[16px]"
                placeholder="Ex: 250"
              />
              <div className="flex rounded-xl bg-[var(--surface-card-muted)] p-1">
                {QUANTITY_UNITS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={quantityUnit === unit}
                    className={cn(
                      'min-h-10 min-w-10 rounded-lg px-2 text-xs uppercase [font-weight:700]',
                      quantityUnit === unit
                        ? 'bg-[var(--surface-card)] text-[var(--agri-primary)] shadow-[var(--shadow-soft)]'
                        : 'text-[var(--text-secondary)]'
                    )}
                    onClick={() => onQuantityChange(quantityValue, unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label>Scop <span className="text-[var(--text-secondary)] [font-weight:450]">· opțional</span></Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={scopeValue === option.value}
                  className={cn(
                    'min-h-10 rounded-full border px-3 py-2 text-xs transition [font-weight:650]',
                    scopeValue === option.value
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-primary-light)] text-[var(--agri-primary-dark)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                  )}
                  onClick={() => onScopeChange(scopeValue === option.value ? '' : option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-wizard-observations">
              Observații <span className="text-[var(--text-secondary)] [font-weight:450]">· opțional</span>
            </Label>
            <Textarea
              id="manual-wizard-observations"
              value={observations}
              onChange={(event) => onObservationsChange(event.target.value)}
              rows={3}
              placeholder="Detalii utile pentru jurnal"
            />
          </div>

          <Button
            type="button"
            className="min-h-12 w-full rounded-xl bg-[var(--agri-primary)] text-white"
            disabled={!canSave || pending}
            onClick={onSubmit}
          >
            {pending ? 'Se salvează...' : 'Salvează intervenția'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export type { QuantityUnit }
