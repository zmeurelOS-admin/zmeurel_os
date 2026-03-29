'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { useAddAction } from '@/contexts/AddActionContext'

function getRouteAddConfig(pathname: string): { label: string; href: string } {
  if (pathname === '/dashboard') return { label: 'Adaugă recoltare', href: '/recoltari?add=1' }
  if (pathname.startsWith('/recoltari')) return { label: 'Adaugă recoltare', href: '/recoltari?add=1' }
  if (pathname.startsWith('/comenzi')) return { label: 'Adaugă comandă', href: '/comenzi?add=1' }
  if (pathname.startsWith('/parcele')) return { label: 'Adaugă teren', href: '/parcele' }
  if (pathname.startsWith('/cheltuieli')) return { label: 'Adaugă cheltuială', href: '/cheltuieli?add=1' }
  if (pathname.startsWith('/activitati-agricole')) return { label: 'Adaugă activitate', href: '/activitati-agricole' }
  if (pathname.startsWith('/vanzari-butasi')) return { label: 'Adaugă vânzare', href: '/vanzari-butasi' }
  if (pathname.startsWith('/vanzari')) return { label: 'Adaugă vânzare', href: '/vanzari' }
  if (pathname.startsWith('/clienti')) return { label: 'Adaugă client', href: '/clienti' }
  if (pathname.startsWith('/culegatori')) return { label: 'Adaugă culegător', href: '/culegatori' }
  if (pathname.startsWith('/investitii')) return { label: 'Adaugă investiție', href: '/investitii' }
  return { label: 'Adaugă recoltare', href: '/recoltari?add=1' }
}

export default function ManualAddFab() {
  const pathname = usePathname()
  const router = useRouter()
  const { triggerAddAction } = useAddAction()
  const routeAddConfig = useMemo(() => getRouteAddConfig(pathname), [pathname])

  const handleClick = () => {
    const triggered = triggerAddAction()
    if (!triggered) {
      router.push(routeAddConfig.href)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="md:hidden"
      aria-label={routeAddConfig.label}
      title={routeAddConfig.label}
      data-tutorial="quick-add-button"
      data-mobile-fab="true"
      style={{
        position: 'fixed',
        bottom: 152,
        right: 18,
        zIndex: 41,
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'var(--fab-surface)',
        border: '1.5px solid var(--fab-border)',
        boxShadow: 'var(--shadow-card-raised)',
        fontSize: 18,
        color: 'var(--fab-text)',
        fontWeight: 300,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      +
    </button>
  )
}
