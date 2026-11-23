import { Banknote, ClipboardList, FlaskConical, Package, Scale, SprayCan } from 'lucide-react'
import type { ReactNode } from 'react'

import { kitText } from '@/components/kit'
import { SectionShell, SectionTitle } from '@/components/landing/landing-shared'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

const PLACI: { titlu: string; text: string; icon: ReactNode }[] = [
  { titlu: 'Recoltări', text: 'kg pe culegător, plata la zi', icon: <Scale aria-hidden /> },
  { titlu: 'Comenzi', text: 'din mesaj, cu livrare și plată', icon: <ClipboardList aria-hidden /> },
  { titlu: 'Stoc', text: 'cât ai, cât e în livrare', icon: <Package aria-hidden /> },
  { titlu: 'Tratamente', text: 'registru, pauze, magazie', icon: <SprayCan aria-hidden /> },
  { titlu: 'Analize', text: 'raport cu QR pentru piață', icon: <FlaskConical aria-hidden /> },
  { titlu: 'Bani', text: 'cheltuieli, vânzări, profit', icon: <Banknote aria-hidden /> },
]

/** Cele 6 plăci „Ce ții în …”. */
export function CeTii() {
  return (
    <SectionShell label={`Ce ții în ${APP_NAME}`}>
      <SectionTitle>{`Ce ții în ${APP_NAME}`}</SectionTitle>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {PLACI.map((placa) => (
          <li key={placa.titlu} className="rounded-box border border-border bg-surface p-3.5 shadow-1">
            <span className="mb-2 inline-flex size-10 items-center justify-center rounded-control bg-primary-soft text-primary [&_svg]:size-5">
              {placa.icon}
            </span>
            <p className={cn(kitText.base, 'font-extrabold text-fg')}>{placa.titlu}</p>
            <p className={cn(kitText.secondary, 'text-fg-muted')}>{placa.text}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
