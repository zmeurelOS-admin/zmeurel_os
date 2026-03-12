'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Leaf } from 'lucide-react'

import Reveal from '@/components/landing/reveal'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '#solutie', label: 'Caracteristici' },
  { href: '#cum-functioneaza', label: 'Cum funcționează' },
  { href: '#demo', label: 'Demo' },
]

const farmTags = ['fructe de pădure', 'solarii', 'livezi']

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top_left,rgba(241,107,107,0.22),transparent_40%),radial-gradient(circle_at_85%_15%,rgba(47,111,78,0.18),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(49,46,63,0.08),transparent_36%)]" />
      <div className="absolute left-[-5%] top-24 h-56 w-56 rounded-full bg-[rgba(241,107,107,0.12)] blur-3xl" />
      <div className="absolute right-[-3%] top-12 h-60 w-60 rounded-full bg-[rgba(47,111,78,0.12)] blur-3xl" />

      <div className="mx-auto flex max-w-7xl flex-col px-4 pb-16 pt-5 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24 lg:pt-7">
        <div className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/75 px-4 py-3 shadow-[0_12px_32px_rgba(49,46,63,0.08)] backdrop-blur sm:px-5">
          <Link
            href="/"
            className="flex items-center gap-3 text-sm font-semibold tracking-[0.12em] text-[var(--landing-dark)] uppercase"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--landing-dark)] text-sm font-bold text-white shadow-lg">
              ZO
            </span>
            Zmeurel OS
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-[color:var(--agri-text-muted)] md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-[var(--landing-dark)]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="rounded-full px-3 text-[var(--landing-dark)] sm:px-4">
              <Link href="/login">Login</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full bg-[linear-gradient(135deg,#f16b6b_0%,#d84b62_100%)] px-3 text-white shadow-sm hover:brightness-105 sm:px-4"
            >
              <Link href="/start">Încearcă gratuit</Link>
            </Button>
          </div>
        </div>

        <div className="grid items-center gap-10 pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-14 lg:pt-18">
          <div className="space-y-7">
            <Reveal className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(47,111,78,0.16)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--landing-leaf)] shadow-sm backdrop-blur">
              <Leaf className="size-4" />
              Evidență simplă pentru fermă
            </Reveal>

            <Reveal delayMs={80} className="space-y-5">
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[var(--landing-dark)] sm:text-5xl lg:text-6xl">
                Ține evidența fermei tale direct pe telefon. Simplu și rapid.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--agri-text-muted)] sm:text-lg">
                Recolte, lucrări, vânzări și cheltuieli — toate într-un singur loc.
              </p>
              <div className="flex flex-wrap gap-2">
                {farmTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color:rgba(49,46,63,0.1)] bg-white/80 px-3 py-1 text-sm text-[var(--landing-dark)] shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-sm font-medium text-[var(--landing-leaf)]">
                Aplicația este făcută de un fermier din Suceava pentru fermieri.
              </p>
            </Reveal>

            <Reveal delayMs={160} className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-[linear-gradient(135deg,#f16b6b_0%,#d84b62_100%)] px-6 text-white shadow-[0_18px_42px_rgba(241,107,107,0.28)] hover:brightness-105"
              >
                <Link href="/start">Încearcă gratuit</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-[var(--landing-dark)]/20 bg-white/80 px-6 text-[var(--landing-dark)] shadow-sm transition-colors hover:border-[var(--landing-dark)]/30 hover:bg-[var(--landing-dark)] hover:text-white"
              >
                <a href="#cum-functioneaza">
                  Vezi cum funcționează
                  <ArrowRight className="size-5" />
                </a>
              </Button>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Notezi repede', 'Adaugi datele direct din câmp sau din solar.'],
                ['Vezi clar', 'Ai toate datele fermei într-un singur loc.'],
                ['Înțelegi mai ușor', 'Vezi ce produce și ce câștig aduce ferma.'],
              ].map(([title, text], index) => (
                <Reveal
                  key={title}
                  delayMs={240 + index * 80}
                  className="rounded-3xl border border-white/80 bg-white/88 p-4 shadow-[0_14px_34px_rgba(49,46,63,0.07)] backdrop-blur transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_22px_50px_rgba(49,46,63,0.12)]"
                >
                  <p className="text-sm font-semibold text-[var(--landing-dark)]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--agri-text-muted)]">{text}</p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delayMs={120} className="relative">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative will-change-transform"
            >
              <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[#f7eee8] p-3 shadow-[0_24px_80px_rgba(49,46,63,0.16)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(241,107,107,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(47,111,78,0.18),transparent_34%)]" />
                <div className="relative rounded-[26px] bg-white/70 p-3 backdrop-blur">
                  <Image
                    src="/landing/farmer-hero.svg"
                    alt="Fermier folosind aplicația în fermă."
                    width={960}
                    height={1080}
                    priority
                    className="h-auto w-full rounded-[22px]"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-5 left-4 rounded-3xl border border-white/80 bg-white px-4 py-3 shadow-[0_18px_45px_rgba(49,46,63,0.16)] sm:left-8 will-change-transform"
            >
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--landing-leaf)] uppercase">Astăzi</p>
              <p className="mt-1 text-base font-semibold text-[var(--landing-dark)]">120 kg recoltate</p>
              <p className="text-sm text-[color:var(--agri-text-muted)]">4 culegători, 2 parcele active</p>
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
