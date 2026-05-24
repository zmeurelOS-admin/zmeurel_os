'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Droplets, Eye } from 'lucide-react'

import { JurnalItem } from '@/components/tratamente/JurnalItem'
import { ParcelaTratamenteCapcaneCompact } from '@/components/tratamente/ParcelaTratamenteCapcaneCompact'
import { ParcelaTratamentePlansCollapsed } from '@/components/tratamente/ParcelaTratamentePlansCollapsed'
import type { ParcelaTratamenteMobileHubProps } from '@/components/tratamente/parcela-tratamente-mobile-types'
import { Button } from '@/components/ui/button'
import { mapAplicariParcelaToJurnal } from '@/lib/tratamente/parcela-jurnal'
import { cn } from '@/lib/utils'

export type { ParcelaTratamenteMobileHubProps } from '@/components/tratamente/parcela-tratamente-mobile-types'

export function ParcelaTratamenteMobileHub({
  an,
  aplicariEfectuate,
  capcaneActive,
  capcaneError,
  capcaneLoading,
  onApplyTreatment,
  onMountCapcana,
  onReloadCapcane,
  onVerifyCapcana,
  parcelaId,
  parcelaNume,
  ...plansProps
}: ParcelaTratamenteMobileHubProps) {
  const router = useRouter()

  const jurnalItems = useMemo(
    () => mapAplicariParcelaToJurnal(aplicariEfectuate, parcelaNume, 50),
    [aplicariEfectuate, parcelaNume]
  )

  return (
    <div className="mx-auto w-full max-w-[min(96vw,94rem)] space-y-4 px-3 py-3 pb-6">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Button
          type="button"
          className="min-h-[3.25rem] w-full rounded-2xl bg-[var(--agri-primary)] px-4 py-3 text-base font-semibold text-white shadow-[0_4px_20px_rgba(13,155,92,0.2)] transition active:scale-[0.985]"
          onClick={onApplyTreatment}
        >
          <Droplets className="mr-2 h-5 w-5 shrink-0" aria-hidden />
          Am aplicat un tratament
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'min-h-[3.25rem] w-full rounded-2xl border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-base font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition active:scale-[0.985]'
          )}
          onClick={onVerifyCapcana}
        >
          <Eye className="mr-2 h-5 w-5 shrink-0 text-[var(--agri-primary)]" aria-hidden />
          Verificare capcană
        </Button>
      </div>

      <section className="space-y-2" aria-labelledby="jurnal-tratamente-label">
        <div className="flex items-center justify-between gap-2">
          <p
            id="jurnal-tratamente-label"
            className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]"
          >
            Jurnal aplicări
          </p>
          {jurnalItems.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <Link href={`/parcele/${parcelaId}/tratamente/toate`}>Vezi toate</Link>
            </Button>
          ) : null}
        </div>

        {jurnalItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-5 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Încă nu ai înregistrat tratamente. Apasă «Am aplicat un tratament».
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {jurnalItems.map((item) => (
              <JurnalItem
                key={item.aplicareId}
                item={item}
                onClick={() => router.push(`/parcele/${parcelaId}/tratamente/aplicare/${item.aplicareId}`)}
              />
            ))}
          </div>
        )}
      </section>

      <ParcelaTratamenteCapcaneCompact
        capcane={capcaneActive}
        error={capcaneError}
        loading={capcaneLoading}
        onMountCapcana={onMountCapcana}
        onRetry={onReloadCapcane}
        onVerifyCapcana={onVerifyCapcana}
      />

      <ParcelaTratamentePlansCollapsed an={an} parcelaId={parcelaId} {...plansProps} />
    </div>
  )
}
