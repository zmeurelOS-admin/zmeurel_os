'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  BigInput,
  Button,
  Notice,
  ProgressBar,
  Segments,
  Tile,
  TileGroup,
  ToggleRow,
  kitText,
  parseDecimal,
} from '@/components/kit'
import { deleteAllClients, type DeleteAllClientsResult } from '@/lib/clienti/import'
import {
  farmSettingsQueryKey,
  SAVE_ERROR_MESSAGE,
  saveFarmSettings,
  useFarmSettings,
  type AcasaExtrasezonAfiseaza,
  type AcasaPerioadaMod,
  type PerioadaPret,
} from '@/lib/farm-settings'
import { formatLeiKg, formatNumber } from '@/lib/format-ro'
import { PERIOADA_PRET_LABEL, PERIOADE_PRET, PRET_SE_INCARCA, resolvePretStandard } from '@/lib/pret-standard'
import { queryKeys } from '@/lib/query-keys'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const SECTION_CLASS = 'space-y-4'

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className={cn('text-fg-muted', kitText.secondary)}>{children}</p>
}

const WAITING_FOR_DB = 'Se activează după actualizarea bazei de date.'

/**
 * Setările fermei pe kit, câte una pe subpagină:
 * Setări › Prețul standard (/settings/pret-standard), Setări › Ce arată Acasă (/settings/acasa)
 * și ștergerea tuturor clienților (Setări › Contul tău › Ireversibil).
 * Operatorii nu ajung aici: /settings e blocat pentru ei în proxy.
 */

// ─── Preț standard ─────────────────────────────────────────────────────────────

export function PretStandardSection() {
  const queryClient = useQueryClient()
  const { settings, isLoading } = useFarmSettings()
  const standard = resolvePretStandard(settings)

  const [prices, setPrices] = useState<Record<PerioadaPret, string> | null>(null)
  const [perioada, setPerioada] = useState<PerioadaPret | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shownPrices: Record<PerioadaPret, string> = prices ?? {
    inceput: formatNumber(standard.inceput),
    varf: formatNumber(standard.varf),
    mediu: formatNumber(standard.mediu),
  }
  const shownPerioada = perioada ?? standard.perioada
  const parsed = {
    inceput: parseDecimal(shownPrices.inceput),
    varf: parseDecimal(shownPrices.varf),
    mediu: parseDecimal(shownPrices.mediu),
  }
  const valid = PERIOADE_PRET.every((key) => parsed[key] !== null && (parsed[key] ?? 0) > 0)
  const dirty = prices !== null || perioada !== null
  const activeNow = valid ? (parsed[shownPerioada] ?? standard.activ) : standard.activ

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      await saveFarmSettings({
        pretInceput: parsed.inceput,
        pretVarf: parsed.varf,
        pretMediu: parsed.mediu,
        pretPerioada: shownPerioada,
      })
      await queryClient.invalidateQueries({ queryKey: farmSettingsQueryKey })
      setPrices(null)
      setPerioada(null)
      toast.success('Prețul standard a fost salvat.')
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : SAVE_ERROR_MESSAGE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="pret-standard" className={SECTION_CLASS}>
      <SectionHint>
        Pentru persoane fizice. Patiseriile și magazinele au prețul negociat din fișa lor. Comenzile deja făcute își păstrează prețul.
      </SectionHint>

      <div className="rounded-box bg-primary-soft p-4">
        <p className={cn('font-medium text-fg-muted', kitText.secondary)}>Comenzile noi primesc acum</p>
        <p className={cn('font-extrabold text-fg', kitText.screen)}>{isLoading ? PRET_SE_INCARCA : formatLeiKg(activeNow)}</p>
      </div>

      {isLoading ? null : !standard.configurabil ? (
        <>
          {<Notice tone="info" title={WAITING_FOR_DB}>Până atunci, prețul standard e cel de până acum: {formatLeiKg(standard.activ)}.</Notice>}
          <ul className="space-y-2">
            {PERIOADE_PRET.map((key) => (
              <li key={key} className="flex min-h-touch items-center justify-between gap-3 rounded-box border border-border px-4 py-2">
                <span className={cn('font-semibold text-fg', kitText.base)}>{PERIOADA_PRET_LABEL[key]}</span>
                <span className={cn('text-fg-muted', kitText.base)}>{formatLeiKg(standard[key])}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {error ? <Notice tone="danger" title={error} /> : null}
          <div className="space-y-2">
            <p id="pret-perioada" className={cn('font-semibold text-fg', kitText.secondary)}>
              Perioada activă
            </p>
            <TileGroup
              type="single"
              columns={3}
              value={shownPerioada}
              onValueChange={(value) => setPerioada((value as PerioadaPret | null) ?? shownPerioada)}
              aria-labelledby="pret-perioada"
            >
              {PERIOADE_PRET.map((key) => (
                <Tile
                  key={key}
                  size="sm"
                  value={key}
                  title={key === 'inceput' ? 'Început' : key === 'varf' ? 'Vârf' : 'Mediu'}
                  subtitle={parsed[key] ? formatLeiKg(parsed[key] ?? 0) : undefined}
                  aria-label={`${PERIOADA_PRET_LABEL[key]}${parsed[key] ? `, ${formatLeiKg(parsed[key] ?? 0)}` : ''}`}
                />
              ))}
            </TileGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {PERIOADE_PRET.map((key) => (
              <BigInput
                key={key}
                label={`${PERIOADA_PRET_LABEL[key]} (lei/kg)`}
                value={shownPrices[key]}
                onChange={(event) => setPrices({ ...shownPrices, [key]: event.target.value })}
                inputMode="decimal"
                autoComplete="off"
                error={parsed[key] === null || (parsed[key] ?? 0) <= 0 ? 'Scrie prețul cu cifre.' : undefined}
              />
            ))}
          </div>

          <Button type="button" variant="primary" size="touch-lg" className="w-full" disabled={!dirty || !valid} loading={saving} onClick={() => void save()}>
            Salvează prețul standard
          </Button>
        </>
      )}
    </section>
  )
}

// ─── Ce arată Acasă ────────────────────────────────────────────────────────────

const MONTHS_RO = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
] as const

function monthDayLabel(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number)
  return `${day} ${MONTHS_RO[(month || 1) - 1] ?? ''}`.trim()
}

function daysInMonth(month: number): number {
  // An nebisect: 29 februarie nu e o zi bună pentru o întrebare care revine în fiecare an.
  return new Date(2025, month, 0).getDate()
}

export function AcasaSection() {
  const queryClient = useQueryClient()
  const { settings, isLoading } = useFarmSettings()

  const [mod, setMod] = useState<AcasaPerioadaMod | null>(null)
  const [zi, setZi] = useState<string | null>(null)
  const [luna, setLuna] = useState<string | null>(null)
  const [afiseaza, setAfiseaza] = useState<AcasaExtrasezonAfiseaza | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [savedLuna, savedZi] = settings.extrasezonIntrebareDin.split('-')
  const shownMod = mod ?? settings.acasaPerioadaMod
  const shownZi = zi ?? String(Number(savedZi))
  const shownLuna = luna ?? String(Number(savedLuna))
  const shownAfiseaza = afiseaza ?? settings.acasaExtrasezonAfiseaza

  const lunaNumar = Number(shownLuna)
  const ziNumar = Number(shownZi)
  const lunaValid = Number.isInteger(lunaNumar) && lunaNumar >= 1 && lunaNumar <= 12
  const ziValid = lunaValid && Number.isInteger(ziNumar) && ziNumar >= 1 && ziNumar <= daysInMonth(lunaNumar)
  const monthDay = ziValid ? `${String(lunaNumar).padStart(2, '0')}-${String(ziNumar).padStart(2, '0')}` : null
  const dirty = mod !== null || zi !== null || luna !== null || afiseaza !== null
  const disabled = !settings.acasaConfigurabil

  const save = async () => {
    if (!monthDay || saving || disabled) return
    setSaving(true)
    setError(null)
    try {
      await saveFarmSettings({
        acasaPerioadaMod: shownMod,
        extrasezonIntrebareDin: monthDay,
        acasaExtrasezonAfiseaza: shownAfiseaza,
      })
      await queryClient.invalidateQueries({ queryKey: farmSettingsQueryKey })
      setMod(null)
      setZi(null)
      setLuna(null)
      setAfiseaza(null)
      toast.success('Setările pentru Acasă au fost salvate.')
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : SAVE_ERROR_MESSAGE)
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: keyof AcasaExtrasezonAfiseaza) => (value: boolean) => setAfiseaza({ ...shownAfiseaza, [key]: value })

  return (
    <section id="acasa" className={SECTION_CLASS}>
      <SectionHint>Pe telefon, Acasă arată altceva în sezon decât în extrasezon.</SectionHint>

      {disabled && !isLoading ? (
        <Notice tone="info" title={WAITING_FOR_DB}>
          Până atunci: sezon dacă ai recoltat anul acesta și e înainte de 1 noiembrie, altfel extrasezon.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger" title={error} /> : null}

      <div className="space-y-2">
        <p className={cn('font-semibold text-fg', kitText.secondary)}>Perioada</p>
        <Segments<AcasaPerioadaMod>
          aria-label="Perioada afișată pe Acasă"
          value={shownMod}
          onValueChange={(value) => {
            if (!disabled) setMod(value)
          }}
          options={[
            { value: 'auto', label: 'Automat' },
            { value: 'sezon', label: 'Sezon' },
            { value: 'extrasezon', label: 'Extrasezon' },
          ]}
        />
        <p className={cn('text-fg-muted', kitText.helper)}>
          Automat: sezonul începe la prima recoltare din an; extrasezonul doar după ce confirmi.
        </p>
      </div>

      <div className="space-y-2">
        <p className={cn('font-semibold text-fg', kitText.secondary)}>Întrebarea „Începem extrasezonul?” apare din</p>
        <div className="grid grid-cols-2 gap-3">
          <BigInput
            label="Ziua"
            value={shownZi}
            onChange={(event) => setZi(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            error={!ziValid && lunaValid ? 'Zi nevalidă.' : undefined}
          />
          <BigInput
            label="Luna (1–12)"
            value={shownLuna}
            onChange={(event) => setLuna(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            error={!lunaValid ? 'Lună nevalidă.' : undefined}
          />
        </div>
        <p className={cn('text-fg-muted', kitText.helper)}>
          {monthDay ? `Din ${monthDayLabel(monthDay)}. ` : ''}Dacă amâni, revine după 7 zile.
        </p>
      </div>

      <div className="space-y-2">
        <p className={cn('font-semibold text-fg', kitText.secondary)}>În extrasezon, Acasă arată</p>
        <ToggleRow title="Comenzile de butași" checked={shownAfiseaza.comenzi_butasi} onCheckedChange={toggle('comenzi_butasi')} disabled={disabled} />
        <ToggleRow title="Restul de încasat" checked={shownAfiseaza.rest_incasat} onCheckedChange={toggle('rest_incasat')} disabled={disabled} />
        <ToggleRow title="Lucrările planificate" checked={shownAfiseaza.lucrari} onCheckedChange={toggle('lucrari')} disabled={disabled} />
        <ToggleRow title="Avertizarea de îngheț" checked={shownAfiseaza.inghet} onCheckedChange={toggle('inghet')} disabled={disabled} />
      </div>

      <Button
        type="button"
        variant="primary"
        size="touch-lg"
        className="w-full"
        disabled={disabled || !dirty || !monthDay}
        loading={saving}
        onClick={() => void save()}
      >
        Salvează
      </Button>
    </section>
  )
}

// ─── Contul tău › Ireversibil › Șterge toți clienții ───────────────────────────

const CONFIRM_WORD = 'ȘTERGE'

function normalizeConfirm(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('ro-RO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Câți clienți are ferma (pentru textul rândului din „Ireversibil”). */
export function useClientiCount(): { count: number; isLoading: boolean } {
  const { data: clienti = [], isLoading } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  return { count: clienti.length, isLoading }
}

/**
 * Confirmarea pentru ștergerea tuturor clienților, în același ecran (mutată din pagina Clienți).
 * Cere cuvântul ȘTERGE. Clienții cu comenzi sau vânzări rămân.
 */
export function StergeClientiPanel({ onCancel }: { onCancel: () => void }) {
  const queryClient = useQueryClient()
  const { data: clienti = [], isLoading } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<DeleteAllClientsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const confirmed = normalizeConfirm(typed) === normalizeConfirm(CONFIRM_WORD)
  const running = progress !== null

  const run = async () => {
    if (!confirmed || running || clienti.length === 0) return
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: clienti.length })
    try {
      const outcome = await deleteAllClients(clienti, setProgress)
      setResult(outcome)
      setTyped('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Ștergerea s-a oprit.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-3 rounded-box border border-danger-border bg-danger-bg p-3.5" role="group" aria-labelledby="confirm-clienti-titlu">
      <p id="confirm-clienti-titlu" className={cn('font-extrabold text-danger-text', kitText.base)}>
        Ștergi toți clienții?
      </p>
      <p className={cn('text-fg-muted', kitText.secondary)}>
        {isLoading
          ? 'Număr clienții…'
          : clienti.length === 0
            ? 'Nu ai niciun client.'
            : `Ai ${clienti.length} ${clienti.length === 1 ? 'client' : 'clienți'}. Cei cu comenzi sau vânzări nu se șterg: istoricul lor rămâne. Nu se poate anula.`}
      </p>

      {error ? <Notice tone="danger" title={error} /> : null}
      {result ? (
        <Notice tone={result.failedNames.length > 0 ? 'warning' : 'success'} title={`${result.deleted} clienți șterși`}>
          {result.failedNames.length > 0
            ? `${result.failedNames.length} au rămas, fiindcă au comenzi sau vânzări.`
            : 'Lista de clienți e goală.'}
        </Notice>
      ) : null}

      {progress ? (
        <ProgressBar
          label="Șterg clienții"
          valueLabel={`${progress.done} din ${progress.total}`}
          value={progress.done}
          max={Math.max(progress.total, 1)}
          tone="danger"
        />
      ) : null}

      {clienti.length > 0 ? (
        <BigInput
          label={`Scrie ${CONFIRM_WORD} ca să confirmi`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          disabled={running}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="neutral" size="touch" onClick={onCancel} disabled={running}>
          {result ? 'Închide' : 'Renunț'}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="touch"
          disabled={!confirmed || clienti.length === 0}
          loading={running}
          onClick={() => void run()}
        >
          {running ? 'Se șterg…' : 'Șterge'}
        </Button>
      </div>
    </div>
  )
}
