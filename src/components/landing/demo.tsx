'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, PlayCircle } from 'lucide-react'

import CountUp from '@/components/landing/count-up'
import Reveal from '@/components/landing/reveal'
import { Button } from '@/components/ui/button'
import { buildLoginUrl } from '@/lib/auth/redirects'

export default function Demo() {
  return (
    <section id="demo" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="overflow-hidden rounded-[36px] border border-[color:rgba(49,46,63,0.08)] bg-[linear-gradient(135deg,#312e3f_0%,#3a3650_55%,#2f6f4e_140%)] p-6 text-white shadow-[0_30px_80px_rgba(49,46,63,0.2)] sm:p-10 lg:p-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-medium text-white/90">
              <PlayCircle className="size-4" />
              Demo ghidat
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Vezi cum arată ferma ta într-o aplicație simplă
            </h2>
            <p className="max-w-2xl text-base leading-7 text-white/75">
              Intră rapid într-o fermă demo și vezi cum se notează parcelele, lucrările, recoltele
              și vânzările.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-[linear-gradient(135deg,#f16b6b_0%,#d84b62_100%)] px-6 text-white shadow-[0_18px_44px_rgba(241,107,107,0.28)] hover:brightness-105"
            >
              <Link href={buildLoginUrl()}>
                Vezi demo
                <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/20 bg-white/0 px-6 text-white transition-colors hover:bg-white/10"
            >
              <Link href="/start">Încearcă gratuit</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Exemplu de recoltă</p>
            <p className="mt-2 text-3xl font-bold text-white">
              <CountUp to={120} suffix=" kg" />
            </p>
            <p className="mt-2 text-sm text-white/70">Vezi cât s-a cules în ziua de azi.</p>
          </motion.div>
          <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Echipă activă</p>
            <p className="mt-2 text-3xl font-bold text-white">
              <CountUp to={4} /> culegători
            </p>
            <p className="mt-2 text-sm text-white/70">Vezi cine a lucrat și cât ai de plătit.</p>
          </motion.div>
        </div>
      </Reveal>
    </section>
  )
}
