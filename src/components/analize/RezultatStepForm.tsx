'use client'

import { useRef, useState } from 'react'
import { FileCheck2, Paperclip, Plus, Trash2 } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  CalendarPanel,
  Notice,
  Segments,
  StepForm,
  StepFormTitle,
  ToggleRow,
  kitText,
  longDayRo,
  parseDecimal,
  useStepForm,
} from '@/components/kit'
import type { AnalizaRow } from '@/lib/analize/model'
import { incarcaFisierAnaliza, salveazaRezultat } from '@/lib/supabase/queries/analize'
import { cn } from '@/lib/utils'

type RandSubstanta = { cheie: string; substanta: string; valoare: string; limita: string }

type Ciorna = {
  status: 'conform' | 'neconform'
  buletinNumar: string
  buletinData: string | null
  buletinPath: string | null
  analizat: string
  substante: RandSubstanta[]
  restNedetectate: boolean
}

const text = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

function ciornaDin(analiza: AnalizaRow, today: string): Ciorna {
  return {
    status: analiza.status === 'neconform' ? 'neconform' : 'conform',
    buletinNumar: analiza.buletin_numar ?? '',
    buletinData: analiza.buletin_data ?? today,
    buletinPath: analiza.buletin_path,
    analizat: analiza.ce_s_a_analizat ?? '',
    substante: analiza.substante.map((s, index) => ({ cheie: s.id ?? `s${index}`, substanta: s.substanta, valoare: text(s.valoare_mg_kg), limita: text(s.lmr_mg_kg) })),
    restNedetectate: analiza.rest_nedetectate ?? true,
  }
}

const numar = (valoare: string): number | null => {
  if (!valoare.trim()) return null
  const n = parseDecimal(valoare)
  return n !== null && Number.isFinite(n) && n >= 0 ? n : null
}

export interface RezultatStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  analiza: AnalizaRow | null
  todayIso: string
  onSaved: (analiza: AnalizaRow) => void
}

/**
 * „Rezultatul”: Conform / Neconform, numărul și data buletinului, buletinul (poză sau PDF), „Ce s-a analizat (din
 * buletin)”, substanțele (opționale, „+ Substanță”) și „Restul substanțelor analizate: nedetectate”.
 * Un singur pas; data buletinului se alege în pas (calendarul ține locul conținutului).
 */
export function RezultatStepForm({ open, onOpenChange, analiza, todayIso, onSaved }: RezultatStepFormProps) {
  const form = useStepForm({ steps: ['rezultat'], open, mode: 'edit', analytics: false })
  const [ciorna, setCiorna] = useState<Ciorna | null>(null)
  const [cheie, setCheie] = useState<string | null>(null)
  if (open && analiza && cheie !== `${form.clientSyncId}:${analiza.id}`) {
    setCheie(`${form.clientSyncId}:${analiza.id}`)
    setCiorna(ciornaDin(analiza, todayIso))
  }
  const [vedere, setVedere] = useState<null | 'data'>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!analiza || !ciorna) return null

  const schimba = <K extends keyof Ciorna>(camp: K, valoare: Ciorna[K]) => {
    setCiorna((prev) => (prev ? { ...prev, [camp]: valoare } : prev))
    setEroare(null)
  }
  const schimbaSubstanta = (cheieRand: string, camp: keyof Omit<RandSubstanta, 'cheie'>, valoare: string) =>
    schimba(
      'substante',
      ciorna.substante.map((s) => (s.cheie === cheieRand ? { ...s, [camp]: valoare } : s)),
    )

  const incarca = async (file: File) => {
    setUploading(true)
    setEroare(null)
    try {
      schimba('buletinPath', await incarcaFisierAnaliza(file, 'buletin'))
    } catch (error) {
      setEroare(error instanceof Error && error.message ? error.message : 'Buletinul nu s-a încărcat.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setEroare(null)
    try {
      const rezultat = await salveazaRezultat(analiza.id, {
        status: ciorna.status,
        buletin_numar: ciorna.buletinNumar,
        buletin_data: ciorna.buletinData,
        buletin_path: ciorna.buletinPath,
        ce_s_a_analizat: ciorna.analizat,
        rest_nedetectate: ciorna.restNedetectate,
        substante: ciorna.substante.map((s) => ({ substanta: s.substanta, valoare_mg_kg: numar(s.valoare), lmr_mg_kg: numar(s.limita) })),
      })
      onSaved(rezultat)
      onOpenChange(false)
    } catch (error) {
      setEroare(error instanceof Error && error.message ? error.message : 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  const content =
    vedere === 'data' ? (
      <div className="space-y-3">
        <StepFormTitle>Data buletinului</StepFormTitle>
        <CalendarPanel
          value={ciorna.buletinData}
          onChange={(iso) => {
            schimba('buletinData', iso)
            setVedere(null)
          }}
          min={analiza.data_prelevare}
          max={todayIso}
          shortcuts={false}
        />
      </div>
    ) : (
      <div className="space-y-4">
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <Segments
          aria-label="Verdictul"
          options={[
            { value: 'conform', label: 'Conform' },
            { value: 'neconform', label: 'Neconform' },
          ]}
          value={ciorna.status}
          onValueChange={(value) => schimba('status', value)}
        />
        {ciorna.status === 'neconform' ? (
          <Notice tone="danger" title="La „Neconform” nu se face raport public">
            Apare o avertizare pe parcelă și în Acasă. Linkul public al acestei analize se oprește.
          </Notice>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <BigInput label="Buletin nr." value={ciorna.buletinNumar} onChange={(event) => schimba('buletinNumar', event.target.value)} placeholder="4415" autoComplete="off" />
          <div className="space-y-1.5">
            <p className={cn('font-semibold text-fg', kitText.secondary)}>Din data</p>
            <Button type="button" variant="neutral" size="touch-lg" className="w-full justify-start" onClick={() => setVedere('data')}>
              {ciorna.buletinData ? longDayRo(ciorna.buletinData).replace(/^\S+,\s*/, '') : 'Alege ziua'}
            </Button>
          </div>
        </div>
        <Button type="button" variant="neutral" size="touch" className="w-full" loading={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? null : ciorna.buletinPath ? <FileCheck2 aria-hidden /> : <Paperclip aria-hidden />}
          {ciorna.buletinPath ? 'Buletinul e încărcat · alege altul' : 'Buletinul (poză sau PDF)'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void incarca(file)
            event.target.value = ''
          }}
        />
        <BigTextarea
          label="Ce s-a analizat (din buletin)"
          value={ciorna.analizat}
          onChange={(event) => schimba('analizat', event.target.value)}
          placeholder="ex. Multireziduu pesticide (520 de substanțe), metale grele: Pb, Cd"
          rows={3}
        />

        <section className="space-y-2" aria-labelledby="substante-titlu">
          <h3 id="substante-titlu" className={cn('font-bold text-fg', kitText.secondary)}>
            Substanțe găsite (opțional)
          </h3>
          {ciorna.substante.map((s, index) => (
            <div key={s.cheie} className="space-y-2 rounded-box border border-border bg-surface p-3">
              <div className="flex items-end gap-2">
                <BigInput
                  wrapperClassName="flex-1"
                  label={`Substanța ${index + 1}`}
                  value={s.substanta}
                  onChange={(event) => schimbaSubstanta(s.cheie, 'substanta', event.target.value)}
                  placeholder="ex. Ciprodinil"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="quiet"
                  size="icon-touch"
                  aria-label={`Scoate substanța ${s.substanta || index + 1}`}
                  onClick={() => schimba('substante', ciorna.substante.filter((rand) => rand.cheie !== s.cheie))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <BigInput label="Găsit (mg/kg)" value={s.valoare} onChange={(event) => schimbaSubstanta(s.cheie, 'valoare', event.target.value)} inputMode="decimal" placeholder="0,08" />
                <BigInput label="Limita (mg/kg)" value={s.limita} onChange={(event) => schimbaSubstanta(s.cheie, 'limita', event.target.value)} inputMode="decimal" placeholder="10" />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className="w-full"
            onClick={() => schimba('substante', [...ciorna.substante, { cheie: `n${Date.now()}`, substanta: '', valoare: '', limita: '' }])}
          >
            <Plus aria-hidden />
            Substanță
          </Button>
        </section>

        <ToggleRow
          title="Restul substanțelor analizate"
          subtitle="nedetectate"
          checked={ciorna.restNedetectate}
          onCheckedChange={(checked) => schimba('restNedetectate', checked)}
        />
      </div>
    )

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      title="Rezultatul"
      description="Verdictul, buletinul și substanțele."
      stepLabel={vedere === 'data' ? 'Ziua' : 'Rezultatul'}
      onBack={() => {
        if (vedere) {
          setVedere(null)
          return true
        }
        return false
      }}
      footer={
        vedere
          ? null
          : {
              primary: {
                label: saving ? 'Se salvează…' : ciorna.status === 'conform' ? 'Salvează și fă raportul' : 'Salvează rezultatul',
                onClick: () => void save(),
                loading: saving,
                disabled: uploading,
              },
            }
      }
    >
      {content}
    </StepForm>
  )
}
