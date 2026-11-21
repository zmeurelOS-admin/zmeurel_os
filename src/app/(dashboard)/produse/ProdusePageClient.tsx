'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Package, Plus, Search } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { BigInput, Button, EmptyState, ListRow, Notice, Segments, kitText } from '@/components/kit'
import { ProdusForm } from '@/components/produse/ProdusForm'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { detaliuProdus, pretProdus, produseAfisate, type FilaProduse } from '@/lib/produse/produs'
import { queryKeys } from '@/lib/query-keys'
import { getProduse, type Produs } from '@/lib/supabase/queries/produse'
import { cn } from '@/lib/utils'

/*
 * Pozele, „magazin public” / linkul de magazin și blocul „Asociație” (`ProductAssociationOfferBlock`) nu se mai
 * afișează aici până la magazinul nou (decizia din 21.11). Datele din bază rămân neatinse, iar componentele lor
 * (`AddProdusDialog`, `EditProdusDialog`, `ProductAssociationOfferBlock`) rămân în cod pentru atunci.
 */

export function ProdusePageClient() {
  useTrackModuleView('produse')
  const [fila, setFila] = useState<FilaProduse>('activ')
  const [cautare, setCautare] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editat, setEditat] = useState<Produs | null>(null)

  const { data: produse = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.produse,
    queryFn: getProduse,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const active = useMemo(() => produse.filter((produs) => produs.status === 'activ').length, [produse])
  const inactive = produse.length - active
  const lista = useMemo(() => produseAfisate(produse, fila, cautare), [produse, fila, cautare])

  const deschide = (produs: Produs | null) => {
    setEditat(produs)
    setFormOpen(true)
  }

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschide(null)}>
      <Plus aria-hidden />
      Produs
    </Button>
  )

  return (
    <AppShell
      header={<ScreenHeader title="Produse" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        !isLoading ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        <div className="hidden md:block">{addButton}</div>

        <Segments
          aria-label="Ce produse arăt"
          options={[
            { value: 'activ', label: 'Active', count: active > 0 ? active : undefined },
            { value: 'inactiv', label: 'Inactive', count: inactive > 0 ? inactive : undefined },
          ]}
          value={fila}
          onValueChange={setFila}
        />

        {produse.length > 5 ? (
          <BigInput
            aria-label="Caută un produs"
            type="search"
            value={cautare}
            onChange={(event) => setCautare(event.target.value)}
            placeholder="Caută un produs"
            autoComplete="off"
            enterKeyHint="search"
            leading={<Search aria-hidden className="size-5" />}
          />
        ) : null}

        {isError ? (
          <Notice
            tone="danger"
            title="Produsele nu s-au încărcat"
            action={
              <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => void refetch()}>
                Încearcă din nou
              </Button>
            }
          >
            Verifică internetul și încearcă din nou.
          </Notice>
        ) : isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă produsele">
            <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : lista.length > 0 ? (
          <ul className="space-y-2">
            {lista.map((produs) => (
              <li key={produs.id}>
                <ListRow
                  title={produs.nume}
                  detail={detaliuProdus(produs)}
                  trailing={<span className={cn('whitespace-nowrap font-extrabold tabular-nums text-fg', kitText.base)}>{pretProdus(produs)}</span>}
                  onClick={() => deschide(produs)}
                  aria-label={`${produs.nume}, ${detaliuProdus(produs)}, ${pretProdus(produs)}. Deschide`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Package />}
            title={cautare.trim() ? 'Niciun produs găsit' : fila === 'activ' ? 'Niciun produs activ' : 'Niciun produs inactiv'}
            description={
              cautare.trim()
                ? 'Încearcă alt nume.'
                : fila === 'activ'
                  ? 'Adaugă ce vinzi: zmeură, mure, gem. Apar la comenzi și vânzări.'
                  : 'Produsele dezactivate apar aici.'
            }
          />
        )}

        <Notice tone="info" title="Prețul la comenzi vine din „Prețul standard”">
          Îl schimbi din{' '}
          <Link href="/settings/pret-standard" className="font-bold underline underline-offset-2">
            Setări › Prețul standard
          </Link>
          ; aici e prețul de listă al produsului.
        </Notice>
      </ScreenBody>

      <ProdusForm open={formOpen} onOpenChange={setFormOpen} produs={editat} />
    </AppShell>
  )
}
