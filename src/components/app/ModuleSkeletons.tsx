'use client'

import { cn } from '@/lib/utils'

function PulseBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200', className)} />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[var(--agri-border)] bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <PulseBlock className="h-4 w-32" />
          <PulseBlock className="h-2.5 w-full rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--agri-border)] p-3"
              >
                <PulseBlock className="h-6 w-6 rounded-full" />
                <div className="space-y-2">
                  <PulseBlock className="h-3 w-32" />
                  <PulseBlock className="h-3 w-48" />
                </div>
                <PulseBlock className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-[110px] flex-col justify-between rounded-3xl border border-[var(--agri-border)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <PulseBlock className="h-4 w-16" />
              <PulseBlock className="h-5 w-10 rounded-full" />
            </div>
            <PulseBlock className="h-7 w-24" />
            <PulseBlock className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] lg:gap-4">
        <section className="rounded-3xl border border-[var(--agri-border)] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <PulseBlock className="h-4 w-40" />
            <PulseBlock className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-[var(--agri-border)] p-4">
                <PulseBlock className="h-3 w-20" />
                <PulseBlock className="mt-3 h-7 w-16" />
                <PulseBlock className="mt-2 h-3 w-12" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--agri-border)] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <PulseBlock className="h-4 w-28" />
            <PulseBlock className="h-3 w-12" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-[var(--agri-border)] p-4">
                <PulseBlock className="h-3 w-32" />
                <PulseBlock className="mt-3 h-6 w-40" />
                <PulseBlock className="mt-2 h-3 w-28" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function OrderCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:gap-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[var(--agri-border)] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <PulseBlock className="h-4 w-36" />
              <PulseBlock className="h-3 w-24" />
            </div>
            <PulseBlock className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <PulseBlock className="h-10 w-full" />
            <PulseBlock className="h-10 w-full" />
            <PulseBlock className="h-10 w-full" />
          </div>
          <PulseBlock className="mt-4 h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function TableCardsSkeleton({
  cardCount = 4,
  withDesktopTable = true,
}: {
  cardCount?: number
  withDesktopTable?: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 lg:hidden">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[var(--agri-border)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <PulseBlock className="h-4 w-28" />
                <PulseBlock className="h-3 w-20" />
              </div>
              <PulseBlock className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <PulseBlock className="h-3 w-full" />
              <PulseBlock className="h-3 w-5/6" />
              <PulseBlock className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      {withDesktopTable ? (
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)] lg:gap-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--agri-border)] bg-slate-50 px-4 py-3">
              <PulseBlock className="h-4 w-48" />
            </div>
            <div className="divide-y divide-[var(--agri-border)]">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 px-4 py-3">
                  <PulseBlock className="h-4 w-20" />
                  <PulseBlock className="h-4 w-28" />
                  <PulseBlock className="h-4 w-16" />
                  <PulseBlock className="h-4 w-20" />
                  <PulseBlock className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--agri-border)] bg-white p-4 shadow-sm">
            <PulseBlock className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <PulseBlock key={index} className="h-4 w-full" />
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <PulseBlock className="h-9 w-28" />
                <PulseBlock className="h-9 w-20" />
                <PulseBlock className="h-9 w-20" />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

export function DashboardCardsRowSkeleton({
  count = 6,
  columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}: {
  count?: number
  columns?: string
}) {
  return (
    <div className={cn('grid gap-3', columns)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[110px] flex-col justify-between rounded-3xl border border-[var(--agri-border)] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <PulseBlock className="h-4 w-16" />
            <PulseBlock className="h-5 w-10" />
          </div>
          <PulseBlock className="h-7 w-24" />
          <PulseBlock className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
