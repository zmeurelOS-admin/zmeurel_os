'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Download, KeyRound, Phone } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { BigInput, Button, Notice, kitText } from '@/components/kit'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { StergeClientiPanel, useClientiCount } from '@/components/setari/SetariFerma'
import { ActionRow, InfoRow, PanelCard, RowGroup, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'
import { clearDemoSeedAttempted, disableDemoMode, disableFarmSetupMode } from '@/lib/demo/onboarding-storage'
import { deleteAccountAndFarm, resetFarmData } from '@/lib/setari/destructive-actions'
import { CSV_MODULES, exportAllDataJson, exportModuleCsv, type CsvModule } from '@/lib/setari/export-data'
import { cheieAscundePrimiiPasi } from '@/lib/dashboard/primii-pasi'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { hapticConfirm } from '@/lib/utils/haptic'
import { isValidRomanianPhone, normalizePhone } from '@/lib/utils/phone'

type Open = 'parola' | 'telefon' | null
type Confirm = 'farm' | 'account' | 'clients' | null

const ACCOUNT_CONFIRM_TEXT = 'ȘTERGE CONTUL'

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem =
    !next && !repeat ? null : next.length < 8 ? 'Parola are cel puțin 8 caractere.' : next !== repeat ? 'Parolele nu sunt la fel.' : null

  const save = async () => {
    if (problem || !next) return
    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password: next })
      if (updateError) throw updateError
      toast.success('Parola a fost schimbată.')
      onDone()
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'Nu am putut schimba parola.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-border p-3.5">
      {error ? <Notice tone="danger" title={error} /> : null}
      <BigInput label="Parola nouă" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
      <BigInput
        label="Scrie-o încă o dată"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(event) => setRepeat(event.target.value)}
        error={problem ?? undefined}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="neutral" size="touch" onClick={onDone}>
          Renunț
        </Button>
        <Button type="button" variant="primary" size="touch" disabled={Boolean(problem) || !next} loading={saving} onClick={() => void save()}>
          Salvează
        </Button>
      </div>
    </div>
  )
}

function PhoneForm({ initial, onSaved, onCancel }: { initial: string; onSaved: (phone: string) => void; onCancel: () => void }) {
  const [phone, setPhone] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = phone.trim()
  const invalid = !trimmed || !isValidRomanianPhone(trimmed)

  const save = async () => {
    if (invalid) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? 'Numărul nu s-a salvat.')
      }
      toast.success('Telefonul contului a fost salvat.')
      onSaved(normalizePhone(trimmed) ?? trimmed)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Numărul nu s-a salvat.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-border p-3.5">
      {error ? <Notice tone="danger" title={error} /> : null}
      <BigInput
        label="Telefonul tău"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="07XX XXX XXX"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={trimmed && invalid ? 'Numărul începe cu 07 și are 10 cifre.' : undefined}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="neutral" size="touch" onClick={onCancel}>
          Renunț
        </Button>
        <Button type="button" variant="primary" size="touch" disabled={invalid} loading={saving} onClick={() => void save()}>
          Salvează
        </Button>
      </div>
    </div>
  )
}

export function ContPageClient({ tenantId, accountPhone }: { tenantId: string | null; accountPhone: string | null }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { userId, email, isSuperAdmin } = useDashboardAuth()
  const { unsubscribe: unsubscribePush } = usePushSubscription()
  const { count: clientiCount, isLoading: clientiLoading } = useClientiCount()

  const isDemo = Boolean(email?.endsWith('@demo.zmeurel.local'))
  const [open, setOpen] = useState<Open>(null)
  const [phone, setPhone] = useState(accountPhone ?? '')

  const [exportingJson, setExportingJson] = useState<{ done: number; total: number } | null>(null)
  const [exportingCsv, setExportingCsv] = useState<{ module: CsvModule; rows: number } | null>(null)

  const [confirm, setConfirm] = useState<Confirm>(null)
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const openConfirm = (next: Confirm) => {
    hapticConfirm()
    setConfirm((current) => (current === next ? null : next))
    setPassword('')
    setTyped('')
    setDeleteError(null)
  }

  const exportJson = async () => {
    if (!userId || !tenantId) {
      toast.error('Nu am găsit ferma pentru export.')
      return
    }
    setExportingJson({ done: 0, total: 1 })
    try {
      await exportAllDataJson({
        userId,
        email: email ?? '',
        tenantId,
        onProgress: (done, total) => setExportingJson({ done, total }),
      })
      toast.success('Fișierul cu datele tale s-a descărcat.')
    } catch (cause) {
      toast.error((cause as { message?: string })?.message || 'Nu am putut descărca datele.')
    } finally {
      setExportingJson(null)
    }
  }

  const exportCsv = async (module: CsvModule) => {
    if (!tenantId) {
      toast.error('Nu am găsit ferma pentru export.')
      return
    }
    setExportingCsv({ module, rows: 0 })
    try {
      await exportModuleCsv({ module, tenantId, onRows: (rows) => setExportingCsv({ module, rows }) })
      toast.success('Tabelul s-a descărcat.')
    } catch (cause) {
      toast.error((cause as { message?: string })?.message || 'Nu am putut descărca tabelul.')
    } finally {
      setExportingCsv(null)
    }
  }

  const showOnboardingAgain = async () => {
    if (!userId) return
    const { error } = await getSupabase().from('profiles').update({ hide_onboarding: false }).eq('id', userId)
    if (error) toast.error('Nu am putut reporni ghidul.')
    else {
      // „Primii pași” se ascund pe telefon (localStorage): îi arătăm din nou și acolo.
      try {
        window.localStorage.removeItem(cheieAscundePrimiiPasi(userId))
      } catch {
        // fără localStorage: nimic de șters
      }
      toast.success('Ghidul de pornire apare din nou pe Acasă.')
    }
  }

  const runDelete = async () => {
    const pass = password.trim()
    if (!pass || deleting) return
    if (confirm === 'account' && typed.trim().toUpperCase() !== ACCOUNT_CONFIRM_TEXT) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (confirm === 'farm') {
        await resetFarmData(pass)
        disableDemoMode()
        disableFarmSetupMode()
        clearDemoSeedAttempted()
        await queryClient.cancelQueries()
        queryClient.clear()
        toast.success('Datele fermei au fost șterse.')
        router.push('/start')
        router.refresh()
        return
      }
      if (confirm === 'account') {
        await deleteAccountAndFarm(pass)
        toast.success('Contul și ferma au fost șterse.')
        await prepareClientBeforeServerSignOut(queryClient, { unsubscribePush })
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = `${window.location.origin}/api/auth/sign-out?next=/login`
        document.body.appendChild(form)
        form.submit()
      }
    } catch (cause) {
      setDeleteError(cause instanceof Error && cause.message ? cause.message : 'Ștergerea nu a mers.')
    } finally {
      setDeleting(false)
    }
  }

  const confirmTexts = {
    farm: {
      title: 'Ștergi datele fermei?',
      text: 'Recoltările, lucrările, vânzările, cheltuielile și culegătorii se șterg. Contul rămâne. Scrie parola ca să confirmi.',
    },
    account: {
      title: 'Ștergi contul?',
      text: 'Contul, ferma și toate datele se șterg de tot. Descarcă-le înainte, dacă le vrei. Scrie parola ca să confirmi.',
    },
  } as const

  const accountTypedOk = typed.trim().toUpperCase() === ACCOUNT_CONFIRM_TEXT

  return (
    <AppShell header={<ScreenHeader title="Contul tău" backHref="/settings" />}>
      <ScreenBody className="space-y-4">
        <RowGroup>
          {isDemo ? (
            <div className="p-3.5">
              <Notice tone="warning" title="Cont demo">
                Creează-ți ferma cu Google sau cu email ca să ai un cont al tău.
              </Notice>
            </div>
          ) : (
            <InfoRow label="Email" value={email ?? '—'} />
          )}
          {!isDemo ? (
            <div>
              <ActionRow
                label="Schimbă parola"
                icon={<KeyRound />}
                iconTone="neutral"
                chevron={open !== 'parola'}
                expanded={open === 'parola'}
                onClick={() => setOpen((current) => (current === 'parola' ? null : 'parola'))}
              />
              {open === 'parola' ? <PasswordForm onDone={() => setOpen(null)} /> : null}
            </div>
          ) : null}
          <div>
            <ActionRow
              label="Telefonul tău"
              sub={`${phone || 'Necompletat'} · pentru recuperarea contului`}
              icon={<Phone />}
              iconTone="neutral"
              chevron={open !== 'telefon'}
              expanded={open === 'telefon'}
              onClick={() => setOpen((current) => (current === 'telefon' ? null : 'telefon'))}
            />
            {open === 'telefon' ? (
              <PhoneForm
                initial={phone}
                onCancel={() => setOpen(null)}
                onSaved={(saved) => {
                  setPhone(saved)
                  setOpen(null)
                }}
              />
            ) : null}
          </div>
        </RowGroup>

        <section className="space-y-2" aria-labelledby="datele-tale">
          <h2 id="datele-tale" className={cn('font-bold text-fg', kitText.secondary)}>
            Datele tale
          </h2>
          <PanelCard>
            <p className={cn('text-fg-muted', kitText.secondary)}>
              Descarci tot ce ai în aplicație: recoltări, comenzi, clienți, cheltuieli. Un singur fișier cu tot, sau un tabel pe categorie.
            </p>
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="w-full"
              loading={exportingJson !== null}
              disabled={Boolean(exportingCsv)}
              onClick={() => void exportJson()}
            >
              <Download aria-hidden />
              {exportingJson ? `Se pregătește… (${exportingJson.done} din ${exportingJson.total})` : 'Descarcă datele'}
            </Button>
            <p className={cn('text-fg-muted', kitText.helper)}>Doar o categorie, ca tabel (CSV):</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CSV_MODULES.map((module) => (
                <Button
                  key={module.key}
                  type="button"
                  variant="neutral"
                  size="touch"
                  disabled={Boolean(exportingCsv) || exportingJson !== null}
                  loading={exportingCsv?.module === module.key}
                  onClick={() => void exportCsv(module.key)}
                >
                  {exportingCsv?.module === module.key ? `${exportingCsv.rows} rânduri` : module.label}
                </Button>
              ))}
            </div>
          </PanelCard>
        </section>

        <RowGroup>
          <ActionRow label="Arată din nou ghidul de pornire" icon={<BookOpen />} iconTone="neutral" onClick={() => void showOnboardingAgain()} />
        </RowGroup>

        <RowGroup title="Ireversibil" titleTone="danger" danger>
          <ActionRow
            danger
            label="Șterge datele fermei"
            sub="Contul rămâne; ferma o iei de la zero"
            expanded={confirm === 'farm'}
            onClick={() => openConfirm('farm')}
          />
          <ActionRow
            danger
            label="Șterge contul"
            sub={isSuperAdmin ? 'Cont protejat: nu se poate șterge' : 'Contul și ferma dispar de tot'}
            disabled={isSuperAdmin}
            expanded={confirm === 'account'}
            onClick={() => openConfirm('account')}
          />
          <ActionRow
            danger
            label="Șterge toți clienții"
            sub={clientiLoading ? 'Număr clienții…' : clientiCount === 0 ? 'Nu ai niciun client' : `${clientiCount} ${clientiCount === 1 ? 'client' : 'clienți'}; cei cu comenzi rămân`}
            disabled={!clientiLoading && clientiCount === 0}
            expanded={confirm === 'clients'}
            onClick={() => openConfirm('clients')}
          />
        </RowGroup>

        {confirm === 'clients' ? <StergeClientiPanel onCancel={() => setConfirm(null)} /> : null}

        {confirm === 'farm' || confirm === 'account' ? (
          <div className="space-y-3 rounded-box border border-danger-border bg-danger-bg p-3.5" role="group" aria-labelledby="confirm-titlu">
            <p id="confirm-titlu" className={cn('font-extrabold text-danger-text', kitText.base)}>
              {confirmTexts[confirm].title}
            </p>
            <p className={cn('text-fg-muted', kitText.secondary)}>{confirmTexts[confirm].text}</p>
            {deleteError ? <Notice tone="danger" title={deleteError} /> : null}
            {confirm === 'account' ? (
              <BigInput
                label={`Scrie ${ACCOUNT_CONFIRM_TEXT}`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            ) : null}
            <BigInput
              label="Parola ta"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="neutral" size="touch" onClick={() => setConfirm(null)} disabled={deleting}>
                Renunț
              </Button>
              <Button
                type="button"
                variant="danger"
                size="touch"
                disabled={!password.trim() || (confirm === 'account' && !accountTypedOk)}
                loading={deleting}
                onClick={() => void runDelete()}
              >
                Șterge
              </Button>
            </div>
          </div>
        ) : null}
      </ScreenBody>
    </AppShell>
  )
}
