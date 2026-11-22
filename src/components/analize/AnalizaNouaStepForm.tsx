'use client'

import { useRef, useState } from 'react'
import { Camera, Check, FileCheck2 } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  Button,
  CalendarPanel,
  FilterPills,
  Notice,
  Segments,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  kitText,
  longDayRo,
  useStepForm,
} from '@/components/kit'
import type { AnalizaRow, PrelevatDe } from '@/lib/analize/model'
import { ETICHETA_PRELEVAT } from '@/lib/analize/model'
import { actualizeazaPrelevarea, creeazaAnaliza, incarcaFisierAnaliza, type PrelevareInput } from '@/lib/supabase/queries/analize'
import { cn } from '@/lib/utils'

export interface ParcelaAnaliza {
  id: string
  nume: string
}

export interface AnalizaNouaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Doar parcelele de vânzare (fără „Personal”). */
  parcele: ParcelaAnaliza[]
  laboratoare: string[]
  todayIso: string
  /** „Editează prelevarea”: analiza existentă. Fără ea, „Analiză nouă”. */
  analiza?: AnalizaRow | null
  /** Deep link-ul din memento: parcelele deja alese. */
  parceleInitiale?: string[]
  onSaved: (analiza: AnalizaRow) => void
}

type Ciorna = {
  parcele: string[]
  dataPrelevare: string | null
  pvNumar: string
  pvPoza: string | null
  prelevatDe: PrelevatDe | null
  laborator: string
  predareAceeasiZi: boolean
  dataPredare: string | null
  nota: string
}

function ciornaGoala(today: string, parcele: string[]): Ciorna {
  return { parcele, dataPrelevare: today, pvNumar: '', pvPoza: null, prelevatDe: null, laborator: '', predareAceeasiZi: true, dataPredare: null, nota: '' }
}

function ciornaDin(analiza: AnalizaRow): Ciorna {
  return {
    parcele: analiza.parcele,
    dataPrelevare: analiza.data_prelevare,
    pvNumar: analiza.pv_numar ?? '',
    pvPoza: analiza.pv_poza_path,
    prelevatDe: analiza.prelevat_de,
    laborator: analiza.laborator ?? '',
    predareAceeasiZi: !analiza.data_predare || analiza.data_predare === analiza.data_prelevare,
    dataPredare: analiza.data_predare,
    nota: analiza.nota ?? '',
  }
}

const PASI = ['parcele', 'prelevare'] as const

/**
 * „Analiză nouă” (2 pași) și „Editează prelevarea”: 1. parcelele și data prelevării; 2. PV-ul (număr + poză),
 * cine a prelevat, laboratorul (cu propuneri din analizele anterioare), data predării, nota.
 * La creare trimite `client_sync_id` (cheia formularului): „Salvează” apăsat din nou nu dublează.
 */
export function AnalizaNouaStepForm({ open, onOpenChange, parcele, laboratoare, todayIso, analiza, parceleInitiale, onSaved }: AnalizaNouaStepFormProps) {
  const editare = Boolean(analiza)
  const form = useStepForm({ steps: PASI, open, mode: editare ? 'edit' : 'create', analytics: editare ? false : { moduleName: 'analize' } })
  const permise = new Set(parcele.map((parcela) => parcela.id))
  const initiale = (parceleInitiale ?? []).filter((id) => permise.has(id))

  const [ciorna, setCiorna] = useState<Ciorna>(() => (analiza ? ciornaDin(analiza) : ciornaGoala(todayIso, initiale)))
  const [cheie, setCheie] = useState<string | null>(null)
  // La fiecare deschidere (cheie nouă), câmpurile pornesc de la zero sau de la analiza editată. Dă același rezultat
  // oricât de des rulează pentru aceeași deschidere.
  if (open && cheie !== form.clientSyncId) {
    setCheie(form.clientSyncId)
    setCiorna(analiza ? ciornaDin(analiza) : ciornaGoala(todayIso, initiale))
  }

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)
  const [vedere, setVedere] = useState<null | 'renunta'>(null)
  const [salvata, setSalvata] = useState<AnalizaRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const schimba = <K extends keyof Ciorna>(camp: K, valoare: Ciorna[K]) => {
    setCiorna((prev) => ({ ...prev, [camp]: valoare }))
    setEroare(null)
  }

  const close = () => onOpenChange(false)
  const dirty = editare ? false : ciorna.pvNumar.trim() !== '' || ciorna.laborator.trim() !== '' || ciorna.nota.trim() !== '' || Boolean(ciorna.pvPoza)
  const closeGuard = () => {
    if (form.done || salvata) return false
    if (saving) return true
    if (!dirty) return false
    setVedere('renunta')
    return true
  }

  const incarcaPoza = async (file: File) => {
    setUploading(true)
    setEroare(null)
    try {
      schimba('pvPoza', await incarcaFisierAnaliza(file, 'pv'))
    } catch (error) {
      setEroare(error instanceof Error && error.message ? error.message : 'Poza nu s-a încărcat.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (saving || !ciorna.dataPrelevare || ciorna.parcele.length === 0) return
    setSaving(true)
    setEroare(null)
    const input: PrelevareInput = {
      parcelaIds: ciorna.parcele,
      data_prelevare: ciorna.dataPrelevare,
      pv_numar: ciorna.pvNumar,
      pv_poza_path: ciorna.pvPoza,
      prelevat_de: ciorna.prelevatDe,
      laborator: ciorna.laborator,
      data_predare: ciorna.predareAceeasiZi ? ciorna.dataPrelevare : ciorna.dataPredare,
      nota: ciorna.nota,
    }
    try {
      const rezultat = analiza ? await actualizeazaPrelevarea(analiza.id, input) : await creeazaAnaliza({ ...input, clientSyncId: form.clientSyncId })
      setSalvata(rezultat)
      form.markSuccess({ parcele: ciorna.parcele.length })
      onSaved(rezultat)
      if (analiza) close()
    } catch (error) {
      setEroare(error instanceof Error && error.message ? error.message : 'Nu s-a salvat. Încearcă din nou.')
      form.markFailed()
    } finally {
      setSaving(false)
    }
  }

  const toate = parcele.map((parcela) => parcela.id)
  const toateAlese = toate.length > 0 && toate.every((id) => ciorna.parcele.includes(id))

  let content: React.ReactNode
  let stepLabel: string | undefined
  if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la analiză?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Ce ai scris nu a fost salvat.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (form.stepKey === 'parcele') {
    content = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StepFormTitle>Din ce parcele?</StepFormTitle>
          <p className={cn('text-fg-muted', kitText.secondary)}>Poți alege mai multe: o probă comună sau toate parcelele din același PV.</p>
        </div>
        {parcele.length === 0 ? (
          <Notice tone="warning" title="Nicio parcelă de vânzare">
            Analizele se fac pe parcelele de vânzare. Parcelele „Personal” nu apar aici.
          </Notice>
        ) : (
          <>
            <FilterPills
              multiple
              wrap
              aria-label="Parcelele analizei"
              options={parcele.map((parcela) => ({
                value: parcela.id,
                label: parcela.nume,
                icon: ciorna.parcele.includes(parcela.id) ? <Check aria-hidden /> : undefined,
              }))}
              value={ciorna.parcele}
              onValueChange={(value) => schimba('parcele', value)}
            />
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => schimba('parcele', toateAlese ? [] : toate)}>
              {toateAlese ? 'Niciuna' : 'Toate parcelele de vânzare'}
            </Button>
          </>
        )}
        <div className="space-y-2">
          <p className={cn('font-semibold text-fg', kitText.secondary)}>
            Data prelevării{ciorna.dataPrelevare ? `: ${longDayRo(ciorna.dataPrelevare)}` : ''}
          </p>
          <CalendarPanel value={ciorna.dataPrelevare} onChange={(iso) => schimba('dataPrelevare', iso)} max={todayIso} shortcuts={false} />
        </div>
      </div>
    )
  } else {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Prelevarea</StepFormTitle>
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5">
          <BigInput
            label="Procesul-verbal de prelevare"
            value={ciorna.pvNumar}
            onChange={(event) => schimba('pvNumar', event.target.value)}
            placeholder="Nr. 1287"
            autoComplete="off"
            inputMode="text"
          />
          <Button type="button" variant="neutral" size="touch-lg" loading={uploading} onClick={() => fileRef.current?.click()} aria-label={ciorna.pvPoza ? 'Poza PV încărcată; alege alta' : 'Încarcă poza PV'}>
            {uploading ? null : ciorna.pvPoza ? <FileCheck2 aria-hidden /> : <Camera aria-hidden />}
            {ciorna.pvPoza ? 'Poza PV ✓' : 'Poza PV'}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void incarcaPoza(file)
            event.target.value = ''
          }}
        />
        <p className={cn('-mt-2 text-fg-muted', kitText.helper)}>Poza PV-ului stă privat, ca bonurile. Dacă n-o ai acum, o pui mai târziu.</p>

        <div className="space-y-2">
          <p id="analiza-cine" className={cn('font-semibold text-fg', kitText.secondary)}>
            Cine a prelevat?
          </p>
          <FilterPills
            aria-label="Cine a prelevat"
            options={(Object.keys(ETICHETA_PRELEVAT) as PrelevatDe[]).map((cheie) => ({ value: cheie, label: ETICHETA_PRELEVAT[cheie] }))}
            value={ciorna.prelevatDe ?? ('' as PrelevatDe)}
            onValueChange={(value) => schimba('prelevatDe', value)}
          />
        </div>

        <div className="space-y-2">
          <BigInput
            label="Predate la"
            value={ciorna.laborator}
            onChange={(event) => schimba('laborator', event.target.value)}
            placeholder="ex. LSVSA Suceava"
            autoComplete="off"
            autoCapitalize="words"
            hint={laboratoare.length ? undefined : 'Ține minte laboratoarele folosite.'}
          />
          {laboratoare.length > 0 ? (
            <FilterPills
              wrap
              aria-label="Laboratoarele folosite"
              options={laboratoare.slice(0, 6).map((nume) => ({ value: nume, label: nume }))}
              value={ciorna.laborator.trim()}
              onValueChange={(value) => schimba('laborator', value)}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <p className={cn('font-semibold text-fg', kitText.secondary)}>Data predării</p>
          <Segments
            aria-label="Data predării"
            options={[
              { value: 'aceeasi', label: 'Aceeași zi' },
              { value: 'alta', label: 'Altă zi' },
            ]}
            value={ciorna.predareAceeasiZi ? 'aceeasi' : 'alta'}
            onValueChange={(value) => {
              schimba('predareAceeasiZi', value === 'aceeasi')
              if (value === 'alta' && !ciorna.dataPredare) schimba('dataPredare', ciorna.dataPrelevare)
            }}
          />
          {ciorna.predareAceeasiZi ? (
            ciorna.dataPrelevare ? <p className={cn('text-fg-muted', kitText.secondary)}>{longDayRo(ciorna.dataPrelevare)}</p> : null
          ) : (
            <CalendarPanel value={ciorna.dataPredare} onChange={(iso) => schimba('dataPredare', iso)} min={ciorna.dataPrelevare ?? undefined} max={todayIso} shortcuts={false} />
          )}
        </div>

        <BigTextarea label="Notă (opțional)" value={ciorna.nota} onChange={(event) => schimba('nota', event.target.value)} placeholder="ex. 1 kg din fiecare parcelă" rows={2} />
      </div>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editare ? 'Editează prelevarea' : 'Analiză nouă'}
      description="Parcelele, data prelevării, procesul-verbal și laboratorul."
      stepLabel={stepLabel}
      onBack={() => {
        if (vedere) {
          setVedere(null)
          return true
        }
        return false
      }}
      footer={
        vedere !== null
          ? null
          : form.stepKey === 'parcele'
            ? { primary: { label: 'Continuă', onClick: () => form.next(), disabled: ciorna.parcele.length === 0 || !ciorna.dataPrelevare } }
            : {
                primary: {
                  label: saving ? 'Se salvează…' : editare ? 'Salvează prelevarea' : 'Salvează · la laborator',
                  onClick: () => void save(),
                  loading: saving,
                  disabled: uploading || (!ciorna.predareAceeasiZi && !ciorna.dataPredare),
                },
              }
      }
      success={
        salvata && !editare ? (
          <SuccessScreen
            title="Analiza e la laborator"
            description="Când vine buletinul, deschide analiza și treci rezultatul. Prelevarea oprește mementoul pentru aceste parcele."
            primaryAction={{ label: 'Gata', onClick: close }}
          />
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
