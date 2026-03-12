import Link from 'next/link'

const footerLinks = [
  { href: '#poveste', label: 'Despre aplicație' },
  { href: '#cum-functioneaza', label: 'Cum funcționează' },
  { href: '#demo', label: 'Demo' },
  { href: '/login', label: 'Login' },
  { href: 'mailto:contact@zmeurel.ro', label: 'Contact' },
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
            <p className="mt-1 text-sm text-[color:var(--agri-text-muted)]">Zmeurel OS © {new Date().getFullYear()}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--agri-text-muted)]">
            {footerLinks.map((link) =>
              link.href.startsWith('mailto:') || link.href.startsWith('#') ? (
                <a key={link.href} href={link.href} className="transition-colors hover:text-[var(--landing-dark)]">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-[var(--landing-dark)]">
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
