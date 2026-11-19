'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import { LayoutGrid } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Segments, kitFocus, kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

import type { KitTocEntry } from './kit-demo-data'

const subscribeNoop = () => () => undefined

/** Tema aplicației e cunoscută abia în browser; până atunci comutatorul stă pe „Zi”. */
function useAppTheme() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
  return { theme: mounted && resolvedTheme === 'dark' ? ('dark' as const) : ('light' as const), setTheme }
}

export function KitShowcase({ toc, children }: { toc: KitTocEntry[]; children: ReactNode }) {
  const { theme, setTheme } = useAppTheme()

  return (
    <AppShell
      header={
        <PageHeader
          title="Kit de componente"
          subtitle="Faza 1b · doar superadmin"
          rightSlot={<LayoutGrid className="h-5 w-5" aria-hidden />}
        />
      }
    >
      <div className="mx-auto w-full max-w-[820px] space-y-10 pt-4">
        <div className="space-y-4">
          <p className={cn('text-fg-muted', kitText.secondary)}>
            Fiecare componentă apare în două cadre de 390 px: zi și noapte. Datele sunt de exemplu; pagina nu citește
            și nu scrie nimic în baza de date.
          </p>
          <div className="max-w-[390px] space-y-2">
            <p className={cn('font-semibold text-fg', kitText.secondary)}>Tema aplicației</p>
            <Segments
              aria-label="Tema aplicației"
              value={theme}
              onValueChange={setTheme}
              options={[
                { value: 'light', label: 'Zi' },
                { value: 'dark', label: 'Noapte' },
              ]}
            />
            <p className={cn('text-fg-muted', kitText.helper)}>
              Foile și ferestrele se deschid peste pagină și urmează tema aplicației, nu cadrul din care le deschizi.
            </p>
          </div>
          <nav aria-label="Componente" className="flex flex-wrap gap-2">
            {toc.map((entry) => (
              <a
                key={entry.id}
                href={`#${entry.id}`}
                className={cn(
                  'inline-flex h-touch items-center rounded-full border-2 border-border bg-surface px-4 font-bold text-fg',
                  kitText.secondary,
                  kitFocus,
                )}
              >
                {entry.title}
              </a>
            ))}
          </nav>
        </div>

        {children}
      </div>
    </AppShell>
  )
}

function KitFrame({ mode, children }: { mode: 'zi' | 'noapte'; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={cn('mb-1.5 font-bold uppercase tracking-wide text-fg-muted', kitText.helper)}>
        {mode === 'zi' ? 'Zi' : 'Noapte'}
      </p>
      <div
        className={cn(
          mode === 'noapte' ? 'dark' : 'theme-light',
          'w-full max-w-[390px] space-y-5 rounded-card border border-border bg-page p-4 text-fg',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** O secțiune a paginii: aceeași componentă, o dată pe zi și o dată pe noapte. */
export function KitSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titlu`} className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-titlu`} className={cn('font-extrabold text-fg', kitText.section)}>
          {title}
        </h2>
        {description ? <p className={cn('text-fg-muted', kitText.secondary)}>{description}</p> : null}
      </div>
      <div className="grid gap-4 min-[860px]:grid-cols-2">
        <KitFrame mode="zi">{children}</KitFrame>
        <KitFrame mode="noapte">{children}</KitFrame>
      </div>
    </section>
  )
}

/** O stare a componentei, cu numele ei deasupra. */
export function Stare({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className={cn('font-semibold text-fg-muted', kitText.helper)}>{label}</p>
      {children}
    </div>
  )
}
