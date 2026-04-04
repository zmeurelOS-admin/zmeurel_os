'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { dispatchDemoBannerDismissed, useDemoBannerVisible } from '@/hooks/useDemoBannerVisible'

export function DemoBanner() {
  const isVisible = useDemoBannerVisible()

  if (!isVisible) return null

  return (
    <div className="z-50 w-full bg-emerald-600 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">
          🌱 Ești în modul demo. Datele vor fi șterse. Când ești gata, creează-ți ferma ta.
        </p>
        <div className="flex items-center gap-2">
          <form action="/api/auth/leave-demo" method="POST">
            <Button
              type="submit"
              data-testid="demo-banner-create-farm"
              size="sm"
              className="h-8 rounded-full bg-[var(--agri-surface)] px-4 text-sm font-semibold text-emerald-700 hover:bg-[var(--soft-success-bg)]"
            >
              Creează-ți ferma →
            </Button>
          </form>
          <button
            type="button"
            aria-label="Închide"
            className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            onClick={dispatchDemoBannerDismissed}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
