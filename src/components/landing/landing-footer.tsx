import Link from 'next/link'

import { SectionShell } from '@/components/landing/landing-shared'

const footerLinks = [
  { href: '/start', label: 'Demo' },
  { href: '/login', label: 'Login' },
  { href: 'https://wa.me/40752953048', label: 'WhatsApp', external: true },
  { href: 'mailto:contact@zmeurel.ro', label: 'Contact', external: true },
  { href: '/ajutor', label: 'Ajutor' },
  { href: '/confidentialitate', label: 'Confidențialitate' },
  { href: '/termeni', label: 'Termeni' },
]

export function LandingFooter() {
  return (
    <SectionShell label="Footer" className="border-t border-slate-200 bg-[#FAFAF6] py-10">
      <footer className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-bold text-slate-800">Zmeurel OS</p>
          <p className="mt-1 text-sm text-slate-500">© 2026 Toate drepturile rezervate.</p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="Linkuri footer">
          {footerLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </footer>
    </SectionShell>
  )
}
