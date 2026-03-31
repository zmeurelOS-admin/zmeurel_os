'use client'

import Image from 'next/image'
import { useState } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { FarmSwitcher } from '@/components/app/FarmSwitcher'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function TopBar() {
  const [farmDialogOpen, setFarmDialogOpen] = useState(false)
  const { isSuperAdmin: isSuperAdminUser } = useDashboardAuth()

  return (
    <>
      <div
        className="relative z-40 flex h-[calc(44px+var(--safe-t))] shrink-0 items-end border-b border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 pb-2 backdrop-blur sm:px-4"
        style={{ paddingTop: 'var(--safe-t)' }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--agri-text)]">
            <Image src="/icons/icon.svg" alt="Zmeurel" width={24} height={24} className="shrink-0" />
            Zmeurel
          </div>

          {isSuperAdminUser ? <FarmSwitcher variant="chip" onActivate={() => setFarmDialogOpen(true)} /> : null}
        </div>
      </div>

      <Dialog open={isSuperAdminUser && farmDialogOpen} onOpenChange={setFarmDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schimbă fermă</DialogTitle>
          </DialogHeader>
          <FarmSwitcher variant="panel" />
        </DialogContent>
      </Dialog>
    </>
  )
}
