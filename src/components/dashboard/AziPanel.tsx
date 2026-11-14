'use client'

import Link from 'next/link'
import { useMemo, type ComponentType } from 'react'
import { AlertTriangle, ChevronRight, Clock, ShoppingBag, Send, Truck, Wallet } from 'lucide-react'

import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { calculatePauseStatus, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import { cn } from '@/lib/utils'

type Tone = 'danger' | 'accent' | 'warning' | 'info' | 'neutral'

type TodoItem = {
  id: string
  tone: Tone
  icon: ComponentType<{ className?: string }>
  title: string
  detail: string
  href: string
}

const OPEN_STATUSES = new Set(['noua', 'confirmata', 'programata'])

const toneClass: Record<Tone, string> = {
  danger: 'bg-[var(--danger-bg)] text-[var(--danger-text)]',
  accent: 'bg-[var(--agri-primary-muted)] text-[var(--agri-primary)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning-text)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-text)]',
  neutral: 'bg-[var(--surface-card-muted)] text-[var(--text-primary)]',
}

const kg = (value: number) => value.toLocaleString('ro-RO', { maximumFractionDigits: 1 })
const lei = (value: number) => Math.round(value).toLocaleString('ro-RO')
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : null)

/**
 * V2 · Ecranul Azi pe mobil: stocul de zmeură cal. I acum și o listă „De făcut” în care
 * fiecare rând deschide locul unde se rezolvă. Folosește doar date pe care dashboard-ul le are deja.
 */
export function AziPanel({
  comenzi,
  recoltari,
  activitati,
  parcele,
  disponibilCal1Kg,
  todayIso,
}: {
  comenzi: Comanda[]
  recoltari: Recoltare[]
  activitati: ActivitateAgricola[]
  parcele: Parcela[]
  disponibilCal1Kg: number | null
  todayIso: string
}) {
  const model = useMemo(() => {
    const open = comenzi.filter((c) => OPEN_STATUSES.has(c.status))
    const sumKg = (rows: Comanda[]) => rows.reduce((s, c) => s + Number(c.cantitate_kg || 0), 0)
    const sumLei = (rows: Comanda[]) => rows.reduce((s, c) => s + Number(c.total || 0), 0)

    const restante = open.filter((c) => {
      const d = dateOnly(c.data_livrare)
      return d !== null && d < todayIso
    })
    const deAziNeplecate = open.filter((c) => dateOnly(c.data_livrare) === todayIso && c.status !== 'noua')
    const noi = open.filter((c) => c.status === 'noua')
    const inLivrare = comenzi.filter((c) => c.status === 'in_livrare')
    const neincasate = comenzi.filter((c) => c.status === 'livrata' && c.linked_vanzare?.status_plata === 'neplatit')
    const necesarAzi = sumKg(open.filter((c) => {
      const d = dateOnly(c.data_livrare)
      return d !== null && d <= todayIso
    }))
    const necesarRest = sumKg(open.filter((c) => {
      const d = dateOnly(c.data_livrare)
      return d === null || d > todayIso
    }))
    const recoltatAzi = recoltari
      .filter((r) => dateOnly(r.data) === todayIso)
      .reduce((s, r) => s + Number(r.kg_cal1 ?? 0), 0)

    const parcelaName = new Map(parcele.map((p) => [p.id, formatUnitateDisplayName(p.nume_parcela, p.tip_unitate, 'Parcelă')]))
    const pauze = new Map<string, string>()
    for (const act of activitati) {
      if (!act.parcela_id || !act.data_aplicare || !act.timp_pauza_zile) continue
      const { status, dataRecoltarePermisa } = calculatePauseStatus(act.data_aplicare, act.timp_pauza_zile)
      if (status !== 'Pauza') continue
      const prev = pauze.get(act.parcela_id)
      if (!prev || dataRecoltarePermisa > prev) pauze.set(act.parcela_id, dataRecoltarePermisa)
    }

    const todo: TodoItem[] = []
    if (restante.length) {
      todo.push({
        id: 'restante', tone: 'danger', icon: AlertTriangle, href: '/comenzi?filter=restante',
        title: `${restante.length} ${plural(restante.length, 'comandă restantă', 'comenzi restante')}`,
        detail: `${kg(sumKg(restante))} kg · ${plural(restante.length, 'trebuia livrată', 'trebuiau livrate')} până ieri`,
      })
    }
    if (noi.length) {
      todo.push({
        id: 'noi', tone: 'accent', icon: ShoppingBag, href: '/comenzi',
        title: `${noi.length} ${plural(noi.length, 'comandă nouă', 'comenzi noi')} de programat`,
        detail: `${kg(sumKg(noi))} kg · ${lei(sumLei(noi))} lei`,
      })
    }
    if (deAziNeplecate.length) {
      todo.push({
        id: 'azi', tone: 'warning', icon: Send, href: '/comenzi?filter=azi',
        title: `${deAziNeplecate.length} ${plural(deAziNeplecate.length, 'comandă de azi', 'comenzi de azi')} de trimis în livrare`,
        detail: `${kg(sumKg(deAziNeplecate))} kg · încă nu ${plural(deAziNeplecate.length, 'e', 'sunt')} pe traseu`,
      })
    }
    if (inLivrare.length) {
      todo.push({
        id: 'livrari', tone: 'info', icon: Truck, href: '/livrari',
        title: `${inLivrare.length} ${plural(inLivrare.length, 'livrare', 'livrări')} de făcut`,
        detail: `${kg(sumKg(inLivrare))} kg · ${lei(sumLei(inLivrare))} lei de încasat`,
      })
    }
    for (const [parcelaId, permis] of pauze) {
      todo.push({
        id: `pauza-${parcelaId}`, tone: 'warning', icon: Clock, href: '/activitati-agricole',
        title: `${parcelaName.get(parcelaId) ?? 'Parcelă'}: nu recolta încă`,
        detail: `Pauză după tratament, recoltare permisă din ${new Date(permis).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`,
      })
    }
    if (neincasate.length) {
      todo.push({
        id: 'neincasat', tone: 'neutral', icon: Wallet, href: '/comenzi?filter=livrate',
        title: `${lei(sumLei(neincasate))} lei neîncasați`,
        detail: `de la ${neincasate.length} ${plural(neincasate.length, 'comandă livrată', 'comenzi livrate')}`,
      })
    }

    const disp = disponibilCal1Kg ?? 0
    return { todo, recoltatAzi, necesarAzi, necesarRest, dif: disp - necesarAzi, disp }
  }, [activitati, comenzi, disponibilCal1Kg, parcele, recoltari, todayIso])

  return (
    <div className="space-y-3">
      <section aria-label="Stoc zmeură cal. I" className="rounded-[22px] bg-[var(--agri-hero-bg)] p-4 text-white">
        <p className="text-sm text-white/75 [font-weight:600]">Zmeură cal. I, disponibilă acum</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-[60px] leading-none tabular-nums [font-weight:800]">
            {disponibilCal1Kg === null ? '…' : kg(model.disp)}
          </span>
          <span className="text-xl text-white/75 [font-weight:700]">kg</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Recoltat azi', model.recoltatAzi],
            ['Necesar azi', model.necesarAzi],
            ['Necesar rest', model.necesarRest],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-white/10 px-2.5 py-2">
              <p className="text-xs text-white/75 [font-weight:600]">{label}</p>
              <p className="font-display text-lg [font-weight:800]">{kg(value as number)} kg</p>
            </div>
          ))}
        </div>
        {disponibilCal1Kg !== null ? (
          <p
            className={cn(
              'mt-2.5 rounded-xl px-3 py-2 text-sm [font-weight:700]',
              model.dif < 0 ? 'bg-[#7A221C] text-[#FFE4E0]' : 'bg-[#22553A] text-[#DDF7E6]',
            )}
          >
            {model.dif < 0
              ? `Lipsesc ${kg(-model.dif)} kg pentru comenzile de azi.`
              : `Acoperi comenzile de azi. Îți rămân ${kg(model.dif)} kg de vândut.`}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="azi-de-facut" className="space-y-2">
        <h2 id="azi-de-facut" className="flex items-center justify-between text-[15px] text-[var(--text-primary)] [font-weight:800]">
          De făcut
          <span className="rounded-full bg-[var(--surface-card-muted)] px-2.5 py-0.5 font-display text-[13px]">{model.todo.length}</span>
        </h2>
        {model.todo.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-6 text-center text-[var(--text-secondary)] [font-weight:600]">
            Totul e la zi.
          </p>
        ) : (
          <ul className="space-y-2">
            {model.todo.map(({ id, tone, icon: Icon, title, detail, href }) => (
              <li key={id}>
                <Link
                  href={href}
                  className="flex min-h-[62px] items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2.5 active:scale-[0.99]"
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClass[tone])}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] text-[var(--text-primary)] [font-weight:800]">{title}</span>
                    <span className="block text-[13.5px] text-[var(--text-secondary)] [font-weight:600]">{detail}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
