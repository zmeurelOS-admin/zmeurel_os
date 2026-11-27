'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Check, CircleAlert } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { ActeFoaie, TITLU_RAND } from '@/components/acte/ActeFoaie'
import { CONFIRMARE_ATESTAT_DETALIU } from '@/lib/acte/atestat'
import { Button, CheckRow, ListRow, Notice, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import {
  esteCertificat,
  insiruire,
  lipsuriPeRand,
  randAlCampului,
  stareActe,
  type ActeDate,
  type CampActe,
  type RandActe,
} from '@/lib/acte/stare'
import {
  LEGAL_PRIVACY_HREF,
  LEGAL_TERMS_HREF,
  LEGAL_TYPE_LABELS,
  getCertificateExpiryInfo,
  legalDocsFormSchema,
  type FarmerLegalDocsRow,
  type LegalDocsFormValues,
} from '@/lib/legal-docs/shared'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function formularDin(doc: FarmerLegalDocsRow | null): LegalDocsFormValues {
  return {
    full_name: doc?.full_name ?? '',
    legal_type: doc?.legal_type ?? 'certificat_producator',
    certificate_series: doc?.certificate_series ?? '',
    certificate_number: doc?.certificate_number ?? '',
    certificate_expiry: doc?.certificate_expiry ?? '',
    locality: doc?.locality ?? '',
    phone: doc?.phone ?? '',
    certificate_photo_url: doc?.certificate_photo_url ?? '',
    cui: doc?.cui ?? '',
    accepted: Boolean(doc?.legal_accepted_at),
  }
}

/** Ciorna din ecran → datele pentru stare. Forma juridică nesalvată încă nu se numără ca aleasă. */
function acteDinFormular(values: LegalDocsFormValues, formaSalvata: boolean): ActeDate {
  return { ...values, legal_type: formaSalvata ? values.legal_type : null }
}

function dataScurta(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const data = new Date(`${iso}T00:00:00`)
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleDateString('ro-RO', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

function dataLunga(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ro-RO', { dateStyle: 'long' })
}

function Insigna({ ton }: { ton: 'ok' | 'lipsa' | 'poza' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
        ton === 'ok' && 'bg-primary-soft text-primary',
        ton === 'lipsa' && 'bg-warning-bg text-warning-text',
        ton === 'poza' && 'bg-neutral-bg text-neutral-text',
      )}
    >
      {ton === 'ok' ? <Check strokeWidth={2.6} /> : ton === 'lipsa' ? <CircleAlert /> : <Camera />}
    </span>
  )
}

function parti(...valori: Array<string | null | undefined | false>): string {
  return valori.filter((valoare): valoare is string => Boolean(valoare && valoare.trim())).join(' · ')
}

export interface ActeFermeiClientProps {
  initialDocument: FarmerLegalDocsRow | null
  initialSignedPhotoUrl: string | null
}

/**
 * Actele fermei (fostele Documente legale), pe kit: sus starea („Complete” / „Lipsesc N date”), apoi rândurile,
 * fiecare cu foaia lui. Aceleași câmpuri și aceeași validare ca înainte; salvarea trimite tot formularul la `/api/legal-docs`.
 */
export function ActeFermeiClient({ initialDocument, initialSignedPhotoUrl }: ActeFermeiClientProps) {
  const router = useRouter()
  const [saved, setSaved] = useState<FarmerLegalDocsRow | null>(initialDocument)
  const [values, setValues] = useState<LegalDocsFormValues>(() => formularDin(initialDocument))
  const [formaAleasa, setFormaAleasa] = useState<boolean>(Boolean(initialDocument?.legal_type))
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(initialSignedPhotoUrl)
  const [deschis, setDeschis] = useState<RandActe | null>(null)
  const [errors, setErrors] = useState<Partial<Record<CampActe, string>>>({})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [eroareSalvare, setEroareSalvare] = useState<string | null>(null)

  const stare = useMemo(() => stareActe(acteDinFormular(values, formaAleasa)), [values, formaAleasa])
  const certificat = formaAleasa && esteCertificat(values.legal_type)
  const dirty = JSON.stringify(values) !== JSON.stringify(formularDin(saved))
  const expirare = certificat ? getCertificateExpiryInfo(values.certificate_expiry?.trim() || null) : null

  const schimba = <K extends keyof LegalDocsFormValues>(field: K, value: LegalDocsFormValues[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }))
    if (field === 'legal_type') setFormaAleasa(true)
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setEroareSalvare(null)
  }

  const incarca = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/legal-docs/upload', { method: 'POST', body: formData })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { path: string; signedUrl: string | null }; error?: { message?: string } }
        | null
      if (!res.ok || !json?.ok || !json.data?.path) {
        throw new Error(json?.error?.message ?? 'Nu am putut încărca documentul.')
      }
      schimba('certificate_photo_url', json.data.path)
      setPhotoPreviewUrl(json.data.signedUrl ?? null)
      toast.success('Poza s-a încărcat. Apasă „Salvează actele”.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut încărca documentul.')
    } finally {
      setUploading(false)
    }
  }

  const salveaza = async () => {
    if (saving) return
    setEroareSalvare(null)
    const parsed = legalDocsFormSchema.safeParse(values)
    if (!formaAleasa || !parsed.success) {
      const next: Partial<Record<CampActe, string>> = {}
      // Fără act salvat, forma juridică nu are valoare aleasă pe ecran: se alege înainte de salvare.
      if (!formaAleasa) next.legal_type = 'Alege forma juridică.'
      for (const issue of parsed.success ? [] : parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in next)) next[field as CampActe] = issue.message
      }
      setErrors(next)
      setEroareSalvare(Object.values(next)[0] ?? 'Completează câmpurile obligatorii.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/legal-docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { document: FarmerLegalDocsRow }; error?: { message?: string } }
        | null
      if (!res.ok || !json?.ok || !json.data?.document) {
        throw new Error(json?.error?.message ?? 'Nu am putut salva actele.')
      }
      setSaved(json.data.document)
      setValues(formularDin(json.data.document))
      setFormaAleasa(true)
      setErrors({})
      toast.success('Actele fermei s-au salvat.')
      // Bannerul și rândul din Setări citesc starea salvată.
      router.refresh()
    } catch (error) {
      setEroareSalvare(error instanceof Error ? error.message : 'Nu am putut salva actele.')
    } finally {
      setSaving(false)
    }
  }

  const areEroare = (rand: RandActe) => Object.entries(errors).some(([camp, mesaj]) => mesaj && randAlCampului(camp as CampActe) === rand)

  const rand = (cheie: RandActe, detaliuComplet: string) => {
    const lipsuri = lipsuriPeRand(stare.lipsuri, cheie)
    const lipsa = lipsuri.length > 0 || areEroare(cheie)
    const detaliu = lipsuri.length > 0
      ? parti(`lipsește ${insiruire(lipsuri.map((item) => item.eticheta))}`, detaliuComplet)
      : detaliuComplet
    const titlu = cheie === 'poza' && formaAleasa && !esteCertificat(values.legal_type) ? 'Poza documentului' : TITLU_RAND[cheie]
    return (
      <ListRow
        leading={<Insigna ton={lipsa ? 'lipsa' : cheie === 'poza' ? 'poza' : 'ok'} />}
        title={titlu}
        detail={detaliu || '—'}
        onClick={() => setDeschis(cheie)}
        aria-label={`${titlu}: ${detaliu || 'necompletat'}`}
      />
    )
  }

  const pozaIncarcata = values.certificate_photo_url
    ? saved?.certificate_photo_url === values.certificate_photo_url && saved?.updated_at
      ? `încărcată pe ${dataScurta(saved.updated_at.slice(0, 10))}`
      : 'încărcată, nesalvată încă'
    : ''

  const salveazaButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={saving} disabled={uploading} onClick={() => void salveaza()}>
      {saving ? 'Se salvează…' : 'Salvează actele'}
    </Button>
  )

  return (
    <AppShell
      header={<ScreenHeader title="Actele fermei" backHref="/settings/ferma" />}
      bottomBarFixed
      bottomBar={
        dirty ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{salveazaButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3 pb-28">
        <Notice tone={stare.complete ? 'success' : 'warning'} title={stare.titlu}>
          {stare.complete ? 'Pot fi folosite la magazin și la asociație.' : stare.detaliu}
        </Notice>

        {expirare?.isExpired && expirare.expiryDate ? (
          <Notice tone="danger" title="Atestatul a expirat">
            A fost valabil până la {dataLunga(expirare.expiryDate)}. Reînnoiește-l și schimbă data aici ca să poți vinde în continuare.
          </Notice>
        ) : expirare?.isExpiringSoon && expirare.expiryDate ? (
          <Notice tone="warning" title="Atestatul expiră curând">
            Valabil până la {dataLunga(expirare.expiryDate)}. Reînnoiește-l și schimbă data aici.
          </Notice>
        ) : null}

        {eroareSalvare ? (
          <Notice tone="danger" title="Actele nu s-au salvat">
            {eroareSalvare}
          </Notice>
        ) : null}

        {rand('ferma', parti(formaAleasa && LEGAL_TYPE_LABELS[values.legal_type], !certificat && values.cui && `CUI ${values.cui.trim()}`, values.locality))}
        {certificat
          ? rand(
              'certificat',
              parti(
                values.certificate_number && `Nr. ${values.certificate_number.trim()}`,
                values.certificate_series && `seria ${values.certificate_series.trim()}`,
                dataScurta(values.certificate_expiry) && `valabil până la ${dataScurta(values.certificate_expiry)}`,
              ),
            )
          : null}
        {rand('contact', parti(values.full_name, values.phone.trim() && formatPhoneDisplay(values.phone)))}
        {rand('poza', pozaIncarcata)}

        <div className="space-y-2 pt-1">
          <CheckRow
            title="Confirm că datele sunt corecte"
            detail={CONFIRMARE_ATESTAT_DETALIU}
            checked={values.accepted}
            onCheckedChange={(checked) => schimba('accepted', checked)}
          />
          <p className={cn('px-1 text-fg-muted', kitText.helper)}>
            Bifând, accepți{' '}
            <Link href={LEGAL_TERMS_HREF} className="font-semibold text-primary underline underline-offset-2">
              Termenii și Condițiile
            </Link>{' '}
            și{' '}
            <Link href={LEGAL_PRIVACY_HREF} className="font-semibold text-primary underline underline-offset-2">
              Politica de Confidențialitate
            </Link>
            .
          </p>
          {errors.accepted ? (
            <p className={cn('px-1 font-semibold text-danger-text', kitText.helper)} role="alert">
              {errors.accepted}
            </p>
          ) : null}
        </div>

        <p className={cn('px-1 text-fg-muted', kitText.helper)}>Folosite la magazin și la asociație, când revin.</p>

        {/* Pe desktop bara de jos nu există: butonul stă în pagină. */}
        {dirty ? <div className="hidden md:block">{salveazaButton}</div> : null}
      </ScreenBody>

      <ActeFoaie
        rand={deschis}
        onClose={() => setDeschis(null)}
        values={values}
        formaAleasa={formaAleasa}
        errors={errors}
        onChange={schimba}
        uploading={uploading}
        onUpload={(file) => void incarca(file)}
        photoPreviewUrl={photoPreviewUrl}
      />
    </AppShell>
  )
}
