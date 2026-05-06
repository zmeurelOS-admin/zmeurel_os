'use client'

import { useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { GanttRow } from '@/lib/tratamente/conformitate'

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec']
const VIEWBOX_WIDTH = 310
const CELL_WIDTH = 10
const BAR_HEIGHT = 18
const BAR_GAP = 6
const MIN_LANE_HEIGHT = 48

interface GanttTimelineProps {
  labelsById: Record<string, { produs: string; data: string }>
  onSelect?: (aplicareId: string) => void
  rows: GanttRow[]
}

type DetailMeta = {
  produs: string
  data: string
  doza?: string
  stadiu?: string
  tip_interventie?: string
  tipInterventie?: string
}

function normalizeValue(value: string | null | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? ''
}

function resolveStageColor(stageLike: string | null | undefined): string {
  const value = normalizeValue(stageLike)
  if (value.includes('crestere vegetativa')) return '#3D7A5F'
  if (value.includes('inflorescente pe floricane')) return '#B45309'
  if (value.includes('inflorire')) return '#BE185D'
  if (value.includes('fructificare')) return '#7C3AED'
  if (value.includes('post-recolta') || value.includes('post recolta')) return '#0369A1'
  return '#3D7A5F'
}

function resolveBarColor(
  aplicare: GanttRow['aplicari'][number],
  meta: DetailMeta | undefined
): string {
  const explicitStage =
    meta?.stadiu ??
    meta?.tipInterventie ??
    meta?.tip_interventie

  if (explicitStage) {
    return resolveStageColor(explicitStage)
  }

  if (aplicare.tipCuloare === 'orange') return '#B45309'
  if (aplicare.tipCuloare === 'yellow') return '#BE185D'
  if (aplicare.tipCuloare === 'blue') return '#0369A1'
  if (aplicare.tipCuloare === 'gray') return '#7C3AED'
  return '#3D7A5F'
}

function resolveTextColor(status: string): string {
  return status === 'anulata' ? '#475569' : '#FFFFFF'
}

function resolveLegacyButtonClass(color: string, status: string): string {
  const base =
    color === 'blue'
      ? 'bg-sky-500'
      : color === 'orange'
        ? 'bg-orange-500'
        : color === 'yellow'
          ? 'bg-amber-400'
          : color === 'green'
            ? 'bg-emerald-500'
            : 'bg-slate-500'

  if (status === 'anulata') return `${base} opacity-50`
  if (status === 'planificata' || status === 'reprogramata') return `${base} opacity-80`
  return base
}

function resolveRowYear(row: GanttRow, labelsById: GanttTimelineProps['labelsById']): number | null {
  for (const aplicare of row.aplicari) {
    const rawDate = labelsById[aplicare.aplicareId]?.data
    const match = rawDate?.match(/\b(20\d{2}|21\d{2})\b/)
    if (match) return Number(match[1])
  }
  return null
}

function buildLanes(row: GanttRow) {
  const levelsByDay = new Map<number, number>()
  const laneItems = row.aplicari.map((aplicare) => {
    const day = Math.min(Math.max(aplicare.ziua, 1), 31)
    const level = levelsByDay.get(day) ?? 0
    levelsByDay.set(day, level + 1)

    const width = 18
    const x = Math.max(1, Math.min(VIEWBOX_WIDTH - width - 1, (day - 1) * CELL_WIDTH + 1))
    const y = 6 + level * (BAR_HEIGHT + BAR_GAP)
    return {
      ...aplicare,
      day,
      level,
      width,
      x,
      y,
    }
  })

  const maxLevel = laneItems.reduce((max, item) => Math.max(max, item.level), 0)
  const height = row.aplicari.length > 0
    ? Math.max(MIN_LANE_HEIGHT, 12 + (maxLevel + 1) * BAR_HEIGHT + maxLevel * BAR_GAP)
    : MIN_LANE_HEIGHT

  return { laneItems, height }
}

export function GanttTimeline({ labelsById, onSelect, rows }: GanttTimelineProps) {
  const [activeAplicareId, setActiveAplicareId] = useState<string | null>(null)
  const activeMeta = activeAplicareId ? (labelsById[activeAplicareId] as DetailMeta | undefined) : undefined
  const compatibilityMode = rows.length > 1

  return (
    <>
      <div className="space-y-3" role="img" aria-label="Calendar anual al aplicărilor de tratamente">
        {rows.map((row) => {
          const { laneItems, height } = buildLanes(row)
          const rowYear = resolveRowYear(row, labelsById)
          const today = new Date()
          const showTodayLine =
            rowYear === today.getFullYear() && row.luna === today.getMonth() + 1
          const todayX = (today.getDate() - 1) * CELL_WIDTH + CELL_WIDTH / 2

          return (
            <div key={row.luna} className={compatibilityMode ? 'rounded-[18px] border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(120,100,70,0.08)]' : 'space-y-2'}>
              {compatibilityMode ? (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{MONTH_LABELS[row.luna - 1] ?? `Luna ${row.luna}`}</h3>
                  <span className="text-xs text-gray-400">{row.aplicari.length} aplicări</span>
                </div>
              ) : null}

              {/* --- SECTION: day scale --- */}
              <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">
                <span>1</span>
                <span>6</span>
                <span>12</span>
                <span>18</span>
                <span>24</span>
                <span className="text-right">31</span>
              </div>

              {/* --- SECTION: gantt lane --- */}
              <div className="relative min-h-[48px] overflow-hidden rounded-xl border border-gray-200 bg-[#F8FAF9] px-2 py-2">
                <svg
                  className="block h-full w-full"
                  viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <rect x="0" y="0" width={VIEWBOX_WIDTH} height={height} fill="#F8FAF9" rx="10" />

                  {Array.from({ length: 31 }, (_, index) => {
                    const x = index * CELL_WIDTH
                    return (
                      <line
                        key={`grid-${row.luna}-${index + 1}`}
                        x1={x}
                        x2={x}
                        y1="0"
                        y2={String(height)}
                        stroke="#E5E7EB"
                        strokeWidth="0.8"
                      />
                    )
                  })}

                  {showTodayLine ? (
                    <line
                      x1={todayX}
                      x2={todayX}
                      y1="0"
                      y2={String(height)}
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                  ) : null}

                  {laneItems.map((item) => {
                    const meta = labelsById[item.aplicareId] as DetailMeta | undefined
                    const fill = resolveBarColor(item, meta)
                    const label = meta?.produs ?? `Aplicare ${item.aplicareId}`
                    const showLabel = item.width >= 30

                    return (
                      <g key={item.aplicareId}>
                        <rect
                          x={item.x}
                          y={item.y}
                          width={item.width}
                          height={BAR_HEIGHT}
                          rx="4"
                          fill={fill}
                          opacity={item.status === 'anulata' ? 0.45 : item.status === 'planificata' || item.status === 'reprogramata' ? 0.8 : 1}
                        />
                        {item.status === 'anulata' ? (
                          <line
                            data-testid="gantt-pill-cancelled-line"
                            x1={item.x + 2}
                            x2={item.x + item.width - 2}
                            y1={item.y + BAR_HEIGHT / 2}
                            y2={item.y + BAR_HEIGHT / 2}
                            stroke="#475569"
                            strokeWidth="1.2"
                          />
                        ) : null}
                        {showLabel ? (
                          <text
                            x={item.x + 4}
                            y={item.y + 11}
                            fill={resolveTextColor(item.status)}
                            fontSize="10"
                            fontWeight="600"
                            textLength={Math.max(0, item.width - 8)}
                            lengthAdjust="spacingAndGlyphs"
                          >
                            {label}
                          </text>
                        ) : null}
                      </g>
                    )
                  })}
                </svg>

                {laneItems.map((item) => {
                  const meta = labelsById[item.aplicareId] as DetailMeta | undefined
                  const label = meta
                    ? `${meta.produs} · ${meta.data}`
                    : `Aplicare ${item.aplicareId}`

                  return (
                    <button
                      key={`${item.aplicareId}-hitbox`}
                      type="button"
                      title={label}
                      aria-label={label}
                      data-testid="gantt-pill"
                      className={`absolute rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D7A5F]/35 ${
                        compatibilityMode ? resolveLegacyButtonClass(item.tipCuloare, item.status) : ''
                      } ${compatibilityMode ? 'opacity-0' : ''}`}
                      style={{
                        left: `calc(${(item.x / VIEWBOX_WIDTH) * 100}% + 0px)`,
                        top: `${item.y + 8}px`,
                        width: `${(item.width / VIEWBOX_WIDTH) * 100}%`,
                        height: `${BAR_HEIGHT}px`,
                      }}
                      onClick={() => {
                        if (compatibilityMode) {
                          onSelect?.(item.aplicareId)
                          return
                        }
                        setActiveAplicareId(item.aplicareId)
                      }}
                    >
                      <span className="sr-only">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* --- SECTION: detail sheet --- */}
      <Sheet open={Boolean(activeAplicareId)} onOpenChange={(open) => !open && setActiveAplicareId(null)}>
        <SheetContent side="bottom" className="rounded-t-[24px]">
          <SheetHeader>
            <SheetTitle>{activeMeta?.produs ?? 'Aplicare tratament'}</SheetTitle>
            <SheetDescription>{activeMeta?.data ?? 'Data indisponibilă'}</SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-4 pb-5 sm:px-5">
            <div className="rounded-xl bg-[#F8FAF9] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Produs</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{activeMeta?.produs ?? 'Negăsit'}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#F8FAF9] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Doză</p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{activeMeta?.doza ?? 'Indisponibilă'}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAF9] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Stadiu</p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">
                  {activeMeta?.stadiu ?? activeMeta?.tipInterventie ?? activeMeta?.tip_interventie ?? 'Indisponibil'}
                </p>
              </div>
            </div>

            {activeAplicareId && onSelect ? (
              <button
                type="button"
                className="min-h-11 w-full rounded-xl bg-[#3D7A5F] px-4 text-sm font-semibold text-white transition hover:bg-[#2D5F47]"
                onClick={() => {
                  const targetId = activeAplicareId
                  setActiveAplicareId(null)
                  onSelect(targetId)
                }}
              >
                Deschide aplicarea
              </button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
