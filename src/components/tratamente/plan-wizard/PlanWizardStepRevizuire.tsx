'use client'

import { CheckCircle2, TriangleAlert } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Label } from '@/components/ui/label'
import type { PlanWizardParcelaOption, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

import {
  formatDoza,
  getProdusDisplayName,
  getStadiuMeta,
  sortLiniiForReview,
} from '@/components/tratamente/plan-wizard/helpers'
import type {
  PlanWizardInfoData,
  PlanWizardLinieDraft,
  PlanWizardRevizuireData,
  PlanWizardWarning,
} from '@/components/tratamente/plan-wizard/types'

interface PlanWizardStepRevizuireProps {
  info: PlanWizardInfoData
  linii: PlanWizardLinieDraft[]
  parcele: PlanWizardParcelaOption[]
  produse: ProdusFitosanitar[]
  value: PlanWizardRevizuireData
  warnings: PlanWizardWarning[]
  onChange: (nextValue: PlanWizardRevizuireData) => void
}

function formatSuprafata(m2: number | null) {
  if (typeof m2 !== 'number' || !Number.isFinite(m2) || m2 <= 0) return 'Suprafață necunoscută'
  const hectare = m2 / 10_000
  return `${hectare.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ha`
}

export function PlanWizardStepRevizuire({
  info,
  linii,
  parcele,
  produse,
  value,
  warnings,
  onChange,
}: PlanWizardStepRevizuireProps) {
  const sortedLinii = sortLiniiForReview(linii)

  return (
    <div className="space-y-4">
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
          Sumar plan
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-[var(--surface-card-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Denumire</p>
            <p className="mt-1 text-sm text-[var(--text-primary)] [font-weight:650]">{info.nume}</p>
          </div>
          <div className="rounded-[18px] bg-[var(--surface-card-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Cultură</p>
            <p className="mt-1 text-sm text-[var(--text-primary)] [font-weight:650]">{info.cultura_tip}</p>
          </div>
          <div className="rounded-[18px] bg-[var(--surface-card-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Linii</p>
            <p className="mt-1 text-sm text-[var(--text-primary)] [font-weight:650]">{linii.length} aplicări planificate</p>
          </div>
          <div className="rounded-[18px] bg-[var(--surface-card-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Descriere</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {info.descriere?.trim() ? info.descriere : 'Fără descriere suplimentară.'}
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
          Linii în ordine cronologică
        </h2>
        <div className="mt-4 space-y-3">
          {sortedLinii.map((linie, index) => {
            const stadiu = getStadiuMeta(linie.stadiu_trigger)

            return (
              <div key={linie.id} className="rounded-[18px] border border-[var(--border-default)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--surface-card-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    #{index + 1}
                  </span>
                  <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    {stadiu.emoji} {stadiu.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[var(--text-primary)] [font-weight:650]">
                  {getProdusDisplayName(linie, produse)}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {formatDoza(linie.doza, linie.dozaUnitate)}
                </p>
                {linie.observatii?.trim() ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{linie.observatii}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </AppCard>

      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
          Avertismente
        </h2>

        {warnings.length === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-[color:color-mix(in_srgb,var(--agri-primary)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,white)] p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--agri-primary)]" />
            <div>
              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Plan fără conflicte detectate</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Nu am găsit repetiții FRAC consecutive sau depășiri de cupru în setul curent de linii.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {warnings.map((warning) => (
              <div
                key={warning.id}
                className="flex items-start gap-3 rounded-[20px] border border-[color:color-mix(in_srgb,var(--soft-warning-text)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--soft-warning-text)_8%,white)] p-4"
              >
                <TriangleAlert className="mt-0.5 h-5 w-5 text-[var(--soft-warning-text)]" />
                <div>
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{warning.titlu}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{warning.descriere}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppCard>

      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Asociere parcele
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Poți salva planul fără asociere și îl conectezi mai târziu dacă preferi.
            </p>
          </div>

          <div className="w-full max-w-[10rem] space-y-2">
            <Label htmlFor="plan-an">An</Label>
            <input
              id="plan-an"
              type="number"
              min={2020}
              max={2100}
              className="agri-control h-11 w-full rounded-xl px-3 text-sm"
              value={value.an}
              onChange={(event) =>
                onChange({
                  ...value,
                  an: Number(event.target.value) || new Date().getFullYear(),
                })
              }
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {parcele.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nu există parcele compatibile cu cultura selectată.
            </p>
          ) : (
            parcele.map((parcela) => {
              const selected = value.parcele_ids.includes(parcela.id)
              const activePlanForYear = parcela.active_planuri.find((plan) => plan.an === value.an)

              return (
                <label
                  key={parcela.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[20px] border p-4 transition ${
                    selected
                      ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,white)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        parcele_ids: event.target.checked
                          ? [...value.parcele_ids, parcela.id]
                          : value.parcele_ids.filter((item) => item !== parcela.id),
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                        {parcela.nume_parcela ?? 'Parcelă fără nume'}
                      </p>
                      <span className="rounded-full bg-[var(--surface-card-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                        {formatSuprafata(parcela.suprafata_m2)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {parcela.id_parcela ? `Cod ${parcela.id_parcela}` : 'Fără cod'} · {parcela.cultura_tip ?? parcela.tip_fruct ?? 'Cultură nespecificată'}
                    </p>
                    {activePlanForYear ? (
                      <div className="mt-2 space-y-2">
                        <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--soft-warning-text)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--soft-warning-text)_8%,white)] px-2 py-1 text-xs text-[var(--soft-warning-text)]">
                          Plan existent activ pentru anul {value.an}
                        </span>
                        {selected ? (
                          <p className="text-xs text-[var(--soft-warning-text)]">
                            Planul curent activ va fi dezactivat și înlocuit.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </label>
              )
            })
          )}
        </div>
      </AppCard>
    </div>
  )
}
