'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, KeyRound, Loader2, Settings2, UserCircle2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { AppShell } from '@/components/app/AppShell'
import { FarmSwitcher } from '@/components/app/FarmSwitcher'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUiDensity } from '@/hooks/useUiDensity'
import { track } from '@/lib/analytics/track'
import {
  clearDemoSeedAttempted,
  disableFarmSetupMode,
  disableDemoMode,
  enableDemoMode,
  enableFarmSetupMode,
  markDemoSeedAttempted,
} from '@/lib/demo/onboarding-storage'
import {
  clearDemoTutorialPending,
  markDemoTutorialPending,
  resetDemoTutorialSeen,
} from '@/lib/demo/tutorial-storage'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantByIdOrNull, getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

type CsvModule = 'activitati' | 'cheltuieli' | 'vanzari' | 'recoltari' | 'clienti' | 'comenzi'

type TenantTable =
  | 'activitati_agricole'
  | 'cheltuieli_diverse'
  | 'vanzari'
  | 'recoltari'
  | 'clienti'
  | 'parcele'
  | 'culegatori'
  | 'investitii'
  | 'vanzari_butasi'
  | 'vanzari_butasi_items'
  | 'comenzi'
  | 'miscari_stoc'
  | 'alert_dismissals'

const CSV_MODULES: Array<{ key: CsvModule; label: string; table: TenantTable }> = [
  { key: 'activitati', label: 'Activități', table: 'activitati_agricole' },
  { key: 'cheltuieli', label: 'Cheltuieli', table: 'cheltuieli_diverse' },
  { key: 'vanzari', label: 'Vânzări', table: 'vanzari' },
  { key: 'recoltari', label: 'Recoltări', table: 'recoltari' },
  { key: 'clienti', label: 'Clienți', table: 'clienti' },
  { key: 'comenzi', label: 'Comenzi', table: 'comenzi' },
]

const GDPR_TABLES: TenantTable[] = [
  'activitati_agricole',
  'cheltuieli_diverse',
  'vanzari',
  'recoltari',
  'clienti',
  'parcele',
  'culegatori',
  'investitii',
  'vanzari_butasi',
  'vanzari_butasi_items',
  'comenzi',
  'miscari_stoc',
  'alert_dismissals',
]

const EXPORT_BATCH_SIZE = 1000
const PROTECTED_SUPERADMIN_EMAIL = 'popa.andrei.sv@gmail.com'

function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const escaped = raw.replace(/"/g, '""')
  return `"${escaped}"`
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const headerLine = headers.map(escapeCsvValue).join(',')
  const lines = rows.map((row) => headers.map((key) => escapeCsvValue(row[key])).join(','))

  return [headerLine, ...lines].join('\n')
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const router = useRouter()
  const { density, setDensity } = useUiDensity()
  const { userId, email, isSuperAdmin } = useDashboardAuth()
  const safeEmail = email ?? 'Necunoscut'
  const isProtectedSuperadmin = safeEmail.toLowerCase() === PROTECTED_SUPERADMIN_EMAIL

  const [tenantId, setTenantId] = useState<string | null>(null)
  const [farmName, setFarmName] = useState('')
  const [farmNameDraft, setFarmNameDraft] = useState('')
  const [isSavingFarmName, setIsSavingFarmName] = useState(false)

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [isExportingJson, setIsExportingJson] = useState(false)
  const [jsonExportProgress, setJsonExportProgress] = useState<{ done: number; total: number } | null>(null)
  const [exportingCsvModule, setExportingCsvModule] = useState<CsvModule | null>(null)
  const [csvExportRowsFetched, setCsvExportRowsFetched] = useState(0)

  const [deleteFarmStep1Open, setDeleteFarmStep1Open] = useState(false)
  const [isDeletingDemoData, setIsDeletingDemoData] = useState(false)
  const [isReseedingDemoData, setIsReseedingDemoData] = useState(false)
  const [isExitingDemoMode, setIsExitingDemoMode] = useState(false)
  const [isDeletingFarmData, setIsDeletingFarmData] = useState(false)

  const [deleteAccountStep1Open, setDeleteAccountStep1Open] = useState(false)
  const [deleteAccountStep2Open, setDeleteAccountStep2Open] = useState(false)
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    void (async () => {
      if (!userId) return

      const supabase = getSupabase()
      const resolvedTenantId = await getTenantIdByUserIdOrNull(supabase, userId)

      const tenantRow = await getTenantByIdOrNull(supabase, resolvedTenantId)

      if (tenantRow?.id) {
        setTenantId(tenantRow.id)
      }
      if (tenantRow?.nume_ferma) {
        setFarmName(tenantRow.nume_ferma)
        setFarmNameDraft(tenantRow.nume_ferma)
      }
    })()
  }, [userId])

  const passwordError = useMemo(() => {
    if (!newPassword && !confirmPassword) return null
    if (newPassword.length < 8) return 'Parola trebuie sa aiba minim 8 caractere.'
    if (newPassword !== confirmPassword) return 'Parolele nu coincid.'
    return null
  }, [confirmPassword, newPassword])

  const canConfirmDeleteAccount = deleteAccountConfirmText.trim().toUpperCase() === 'STERGE CONTUL'

  const handleChangePassword = async () => {
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setIsSavingPassword(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      toast.success('Parola a fost actualizata.')
      setPasswordDialogOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut actualiza parola.'
      toast.error(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleSaveFarmName = async () => {
    const nextFarmName = farmNameDraft.trim()
    if (nextFarmName.length < 2) {
      toast.error('Numele fermei trebuie sa aiba minim 2 caractere.')
      return
    }

    setIsSavingFarmName(true)
    try {
      const response = await fetch('/api/gdpr/farm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmName: nextFarmName }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        error?: { code?: string; message?: string; details?: string | null } | string
        data?: { farmName?: string }
        farmName?: string
      }

      if (!response.ok || payload.ok === false) {
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : payload.error?.message || 'Nu am putut actualiza numele fermei.'
        throw new Error(message)
      }

      const savedFarmName = payload.data?.farmName ?? payload.farmName ?? nextFarmName
      setFarmName(savedFarmName)
      setFarmNameDraft(savedFarmName)
      toast.success('Numele fermei a fost actualizat')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut actualiza numele fermei.'
      toast.error(message)
    } finally {
      setIsSavingFarmName(false)
    }
  }

  const handleExportAllDataJson = async () => {
    if (!userId || !tenantId) {
      toast.error('Context tenant indisponibil pentru export.')
      return
    }

    setIsExportingJson(true)
    setJsonExportProgress({ done: 0, total: GDPR_TABLES.length })
    try {
      const supabase = getSupabase()
      const nowIso = new Date().toISOString()

      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .maybeSingle()

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      const tables: Record<string, unknown[]> = {}
      const errors: Record<string, string> = {}

      const fetchTenantRowsBatched = async (table: TenantTable) => {
        const rows: unknown[] = []
        let from = 0

        while (true) {
          const to = from + EXPORT_BATCH_SIZE - 1
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('tenant_id', tenantId)
            .range(from, to)

          if (error) throw error

          const chunk = (data ?? []) as unknown[]
          if (!chunk.length) break

          rows.push(...chunk)
          if (chunk.length < EXPORT_BATCH_SIZE) break
          from += EXPORT_BATCH_SIZE
        }

        return rows
      }

      for (let index = 0; index < GDPR_TABLES.length; index += 1) {
        const table = GDPR_TABLES[index]
        try {
          tables[table] = await fetchTenantRowsBatched(table)
        } catch (error) {
          errors[table] = (error as { message?: string })?.message || 'Unknown error'
          tables[table] = []
        }

        setJsonExportProgress({ done: index + 1, total: GDPR_TABLES.length })
      }

      const payload = {
        exported_at: nowIso,
        compliance: 'Regulamentul (UE) 2016/679 (GDPR)',
        user: {
          id: userId,
          email: safeEmail,
        },
        tenant: tenantRow,
        profile: profileRow,
        tables,
        errors,
      }

      downloadFile(
        JSON.stringify(payload, null, 2),
        `zmeurel-gdpr-export-${nowIso.slice(0, 10)}.json`,
        'application/json;charset=utf-8'
      )
      track('export', { type: 'json', module: 'all', rows: Object.values(tables).reduce((sum, tableRows) => sum + (tableRows?.length ?? 0), 0) })
      toast.success('Export JSON generat.')
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut exporta datele.'
      toast.error(message)
    } finally {
      setIsExportingJson(false)
      setJsonExportProgress(null)
    }
  }

  const handleExportModuleCsv = async (module: CsvModule) => {
    if (!tenantId) {
      toast.error('Context tenant indisponibil pentru export.')
      return
    }

    const config = CSV_MODULES.find((item) => item.key === module)
    if (!config) return

    setExportingCsvModule(module)
    setCsvExportRowsFetched(0)
    try {
      const supabase = getSupabase()
      const rows: Record<string, unknown>[] = []
      let from = 0

      while (true) {
        const to = from + EXPORT_BATCH_SIZE - 1
        const { data, error } = await supabase
          .from(config.table)
          .select('*')
          .eq('tenant_id', tenantId)
          .range(from, to)

        if (error) throw error

        const chunk = (data ?? []) as Record<string, unknown>[]
        if (!chunk.length) break

        rows.push(...chunk)
        setCsvExportRowsFetched(rows.length)

        if (chunk.length < EXPORT_BATCH_SIZE) break
        from += EXPORT_BATCH_SIZE
      }

      const csv = rowsToCsv(rows)
      downloadFile(csv, `zmeurel-${module}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
      track('export', { type: 'csv', module, rows: rows.length })
      toast.success(`Export CSV generat pentru ${config.label}.`)
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut exporta CSV-ul modulului.'
      toast.error(message)
    } finally {
      setExportingCsvModule(null)
      setCsvExportRowsFetched(0)
    }
  }

  const handleDeleteFarmData = async () => {
    setIsDeletingFarmData(true)
    try {
      const response = await fetch('/api/farm/reset', { method: 'POST' })
      const payload = (await response.json()) as {
        success?: boolean
        error?: string | { message?: string }
      }
      if (!response.ok || payload.success !== true) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut reseta datele fermei.')
      }

      disableDemoMode()
      disableFarmSetupMode()
      clearDemoSeedAttempted()
      clearDemoTutorialPending()
      resetDemoTutorialSeen()
      setDeleteFarmStep1Open(false)
      toast.success('Datele fermei au fost resetate.')
      router.push('/start')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut reseta datele fermei.'
      toast.error(message)
    } finally {
      setIsDeletingFarmData(false)
    }
  }

  const handleDeleteDemoData = async () => {
    if (!tenantId) {
      toast.error('Context tenant indisponibil.')
      return
    }

    setIsDeletingDemoData(true)
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST' })
      const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut sterge datele demo.')
      }

      disableDemoMode()
      clearDemoSeedAttempted()
      clearDemoTutorialPending()
      toast.success('Datele demo au fost sterse.')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut șterge datele demo.'
      toast.error(message)
    } finally {
      setIsDeletingDemoData(false)
    }
  }

  const handleReseedDemoData = async () => {
    if (!tenantId) {
      toast.error('Context tenant indisponibil.')
      return
    }

    setIsReseedingDemoData(true)
    try {
      const response = await fetch('/api/demo/reload', { method: 'POST' })
      const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut reîncărca datele demo.')
      }

      enableDemoMode()
      markDemoSeedAttempted()
      clearDemoTutorialPending()
      resetDemoTutorialSeen()
      toast.success('Datele demo au fost reîncărcate.')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut reîncărca datele demo.'
      toast.error(message)
    } finally {
      setIsReseedingDemoData(false)
    }
  }

  const handleExitDemoMode = async () => {
    if (!tenantId) {
      toast.error('Context tenant indisponibil.')
      return
    }

    setIsExitingDemoMode(true)
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST' })
      const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut iesi din modul demo.')
      }

      disableDemoMode()
      clearDemoSeedAttempted()
      enableFarmSetupMode()
      resetDemoTutorialSeen()
      markDemoTutorialPending()
      toast.success('Ai iesit din modul demo.')
      router.push('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut iesi din modul demo.'
      toast.error(message)
    } finally {
      setIsExitingDemoMode(false)
    }
  }

  const handleDeleteAccountAndTenant = async () => {
    setIsDeletingAccount(true)
    try {
      const response = await fetch('/api/gdpr/account', { method: 'DELETE' })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Nu am putut sterge contul.')

      const supabase = getSupabase()
      await supabase.auth.signOut()
      toast.success('Contul ți tenantul au fost sterse.')
      router.push('/login')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut șterge contul.'
      toast.error(message)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <AppShell
      header={<PageHeader title="Cont & Setari" subtitle="Profil utilizator și preferințe" rightSlot={<Settings2 className="h-5 w-5" />} />}
    >
      <div className="mx-auto mt-4 w-full max-w-3xl space-y-4 py-4 sm:mt-0 lg:space-y-6 xl:space-y-8">
        <section id="profil" className="agri-card space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Profil utilizator</h2>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-[var(--agri-text-muted)]">Email</Label>
            <div className="agri-control flex h-11 items-center gap-2 px-3 text-sm font-medium text-[var(--agri-text)]">
              <UserCircle2 className="h-4 w-4 text-[var(--agri-text-muted)]" />
              {safeEmail}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm-name" className="text-xs uppercase text-[var(--agri-text-muted)]">Nume fermă</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="farm-name"
                className="agri-control h-11"
                value={farmNameDraft}
                onChange={(event) => setFarmNameDraft(event.target.value)}
                placeholder="Nume fermă"
              />
              <Button
                type="button"
                className="agri-control h-11 bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
                disabled={isSavingFarmName || farmNameDraft.trim().length < 2 || farmNameDraft.trim() === farmName}
                onClick={handleSaveFarmName}
              >
                {isSavingFarmName ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se salvează...
                  </>
                ) : (
                  'Salvează'
                )}
              </Button>
            </div>
          </div>

          <Button type="button" variant="outline" className="agri-control h-11 justify-start gap-2" onClick={() => setPasswordDialogOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Schimba parola
          </Button>

        </section>

        <section id="gdpr" className="agri-card space-y-3 p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Protecția datelor (GDPR)</h2>
            <p className="text-sm text-[var(--agri-text-muted)]">
              Zmeurel OS respectă Regulamentul (UE) 2016/679 privind protecția datelor.
            </p>
            <p className="text-xs text-[var(--agri-text-muted)]">
              Exportul include datele operaționale: Terenuri, Activități, Recoltări, Cheltuieli, Vânzări, Material săditor, Clienți, Comenzi, Culegători.
            </p>
            <p className="text-xs text-[var(--agri-text-muted)]">
              Evenimentele de analytics sunt metrici interne de utilizare ți nu sunt incluse in export.
            </p>
            <p className="text-xs text-[var(--agri-text-muted)]">
              Evenimentele de analytics sunt eliminate cand stergi datele fermei sau contul.
            </p>
            <p className="text-xs text-[var(--agri-text-muted)]">
              Datele operaționale sunt păstrate până când le ștergi. Evenimentele de analytics sunt păstrate maximum 90 de zile pentru îmbunătățirea produsului.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="agri-control h-11 w-full justify-start gap-2"
            disabled={isExportingJson}
            onClick={handleExportAllDataJson}
          >
            {isExportingJson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExportingJson
              ? `Se genereaza JSON... (${jsonExportProgress?.done ?? 0}/${jsonExportProgress?.total ?? GDPR_TABLES.length})`
              : 'Export all my data (JSON)'}
          </Button>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Export CSV per modul</p>
            <div className="grid grid-cols-2 gap-2">
              {CSV_MODULES.map((module) => (
                <Button
                  key={module.key}
                  type="button"
                  variant="outline"
                  className="agri-control h-10 text-xs"
                  disabled={Boolean(exportingCsvModule)}
                  onClick={() => handleExportModuleCsv(module.key)}
                >
                  {exportingCsvModule === module.key ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {`Se exporta... (${csvExportRowsFetched} randuri)`}
                    </>
                  ) : (
                    module.label
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              disabled={!tenantId || isReseedingDemoData}
              onClick={handleReseedDemoData}
            >
              {isReseedingDemoData ? 'Se reîncarcă datele demo...' : 'Reîncarcă datele demo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 border-amber-300 text-amber-800 hover:bg-amber-50"
              disabled={!tenantId || isDeletingDemoData}
              onClick={handleDeleteDemoData}
            >
              {isDeletingDemoData ? 'Se sterg datele demo...' : 'Sterge datele demo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 border-blue-300 text-blue-800 hover:bg-blue-50"
              disabled={!tenantId || isExitingDemoMode}
              onClick={handleExitDemoMode}
            >
              {isExitingDemoMode ? 'Se inchide modul demo...' : 'Ieși din modul demo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setDeleteFarmStep1Open(true)}
            >
              Reseteaza datele fermei
            </Button>
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 border-red-500 text-red-800 hover:bg-red-50"
              onClick={() => setDeleteAccountStep1Open(true)}
              disabled={isProtectedSuperadmin}
            >
              Delete my account and tenant
            </Button>
            {isProtectedSuperadmin ? (
              <p className="text-xs font-medium text-[var(--agri-text-muted)]">
                Cont protejat: acest cont nu poate fi șters.
              </p>
            ) : null}
          </div>
        </section>

        {isSuperAdmin ? (
          <section id="ferma" className="agri-card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Schimba fermă</h2>
            <FarmSwitcher variant="panel" />
          </section>
        ) : null}

        <section id="interfata" className="agri-card space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">Densitate UI</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={density === 'compact' ? 'default' : 'outline'}
              className="agri-control h-11"
              onClick={() => setDensity('compact')}
            >
              Compact
            </Button>
            <Button
              type="button"
              variant={density === 'normal' ? 'default' : 'outline'}
              className="agri-control h-11"
              onClick={() => setDensity('normal')}
            >
              Normal
            </Button>
          </div>
        </section>
      </div>
      <AppDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        title="Schimba parola"
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setPasswordDialogOpen(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
              disabled={isSavingPassword || !!passwordError || newPassword.length === 0}
              onClick={handleChangePassword}
            >
              {isSavingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Salvează'
              )}
            </Button>
          </>
        }
      >
        <div id="password" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Parola noua</Label>
            <Input
              id="new-password"
              type="password"
              className="agri-control h-12"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmă parola</Label>
            <Input
              id="confirm-password"
              type="password"
              className="agri-control h-12"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {passwordError ? <p className="text-sm font-medium text-red-700">{passwordError}</p> : null}
        </div>
      </AppDialog>

      <AppDialog
        open={deleteFarmStep1Open}
        onOpenChange={setDeleteFarmStep1Open}
        title="Resetezi datele fermei?"
        description="Resetarea va sterge toate datele fermei. Continui?"
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDeleteFarmStep1Open(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
              disabled={isDeletingFarmData}
              onClick={handleDeleteFarmData}
            >
              {isDeletingFarmData ? 'Se reseteaza...' : 'Continua'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Contul ți tenant-ul raman active, se sterg doar datele fermei pentru tenantul curent.
        </p>
      </AppDialog>

      <AppDialog
        open={deleteAccountStep1Open}
        onOpenChange={setDeleteAccountStep1Open}
        title="Stergi contul ți tenantul?"
        description="Actiunea elimina contul, tenantul ți toate datele asociate. Aceasta actiune este ireversibila."
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDeleteAccountStep1Open(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
              onClick={() => {
                setDeleteAccountStep1Open(false)
                setDeleteAccountStep2Open(true)
              }}
            >
              Continua
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Vei fi deconectat imediat dupa finalizare.
        </p>
      </AppDialog>

      <AppDialog
        open={deleteAccountStep2Open}
        onOpenChange={setDeleteAccountStep2Open}
        title="Confirmare finala - cont ți tenant"
        description="Tasteaza STERGE CONTUL pentru confirmare."
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDeleteAccountStep2Open(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
              disabled={!canConfirmDeleteAccount || isDeletingAccount}
              onClick={handleDeleteAccountAndTenant}
            >
              {isDeletingAccount ? 'Se sterge...' : 'Sterge contul'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="confirm-delete-account">Confirmare</Label>
          <Input
            id="confirm-delete-account"
            className="agri-control h-11"
            placeholder="STERGE CONTUL"
            value={deleteAccountConfirmText}
            onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
          />
        </div>
      </AppDialog>
    </AppShell>
  )
}



