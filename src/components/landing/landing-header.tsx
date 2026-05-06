'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const navItems = [
  { href: '#solutie', label: 'Caracteristici' },
  { href: '#asociatie', label: 'Pentru asociații' },
  { href: '#demo', label: 'Demo' },
]

export function LandingHeader() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-[#FAFAF6]/95 backdrop-blur-md" aria-label="Header principal">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
            onClick={() => setIsOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="Logo Zmeurel OS" width="40" height="40" className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 md:text-base">Zmeurel OS</p>
              <p className="truncate text-xs text-slate-500">pentru fermieri și asociații</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Navigație principală">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
            >
              Login
            </Link>
            <Link
              href="/start"
              className="rounded-xl bg-[#3D7A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f4a37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
            >
              Încearcă gratuit
            </Link>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Închide meniul' : 'Deschide meniul'}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2 md:hidden"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isOpen ? (
          <nav id="mobile-menu" aria-label="Navigație mobilă" className="border-t border-slate-200 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                className="rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
                onClick={() => setIsOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/start"
                className="mt-1 rounded-xl bg-[#3D7A5F] px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1f4a37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
                onClick={() => setIsOpen(false)}
              >
                Încearcă gratuit
              </Link>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  )
}
