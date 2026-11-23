import Link from 'next/link'

import { kitFocus, kitText } from '@/components/kit'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

const LINKURI = [
  { href: '/start', label: 'Demo' },
  { href: '/login', label: 'Intră în cont' },
  { href: '/ajutor', label: 'Ajutor' },
  { href: '/termeni', label: 'Termeni' },
  { href: '/confidentialitate', label: 'Confidențialitate' },
]

/** Subsolul primei pagini (și al paginilor Ajutor, Termeni, Confidențialitate). */
export function LandingFooter() {
  return (
    <footer className="border-t border-border-subtle bg-page px-4 py-8" aria-label="Subsol">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <nav className="flex flex-wrap gap-x-1 gap-y-1" aria-label="Legături">
          {LINKURI.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(kitText.secondary, 'inline-flex h-touch items-center rounded-control px-2 font-semibold text-fg-muted hover:text-fg', kitFocus)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className={cn(kitText.helper, 'px-2 text-fg-muted')}>© {new Date().getFullYear()} {APP_NAME}</p>
      </div>
    </footer>
  )
}
