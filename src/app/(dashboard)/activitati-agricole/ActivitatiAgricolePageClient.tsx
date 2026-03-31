'use client'

// NEFOLOSIT în runtime: ruta `activitati-agricole` folosește `page.tsx`.

import { useState } from 'react'
import { ClipboardList, Droplets, Scissors, Bug, Sprout } from 'lucide-react'
import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { AppCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

export default function ActivitatiPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const categorii = [
    { name: 'Tratamente', icon: Bug, color: 'var(--status-danger-text)' },
    { name: 'Irigare', icon: Droplets, color: 'var(--status-info-text)' },
    { name: 'Tăieri', icon: Scissors, color: 'var(--status-warning-text)' },
    { name: 'Fertilizare', icon: Sprout, color: 'var(--status-success-text)' },
  ]

  return (
    <AppShell
      header={<PageHeader title="Activități" subtitle="Operațiuni agricole" rightSlot={<ClipboardList className="h-5 w-5 text-[var(--agri-text-muted)]" />} />}
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-4">
        <SearchField
          placeholder="Caută o intervenție..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Caută activități"
        />

        <div className="grid grid-cols-2 gap-3">
          {categorii.map((cat) => (
            <AppCard
              key={cat.name}
              elevateOnHover
              className={cn('cursor-pointer p-4', 'active:scale-[0.99] transition-transform duration-120')}
              onClick={() => setAddOpen(true)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
                    {cat.name}
                  </div>
                  <div className="mt-1 text-lg font-bold text-[var(--agri-text)]">Adaugă</div>
                  <div className="mt-1 text-xs font-medium text-[var(--agri-text-muted)]">Rapid</div>
                </div>
                <cat.icon className="h-5 w-5 shrink-0" style={{ color: cat.color }} />
              </div>
            </AppCard>
          ))}
        </div>

        <AppCard className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Istoric</div>
          <div className="mt-1 text-sm font-semibold text-[var(--agri-text)]">Ultimele lucrări</div>
          <div className="mt-1 text-xs font-medium text-[var(--agri-text-muted)]">(în lucru)</div>
        </AppCard>
      </div>

      <AddActivitateAgricolaDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />
    </AppShell>
  )
}

