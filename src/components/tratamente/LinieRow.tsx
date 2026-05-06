'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, EllipsisVertical, PencilLine, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PlanTratamentLinieCuProdus } from '@/lib/supabase/queries/tratamente'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

import { formatDoza, getStadiuMeta } from '@/components/tratamente/plan-wizard/helpers'

interface LinieRowProps {
  grupBiologic?: GrupBiologic | null
  index: number
  linie: PlanTratamentLinieCuProdus
  onDelete: () => void
  onEdit: () => void
  onMarkAplicata?: (linieId: string) => void
  onMoveDown: () => void
  onMoveUp: () => void
  total: number
}

function resolveProductName(produs: NonNullable<PlanTratamentLinieCuProdus['produse']>[number]) {
  return produs.produs?.nume_comercial ?? produs.produs_nume_manual?.trim() ?? produs.produs_nume_snapshot?.trim() ?? 'Produs fără nume'
}

function resolveProductDose(produs: NonNullable<PlanTratamentLinieCuProdus['produse']>[number]): string {
  const doses = [
    typeof produs.doza_ml_per_hl === 'number' ? formatDoza(produs.doza_ml_per_hl, 'ml/hl') : null,
    typeof produs.doza_l_per_ha === 'number' ? formatDoza(produs.doza_l_per_ha, 'l/ha') : null,
  ].filter(Boolean)

  return doses.length > 0 ? doses.join(' · ') : 'Doză necompletată'
}

function resolveLegacyDoza(linie: PlanTratamentLinieCuProdus): string {
  if (typeof linie.doza_l_per_ha === 'number' && linie.doza_l_per_ha > 0) {
    return formatDoza(linie.doza_l_per_ha, 'l/ha')
  }

  return formatDoza(linie.doza_ml_per_hl, 'ml/hl')
}

function normalizeStageLabel(value: string | null | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? ''
}

type StageBucket =
  | 'vegetativ'
  | 'inflorire'
  | 'fructificare'
  | 'recoltare'
  | 'post_recolta'
  | 'repaus'
  | 'fallback'

type StageTheme = { bucket: StageBucket; accent: string; bg: string; emoji: string }

const STAGE_THEME: Record<Exclude<StageBucket, 'fallback'>, StageTheme> = {
  vegetativ: { bucket: 'vegetativ', accent: '#3D7A5F', bg: '#E8F3EE', emoji: '🌿' },
  inflorire: { bucket: 'inflorire', accent: '#BE185D', bg: '#FCE7F3', emoji: '🌸' },
  fructificare: { bucket: 'fructificare', accent: '#7C3AED', bg: '#EDE9FE', emoji: '🫐' },
  recoltare: { bucket: 'recoltare', accent: '#B45309', bg: '#FEF3C7', emoji: '🍓' },
  post_recolta: { bucket: 'post_recolta', accent: '#0369A1', bg: '#E0F2FE', emoji: '🍂' },
  repaus: { bucket: 'repaus', accent: '#6B7280', bg: '#F3F4F6', emoji: '❄️' },
}

const STAGE_FALLBACK: StageTheme = {
  bucket: 'fallback',
  accent: '#3D7A5F',
  bg: '#E8F3EE',
  emoji: '🌱',
}

const STAGE_CONFIG: Record<string, StageTheme> = (() => {
  const map: Record<string, StageTheme> = {}
  const assign = (bucket: Exclude<StageBucket, 'fallback'>, aliases: string[]) => {
    for (const alias of aliases) {
      map[normalizeStageLabel(alias)] = STAGE_THEME[bucket]
    }
  }

  assign('vegetativ', [
    'rasad',
    'răsad',
    'semanat',
    'semănat',
    'semanat rasarire',
    'semănat răsărire',
    'rasarire',
    'răsărire',
    'transplant',
    'transplant prindere',
    'prindere',
    'umflare_muguri',
    'umflare muguri',
    'dezmugurire',
    'crestere_vegetativa',
    'creștere vegetativă',
    'crestere vegetativa',
    'vegetativ',
    'formare_rozeta',
    'formare rozeta',
    'formare rozetă',
    'rozeta',
    'rozetă',
    'buton_verde',
    'buton verde',
  ])

  assign('inflorire', [
    'etaj_floral',
    'etaj floral',
    'aparitie_etaj_floral',
    'aparitie etaj floral',
    'apariție etaj floral',
    'inflorescente pe floricane',
    'inflorescențe pe floricane',
    'buton_roz',
    'buton roz',
    'prefloral',
    'inflorit',
    'înflorit',
    'inflorire',
    'înflorire',
    'inflorit pe floricane',
    'înflorit pe floricane',
    'inflorit pe primocane',
    'înflorit pe primocane',
    'scuturare_petale',
    'scuturare petale',
    'cadere_petale',
    'cadere petale',
    'cădere petale',
    'sfarsit de inflorit',
    'sfârșit de înflorit',
  ])

  assign('fructificare', [
    'legare_fruct',
    'legare fruct',
    'fruct_verde',
    'fruct verde',
    'fructe verzi in crestere',
    'fructe verzi în creștere',
    'formare_capatana',
    'formare capatana',
    'formare căpățână',
    'capatana',
    'căpățână',
    'bulbificare',
    'umplere_pastaie',
    'umplere pastaie',
    'umplere păstaie',
    'ingrosare_radacina',
    'ingrosare radacina',
    'îngroșare rădăcină',
    'radacina',
    'rădăcină',
    'parga',
    'pârgă',
    'parguire',
    'pârguire',
    'inceput de coacere',
    'început de coacere',
    'primele fructe colorate',
  ])

  assign('recoltare', [
    'maturitate',
    'maturare',
    'recoltare',
    'recoltare fruct copt',
    'recoltare pe floricane',
    'recoltare pe primocane',
  ])

  assign('post_recolta', [
    'post_recoltare',
    'post recoltare',
    'post-recoltare',
    'dupa recoltare',
    'după recoltare',
    'dupa recoltare floricane',
    'după recoltare floricane',
    'dupa recoltare primocane',
    'după recoltare primocane',
    'bolting',
    'inspicuire',
    'înspicuire',
  ])

  assign('repaus', [
    'repaus',
    'repaus_vegetativ',
    'repaus vegetativ',
    'repausul tufei',
    'floricane in repaus',
    'floricane în repaus',
    'primocane in repaus',
    'primocane în repaus',
    'dormant',
    'iarna',
    'iarnă',
  ])

  return map
})()

function resolveStageTheme(stadiuLabel: string) {
  return STAGE_CONFIG[normalizeStageLabel(stadiuLabel)] ?? STAGE_FALLBACK
}

export function LinieRow({
  grupBiologic,
  index,
  linie,
  onDelete,
  onEdit,
  onMarkAplicata,
  onMoveDown,
  onMoveUp,
  total,
}: LinieRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const stadiu = getStadiuMeta(linie.stadiu_trigger, grupBiologic, linie.cohort_trigger)
  const stageTheme = useMemo(() => resolveStageTheme(stadiu.label), [stadiu.label])
  const produse = linie.produse?.length ? linie.produse : []
  const isManual = produse.length > 0
    ? produse.some((produs) => !produs.produs && Boolean(produs.produs_nume_manual?.trim()))
    : !linie.produs && Boolean(linie.produs_nume_manual?.trim())
  const displayName = produse.length > 0
    ? resolveProductName(produse[0])
    : linie.produs?.nume_comercial ?? linie.produs_nume_manual?.trim() ?? 'Produs fără nume'
  const secondaryProducts = produse.length > 1
    ? produse.slice(1).map(resolveProductName).join(' · ')
    : linie.motiv_adaugare?.trim() || (isManual ? 'Manual' : '')
  const badgeStyle = { backgroundColor: stageTheme.bg, color: stageTheme.accent }
  const borderStyle = expanded ? { borderColor: `${stageTheme.accent}4D` } : undefined

  return (
    <div
      className={`mb-[7px] rounded-[14px] border bg-white transition-[border-color,opacity,box-shadow] duration-200 ${
        expanded ? 'shadow-sm' : ''
      }`}
      style={borderStyle}
    >
      {/* --- SECTION: summary --- */}
      <div className="flex w-full items-start gap-3 px-3 py-3">
        <button
          type="button"
          className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border-2 border-gray-300 bg-white transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!onMarkAplicata}
          onClick={(event) => {
            event.stopPropagation()
            // --- FIX 2: checkbox-ul marchează linia doar când callback-ul există ---
            onMarkAplicata?.(linie.id)
          }}
          aria-label="Marchează intervenția ca aplicată"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3.5 8.2L6.7 11.2L12.5 5.4"
              stroke="#D1D5DB"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-5 text-[var(--text-primary)]">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
              {secondaryProducts || stadiu.label}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={badgeStyle}
            >
              #{linie.ordine}
            </span>
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* --- SECTION: details --- */}
      <div
        className={`grid overflow-hidden transition-[max-height,opacity] duration-200 ${
          expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3">
          <div className="rounded-lg bg-[#F8FAF9] p-3">
            {produse.length > 0 ? (
              <div className="space-y-2">
                {produse.map((produs) => (
                  <div
                    key={produs.id}
                    className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                  >
                    <p className="min-w-0 flex-1 text-sm text-[var(--text-primary)]">
                      {resolveProductName(produs)}
                    </p>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={badgeStyle}>
                      {resolveProductDose(produs)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-white px-3 py-2 text-sm text-[var(--text-secondary)]">
                {resolveLegacyDoza(linie)}
              </div>
            )}
          </div>

          {linie.observatii?.trim() ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              📝 {linie.observatii}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              <PencilLine className="h-4 w-4" />
              Editează
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Șterge
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mută sus intervenția ${index + 1}`}
              disabled={index === 0}
              onClick={onMoveUp}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mută jos intervenția ${index + 1}`}
              disabled={index === total - 1}
              onClick={onMoveDown}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>

            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Acțiuni pentru intervenția ${index + 1}`}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <div className="space-y-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)]"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                  >
                    <PencilLine className="h-4 w-4" aria-label="Editează intervenția" />
                    Editează
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--soft-danger-text)] transition hover:bg-[var(--surface-card-muted)]"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-label="Șterge intervenția" />
                    Șterge
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  )
}
