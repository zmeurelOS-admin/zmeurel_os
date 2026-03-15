import Link from 'next/link'

import { buildLoginUrl } from '@/lib/auth/redirects'

const footerLinks = [
  { href: '#poveste', label: 'Despre aplicație' },
  { href: '#cum-functioneaza', label: 'Cum funcționează' },
  { href: '/start', label: 'Demo' },
  { href: buildLoginUrl(), label: 'Login' },
  { href: 'https://wa.me/40752953048', label: 'WhatsApp', external: true },
  { href: 'mailto:contact@zmeurel.ro', label: 'Contact' },
  { href: '/ajutor', label: 'Ajutor' },
  { href: '/confidentialitate', label: 'Politica de confidențialitate' },
  { href: '/termeni', label: 'Termeni și condiții' },
]

export default function Footer() {
  return (
    <footer className="border-t border-[color:rgba(49,46,63,0.08)] bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--landing-dark)]">Zmeurel OS</p>
            <p className="mt-1 text-sm text-[color:var(--agri-text-muted)]">
              Zmeurel OS © {new Date().getFullYear()}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://www.facebook.com/ZmeuraSuceava/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook Zmeurel"
                className="text-[color:var(--agri-text-muted)] transition-colors hover:text-[var(--landing-dark)]"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97H15.83c-1.491 0-1.956.931-1.956 1.886v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/zmeurel_sv/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram Zmeurel"
                className="text-[color:var(--agri-text-muted)] transition-colors hover:text-[var(--landing-dark)]"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--agri-text-muted)]">
            {footerLinks.map((link) =>
              link.href.startsWith('mailto:') || link.href.startsWith('#') || link.href.startsWith('https:') ? (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="transition-colors hover:text-[var(--landing-dark)]"
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className="transition-colors hover:text-[var(--landing-dark)]">
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
    </footer>
  )
}
