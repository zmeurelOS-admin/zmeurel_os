'use client'

import { useState } from 'react'
import { Map } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { LoadingState } from '@/components/app/LoadingState'
import { NumericField } from '@/components/app/NumericField'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { Button } from '@/components/ui/button'

export default function UiTemplateDemoPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <AppShell
      header={
        <PageHeader
          title="UI Template Demo"
          subtitle="App shell universal pentru module"
          rightSlot={<Map className="h-5 w-5" />}
        />
      }
      bottomBar={
        <StickyActionBar>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="agri-cta w-full border-[var(--agri-border)]"
              onClick={() => setDialogOpen(true)}
            >
              Deschide Edit Dialog
            </Button>
            <Button
              type="button"
              className="agri-cta w-full bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
            >
              Actiune Primara
            </Button>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-4 py-4 sm:mt-0">
        <LoadingState label="Se pregateste lista..." />

        <div className="agri-card space-y-4 p-4">
          <p className="text-sm font-semibold">Form preview</p>
          <NumericField id="cantitate" label="Cantitate" placeholder="0" />
          <NumericField id="an" label="An" placeholder="2026" />
          <Button
            type="button"
            className="agri-cta w-full bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
          >
            Salvează
          </Button>
        </div>

        <EmptyState
          title="Nu exist? înregistrări"
          description="Adaugă prima înregistrare folosind butonul flotant."
        />
      </div>

      <AppDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Adaugă înregistrare"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDrawerOpen(false)}>
              Anulează
            </Button>
            <Button type="button" className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700" onClick={() => setDrawerOpen(false)}>
              Salvează
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <NumericField id="drawer-cantitate" label="Cantitate" placeholder="0" />
          <NumericField id="drawer-an" label="An" placeholder="2026" />
        </div>
      </AppDrawer>

      <AppDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Editează înregistrare"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDialogOpen(false)}>
              Anulează
            </Button>
            <Button type="button" className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700" onClick={() => setDialogOpen(false)}>
              Actualizeaza
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <NumericField id="dialog-cantitate" label="Cantitate" placeholder="120" />
          <NumericField id="dialog-an" label="An" placeholder="2026" />
        </div>
      </AppDialog>
    </AppShell>
  )
}

