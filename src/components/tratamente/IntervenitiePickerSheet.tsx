'use client'

import type { ComponentType, ReactNode } from 'react'
import {
  Bug,
  Droplets,
  Eye,
  Leaf,
  MoreHorizontal,
  Pill,
  Wheat,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { MetodaAplicare } from '@/types/tratamente-metode'

export type IntervenitiePickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (metoda: MetodaAplicare) => void
}

type PickerOption = {
  metoda: MetodaAplicare
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  accent?: boolean
  wide?: boolean
}

const PRODUCT_OPTIONS: PickerOption[] = [
  {
    metoda: 'foliar',
    title: 'Foliar',
    subtitle: 'Stropit pe frunze',
    icon: Leaf,
    accent: true,
  },
  {
    metoda: 'fertirigare',
    title: 'Fertirigare',
    subtitle: 'Prin instalație',
    icon: Droplets,
  },
  {
    metoda: 'fertilizare_baza',
    title: 'Fertilizare bază',
    subtitle: 'Granulat la sol',
    icon: Wheat,
  },
  {
    metoda: 'granulat_sol',
    title: 'Granulat sol',
    subtitle: 'Insecticid la rădăcină',
    icon: Pill,
  },
]

const TRAP_OPTIONS: PickerOption[] = [
  {
    metoda: 'capcana_pus',
    title: 'Pus capcane',
    subtitle: 'Drosophila, lipicioase',
    icon: Bug,
  },
  {
    metoda: 'capcana_verificat',
    title: 'Verificat capcane',
    subtitle: 'Numărat, înlocuit',
    icon: Eye,
  },
]

const OTHER_OPTIONS: PickerOption[] = [
  {
    metoda: 'altul',
    title: 'Altă intervenție',
    subtitle: 'Erbicidare, drench, biocontrol…',
    icon: MoreHorizontal,
    wide: true,
  },
]

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
      {children}
    </p>
  )
}

function PickerTile({
  option,
  onPick,
}: {
  option: PickerOption
  onPick: (metoda: MetodaAplicare) => void
}) {
  const Icon = option.icon

  return (
    <button
      type="button"
      aria-label={option.title}
      onClick={() => onPick(option.metoda)}
      className={cn(
        'flex min-h-20 w-full items-start gap-3 rounded-[var(--agri-radius)] border p-4 text-left transition active:scale-[0.985]',
        option.wide ? 'col-span-2' : '',
        option.accent
          ? 'border-[color:color-mix(in_srgb,var(--agri-primary)_36%,white)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] shadow-[0_10px_24px_rgba(13,155,92,0.10)]'
          : 'border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          option.accent
            ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_16%,white)] text-[var(--agri-primary)]'
            : 'bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-[var(--text-primary)] [font-weight:700]">{option.title}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{option.subtitle}</p>
      </div>
    </button>
  )
}

export function IntervenitiePickerSheet({
  open,
  onOpenChange,
  onPick,
}: IntervenitiePickerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-x-0 border-b-0 px-4 pb-6 pt-3 sm:max-w-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--border-default)]" aria-hidden />

        <SheetHeader className="space-y-1 pb-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Adaugă intervenție
          </p>
          <SheetTitle className="text-left text-xl text-[var(--text-primary)] [font-weight:750]">
            Ce ai făcut?
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <section className="space-y-3">
            <GroupLabel>Aplicare produs</GroupLabel>
            <div className="grid grid-cols-2 gap-3">
              {PRODUCT_OPTIONS.map((option) => (
                <PickerTile key={option.metoda} option={option} onPick={onPick} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <GroupLabel>Monitorizare & capcane</GroupLabel>
            <div className="grid grid-cols-2 gap-3">
              {TRAP_OPTIONS.map((option) => (
                <PickerTile key={option.metoda} option={option} onPick={onPick} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <GroupLabel>Altele</GroupLabel>
            <div className="grid grid-cols-2 gap-3">
              {OTHER_OPTIONS.map((option) => (
                <PickerTile key={option.metoda} option={option} onPick={onPick} />
              ))}
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-[var(--agri-radius)] border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] transition active:scale-[0.985]"
        >
          Anulează
        </button>
      </SheetContent>
    </Sheet>
  )
}
