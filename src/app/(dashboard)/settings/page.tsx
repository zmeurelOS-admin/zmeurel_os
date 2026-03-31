'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Download, KeyRound, Loader2, MapPin, MonitorSmartphone, Moon, Settings2, Sun, UserCircle2 } from 'lucide-react'
import { useTheme } from 'next-themes'
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
import { getSupabase } from '@/lib/supabase/client'
import { getTenantByIdOrNull, getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'
import { hapticConfirm } from '@/lib/utils/haptic'
import { isValidRomanianPhone, normalizePhone } from '@/lib/utils/phone'

type CsvModule = 'activitati' | 'cheltuieli' | 'vanzari' | 'recoltari' | 'clienti' | 'comenzi'
type DemoAction = 'exit'
type DemoSeedType = 'berries' | 'solar' | 'orchard' | 'fieldcrop'
type FarmPhoneRow = Pick<Database['public']['Tables']['tenants']['Row'], 'contact_phone'>
type ProfilePhoneRow = Pick<Database['public']['Tables']['profiles']['Row'], 'phone'>
type TenantSettingsRow = Pick<
  Database['public']['Tables']['tenant_settings']['Row'],
  'latitudine_default' | 'longitudine_default'
>

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

function getApiErrorMessage(
  payload: { error?: string | { message?: string } | null | undefined },
  fallbackMessage: string
) {
  if (typeof payload.error === 'string') {
    return payload.error
  }

  if (payload.error && typeof payload.error === 'object' && payload.error.message) {
    return payload.error.message
  }

  return fallbackMessage
}

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { density, setDensity } = useUiDensity()
  const { userId, email, isSuperAdmin } = useDashboardAuth()
  const safeEmail = email ?? 'Necunoscut'
  const isProtectedSuperadmin = safeEmail.toLowerCase() === PROTECTED_SUPERADMIN_EMAIL
  const [themeReady, setThemeReady] = useState(false)

  const [tenantId, setTenantId] = useState<string | null>(null)
  const [farmName, setFarmName] = useState('')
  const [farmNameDraft, setFarmNameDraft] = useState('')
  const [isSavingFarmName, setIsSavingFarmName] = useState(false)
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePhoneDraft, setProfilePhoneDraft] = useState('')
  const [profilePhoneError, setProfilePhoneError] = useState('')
  const [isSavingProfilePhone, setIsSavingProfilePhone] = useState(false)
  const [farmPhone, setFarmPhone] = useState('')
  const [farmPhoneDraft, setFarmPhoneDraft] = useState('')
  const [farmPhoneError, setFarmPhoneError] = useState('')
  const [isSavingFarmPhone, setIsSavingFarmPhone] = useState(false)

  // Tenant GPS location settings
  const [latitudineDefault, setLatitudineDefault] = useState('')
  const [latitudineDefaultDraft, setLatitudineDefaultDraft] = useState('')
  const [longitudineDefault, setLongitudineDefault] = useState('')
  const [longitudineDefaultDraft, setLongitudineDefaultDraft] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [isExportingJson, setIsExportingJson] = useState(false)
  const [jsonExportProgress, setJsonExportProgress] = useState<{ done: number; total: number } | null>(null)
  const [exportingCsvModule, setExportingCsvModule] = useState<CsvModule | null>(null)
  const [csvExportRowsFetched, setCsvExportRowsFetched] = useState(0)

  const [deleteFarmStep1Open, setDeleteFarmStep1Open] = useState(false)
  const [isReseedingDemoData, setIsReseedingDemoData] = useState(false)
  const [isExitingDemoMode, setIsExitingDemoMode] = useState(false)
  const [isDeletingFarmData, setIsDeletingFarmData] = useState(false)
  const [demoActionDialog, setDemoActionDialog] = useState<DemoAction | null>(null)
  const [demoSeedTypeDialogOpen, setDemoSeedTypeDialogOpen] = useState(false)

  const [deleteAiConversationsOpen, setDeleteAiConversationsOpen] = useState(false)
  const [isDeletingAiConversations, setIsDeletingAiConversations] = useState(false)
  const [deleteAccountStep1Open, setDeleteAccountStep1Open] = useState(false)
  const [deleteAccountStep2Open, setDeleteAccountStep2Open] = useState(false)
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    setThemeReady(true)
  }, [])

  useEffect(() => {
    void (async () => {
      if (!userId) return

      const supabase = getSupabase()
      const resolvedTenantId = await getTenantIdByUserIdOrNull(supabase, userId)

      const [tenantRow, farmPhoneRow, profileRow, tenantSettingsRow] = await Promise.all([
        getTenantByIdOrNull(supabase, resolvedTenantId),
        resolvedTenantId
          ? supabase
              .from('tenants')
              .select('contact_phone')
              .eq('id', resolvedTenantId)
              .single()
              .then(({ data, error }) => {
                if (error) throw error
                return data satisfies FarmPhoneRow
              })
          : Promise.resolve<FarmPhoneRow | null>(null),
        supabase
          .from('profiles')
          .select('phone')
          .eq('id', userId)
          .single()
          .then(({ data, error }) => {
            if (error) throw error
            return data satisfies ProfilePhoneRow
          }),
        resolvedTenantId
          ? supabase
              .from('tenant_settings')
              .select('latitudine_default,longitudine_default')
              .eq('tenant_id', resolvedTenantId)
              .single()
              .then(({ data, error }) => {
                if (error) throw error
                return data satisfies TenantSettingsRow
              })
          : Promise.resolve<TenantSettingsRow | null>(null),
      ])

      if (tenantRow?.id) {
        setTenantId(tenantRow.id)
      }
      if (tenantRow?.nume_ferma) {
        setFarmName(tenantRow.nume_ferma)
        setFarmNameDraft(tenantRow.nume_ferma)
      }
      const cp = farmPhoneRow?.contact_phone ?? ''
      setFarmPhone(cp)
      setFarmPhoneDraft(cp)

      const pp = profileRow.phone ?? ''
      setProfilePhone(pp)
      setProfilePhoneDraft(pp)

      // Set tenant GPS location defaults
      const lat = tenantSettingsRow?.latitudine_default ?? ''
      const lng = tenantSettingsRow?.longitudine_default ?? ''
      setLatitudineDefault(String(lat))
      setLatitudineDefaultDraft(String(lat))
      setLongitudineDefault(String(lng))
      setLongitudineDefaultDraft(String(lng))
    })()
  }, [userId])

  const passwordError = useMemo(() => {
    if (!newPassword && !confirmPassword) return null
    if (newPassword.length < 8) return 'Parola trebuie să aibă minimum 8 caractere.'
    if (newPassword !== confirmPassword) return 'Parolele nu coincid.'
    return null
  }, [confirmPassword, newPassword])

  const isDemo = safeEmail.includes('@demo.zmeurel.local')
  const canConfirmDeleteAccount = deleteAccountConfirmText.trim().toUpperCase() === 'ȘTERGE CONTUL'
  const isDemoActionPending = isReseedingDemoData || isExitingDemoMode
  const demoActionConfig = useMemo(() => {
    if (demoActionDialog === 'exit') {
      return {
        title: 'Ieși din modul demo?',
        description: 'Datele demo vor fi șterse, iar fluxul de configurare va fi reactivat.',
        confirmLabel: isExitingDemoMode ? 'Se închide...' : 'Ieși din demo',
      }
    }

    return null
  }, [demoActionDialog, isExitingDemoMode])

  const resetTenantCaches = async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
  }

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

      toast.success('Parola a fost actualizată.')
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

  const handleSaveProfilePhone = async () => {
    const draft = profilePhoneDraft.trim()
    if (!draft || !isValidRomanianPhone(draft)) {
      setProfilePhoneError('Număr invalid. Trebuie să înceapă cu 07 și să aibă 10 cifre.')
      return
    }
    setProfilePhoneError('')
    setIsSavingProfilePhone(true)
    try {
      const res = await fetch('/api/profile/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: draft }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error((payload as { error?: string }).error ?? 'Eroare la salvare.')
      }
      const normalized = normalizePhone(draft) ?? draft
      setProfilePhone(normalized)
      setProfilePhoneDraft(normalized)
      toast.success('Telefonul personal a fost actualizat.')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Nu am putut salva numărul.'
      toast.error(msg)
    } finally {
      setIsSavingProfilePhone(false)
    }
  }

  const handleSaveFarmPhone = async () => {
    const draft = farmPhoneDraft.trim()
    if (draft && !isValidRomanianPhone(draft)) {
      setFarmPhoneError('Număr invalid. Trebuie să înceapă cu 07 și să aibă 10 cifre.')
      return
    }
    setFarmPhoneError('')
    if (!tenantId) return
    setIsSavingFarmPhone(true)
    try {
      const normalized = draft ? (normalizePhone(draft) ?? draft) : ''
      const supabase = getSupabase()
      const { error } = await supabase
        .from('tenants')
        .update({ contact_phone: normalized || null })
        .eq('id', tenantId)
      if (error) throw error
      setFarmPhone(normalized)
      setFarmPhoneDraft(normalized)
      toast.success('Telefonul fermei a fost actualizat.')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Nu am putut salva numărul.'
      toast.error(msg)
    } finally {
      setIsSavingFarmPhone(false)
    }
  }

  const handleSaveLocation = async () => {
    if (!tenantId) return
    setIsSavingLocation(true)
    try {
      const supabase = getSupabase()
      const lat = latitudineDefaultDraft.trim() ? parseFloat(latitudineDefaultDraft.trim()) : null
      const lng = longitudineDefaultDraft.trim() ? parseFloat(longitudineDefaultDraft.trim()) : null

      // Validate coordinates if provided
      if ((lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) ||
          (lng !== null && (isNaN(lng) || lng < -180 || lng > 180))) {
        toast.error('Coordonate GPS invalide. Latitudinea trebuie să fie între -90 și 90, longitudinea între -180 și 180.')
        return
      }

      // Upsert tenant settings
      const { error } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          latitudine_default: lat,
          longitudine_default: lng,
        }, {
          onConflict: 'tenant_id'
        })

      if (error) throw error

      setLatitudineDefault(String(lat ?? ''))
      setLatitudineDefaultDraft(String(lat ?? ''))
      setLongitudineDefault(String(lng ?? ''))
      setLongitudineDefaultDraft(String(lng ?? ''))
      toast.success('Locația fermei a fost actualizată.')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Nu am putut salva locația.'
      toast.error(msg)
    } finally {
      setIsSavingLocation(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocația nu este disponibilă în acest browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLatitudineDefaultDraft(String(lat))
        setLongitudineDefaultDraft(String(lng))
        toast.success('Locația curentă a fost completată')
      },
      (error) => {
        const message =
          error.code === 1
            ? 'Accesul la locație a fost refuzat'
            : 'Nu am putut obține locația curentă'
        toast.error(message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const handleSaveFarmName = async () => {
    const nextFarmName = farmNameDraft.trim()
    if (nextFarmName.length < 2) {
      toast.error('Numele fermei trebuie să aibă minimum 2 caractere.')
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
        throw new Error(getApiErrorMessage(payload, 'Nu am putut reseta datele fermei.'))
      }

      disableDemoMode()
      disableFarmSetupMode()
      clearDemoSeedAttempted()
      setDeleteFarmStep1Open(false)
      await resetTenantCaches()
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

  const handleReseedDemoData = async (demoType: DemoSeedType) => {
    if (!tenantId) {
      toast.error('Context tenant indisponibil.')
      return
    }

    setIsReseedingDemoData(true)
    try {
      const response = await fetch('/api/demo/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_type: demoType }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut reîncărca datele demo.')
      }

      enableDemoMode()
      markDemoSeedAttempted()
      setDemoSeedTypeDialogOpen(false)
      await resetTenantCaches()
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
        throw new Error(message || 'Nu am putut ieși din modul demo.')
      }

      disableDemoMode()
      clearDemoSeedAttempted()
      enableFarmSetupMode()
      setDemoActionDialog(null)
      await resetTenantCaches()
      toast.success('Ai ieșit din modul demo.')
      router.push('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut ieși din modul demo.'
      toast.error(message)
    } finally {
      setIsExitingDemoMode(false)
    }
  }

  const handleDeleteAccountAndTenant = async () => {
    setIsDeletingAccount(true)
    try {
      const response = await fetch('/api/gdpr/account', { method: 'DELETE' })
      const payload = (await response.json()) as { error?: string | { message?: string } }
      if (!response.ok) throw new Error(getApiErrorMessage(payload, 'Nu am putut șterge contul.'))

      const supabase = getSupabase()
      await supabase.auth.signOut()
      toast.success('Contul și tenantul au fost șterse.')
      router.push('/login')
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Nu am putut șterge contul.'
      toast.error(message)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleDeleteAiConversations = async () => {
    if (!userId) {
      toast.error('Trebuie să fii autentificat pentru a șterge conversațiile AI.')
      return
    }

    setIsDeletingAiConversations(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      setDeleteAiConversationsOpen(false)
      toast.success('Conversațiile AI au fost șterse')
    } catch (error: unknown) {
      const message =
        (error as { message?: string })?.message || 'Nu am putut șterge conversațiile AI.'
      toast.error(message)
    } finally {
      setIsDeletingAiConversations(false)
    }
  }

  return (
    <AppShell
      header={<PageHeader title="Cont și setări" subtitle="Profil utilizator și preferințe" rightSlot={<Settings2 className="h-5 w-5" />} />}
    >
      <div className="mx-auto mt-3 w-full max-w-md space-y-3 py-3 sm:max-w-3xl sm:mt-0 lg:space-y-6 xl:space-y-8">
        <section id="profil" className="agri-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-[var(--agri-text)]">Contul tău</h2>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-[var(--agri-text-muted)]">Email</Label>
            {isDemo ? (
              <div className="rounded-xl border border-[var(--soft-warning-border)] bg-[var(--soft-warning-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--soft-warning-text)]">
                Cont demo — conectează-te cu Google sau email pentru a-ți crea ferma ta.
              </div>
            ) : (
              <div className="agri-control flex h-11 items-center gap-2 px-3 text-sm font-medium text-[var(--agri-text)]">
                <UserCircle2 className="h-4 w-4 text-[var(--agri-text-muted)]" />
                {safeEmail}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm-name" className="text-sm font-medium text-[var(--agri-text-muted)]">Numele fermei</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="farm-name"
                className="agri-control h-11"
                value={farmNameDraft}
                onChange={(event) => setFarmNameDraft(event.target.value)}
                placeholder="Numele fermei"
              />
              <Button
                type="button"
                className="agri-control h-11 bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
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

          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="text-sm font-medium text-[var(--agri-text-muted)]">Telefonul tău</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="agri-control h-11"
                value={profilePhoneDraft}
                onChange={(e) => { setProfilePhoneDraft(e.target.value); if (profilePhoneError) setProfilePhoneError('') }}
                placeholder="07XX XXX XXX"
              />
              <Button
                type="button"
                className="agri-control h-11 bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
                disabled={isSavingProfilePhone || profilePhoneDraft.trim() === profilePhone}
                onClick={handleSaveProfilePhone}
              >
                {isSavingProfilePhone ? <><Loader2 className="h-4 w-4 animate-spin" />Se salvează...</> : 'Salvează'}
              </Button>
            </div>
            {profilePhoneError ? <p className="text-xs text-red-600">{profilePhoneError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm-phone" className="text-sm font-medium text-[var(--agri-text-muted)]">Telefon contact fermă</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="farm-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="agri-control h-11"
                value={farmPhoneDraft}
                onChange={(e) => { setFarmPhoneDraft(e.target.value); if (farmPhoneError) setFarmPhoneError('') }}
                placeholder="07XX XXX XXX"
              />
              <Button
                type="button"
                className="agri-control h-11 bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
                disabled={isSavingFarmPhone || farmPhoneDraft.trim() === farmPhone}
                onClick={handleSaveFarmPhone}
              >
                {isSavingFarmPhone ? <><Loader2 className="h-4 w-4 animate-spin" />Se salvează...</> : 'Salvează'}
              </Button>
            </div>
            {farmPhoneError ? <p className="text-xs text-red-600">{farmPhoneError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-[var(--agri-text-muted)]">Locație fermă</Label>
            <p className="text-xs text-[var(--agri-text-muted)]">
              Coordonatele GPS sunt folosite pentru prognoza meteo și calcule. Dacă nu sunt specificate, se vor folosi coordonatele parcelelor individuale.
            </p>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  step="any"
                  className="agri-control h-11"
                  value={latitudineDefaultDraft}
                  onChange={(e) => setLatitudineDefaultDraft(e.target.value)}
                  placeholder="Latitudine (ex: 44.4397)"
                />
                <Input
                  type="number"
                  step="any"
                  className="agri-control h-11"
                  value={longitudineDefaultDraft}
                  onChange={(e) => setLongitudineDefaultDraft(e.target.value)}
                  placeholder="Longitudine (ex: 26.0983)"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="agri-control h-11 justify-start gap-2"
                  onClick={handleUseCurrentLocation}
                >
                  <MapPin className="h-4 w-4" />
                  📍 Folosește locația curentă
                </Button>
                <Button
                  type="button"
                  className="agri-control h-11 bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
                  disabled={isSavingLocation || 
                    (latitudineDefaultDraft.trim() === latitudineDefault && 
                     longitudineDefaultDraft.trim() === longitudineDefault)}
                  onClick={handleSaveLocation}
                >
                  {isSavingLocation ? (
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
          </div>

          <div className="flex flex-row flex-wrap items-center gap-3">
            {!isDemo && (
              <Button type="button" variant="outline" className="agri-control h-11 justify-start gap-2" onClick={() => setPasswordDialogOpen(true)}>
                <KeyRound className="h-4 w-4" />
                Schimbă parola
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="agri-control h-11 justify-start gap-2"
              onClick={async () => {
                const supabase = getSupabase()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                await supabase.from('profiles').update({ hide_onboarding: false }).eq('id', user.id)
                toast.success('Ghidul de pornire a fost reactivat. Mergi în Dashboard pentru a-l vedea.')
              }}
            >
              Arată ghidul de pornire
            </Button>
            {isDemo && (
              <Button
                type="button"
                className="h-11 rounded-xl bg-[var(--agri-primary)] px-5 text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
                onClick={async () => {
                  const supabase = getSupabase()
                  await supabase.auth.signOut()
                  window.location.href = '/start'
                }}
              >
                Creează-ți ferma →
              </Button>
            )}
          </div>

        </section>

        <section id="gdpr" className="agri-card w-full space-y-4 p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--agri-text)]">Datele tale</h2>
            <p className="text-sm leading-relaxed text-[var(--agri-text-muted)]">
              Datele fermei tale sunt private și în siguranță. Doar tu ai acces. Poți exporta sau șterge oricând toate datele.
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
              ? `Se generează JSON... (${jsonExportProgress?.done ?? 0}/${jsonExportProgress?.total ?? GDPR_TABLES.length})`
              : 'Descarcă toate datele'}
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Descarcă date pe categorii</p>
            <div className="grid grid-cols-2 gap-2">
              {CSV_MODULES.map((module) => (
                <Button
                  key={module.key}
                  type="button"
                  variant="outline"
                  className="agri-control h-10 w-full justify-center text-xs"
                  disabled={Boolean(exportingCsvModule)}
                  onClick={() => handleExportModuleCsv(module.key)}
                >
                  {exportingCsvModule === module.key ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {`Se exportă... (${csvExportRowsFetched} rânduri)`}
                    </>
                  ) : (
                    module.label
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--soft-danger-border)] bg-[var(--soft-danger-bg)] p-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[var(--soft-danger-text)]">Date AI</h3>
              <p className="text-sm text-[var(--soft-danger-text)]">
                Poți șterge permanent istoricul conversațiilor tale cu asistentul AI.
              </p>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="agri-control h-11 w-full justify-start border-[var(--soft-danger-border)] bg-[var(--agri-surface)] text-[var(--soft-danger-text)] hover:bg-[var(--agri-surface-muted)]"
                disabled={!userId || isDeletingAiConversations}
                onClick={() => {
                  hapticConfirm()
                  setDeleteAiConversationsOpen(true)
                }}
              >
                Șterge toate conversațiile AI
              </Button>
            </div>
          </div>

        </section>

        <section id="demo" className="agri-card space-y-4 p-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--agri-text)]">Mod demo</h2>
              <p className="text-sm text-[var(--agri-text-muted)]">
                Datele demo sunt exemple și pot fi resetate oricând.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="agri-control h-11 w-full justify-start border-[var(--soft-success-border)] text-[var(--soft-success-text)] hover:bg-[var(--soft-success-bg)]"
                disabled={!tenantId || isDemoActionPending}
                onClick={() => {
                  setDemoSeedTypeDialogOpen(true)
                }}
              >
                {isReseedingDemoData ? 'Se reîncarcă datele demo...' : 'Reîncarcă datele demo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="agri-control h-11 w-full justify-start border-[var(--soft-info-border)] text-[var(--soft-info-text)] hover:bg-[var(--soft-info-bg)]"
                disabled={!tenantId || isDemoActionPending}
                onClick={() => setDemoActionDialog('exit')}
              >
                {isExitingDemoMode ? 'Se închide modul demo...' : 'Ieși din demo'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--soft-danger-border)] bg-[var(--soft-danger-bg)] p-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[var(--soft-danger-text)]">Acțiuni permanente</h3>
              <p className="text-sm text-[var(--soft-danger-text)]">
                Aceste acțiuni șterg date reale și necesită confirmare.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <Button
                type="button"
                variant="outline"
                className="agri-control h-11 w-full justify-start border-[var(--soft-danger-border)] bg-[var(--agri-surface)] text-[var(--soft-danger-text)] hover:bg-[var(--agri-surface-muted)]"
                onClick={() => {
                  hapticConfirm()
                  setDeleteFarmStep1Open(true)
                }}
              >
                Resetează datele fermei
              </Button>
              <Button
                type="button"
                variant="outline"
                className="agri-control h-11 w-full justify-start border-[var(--soft-danger-border)] bg-[var(--agri-surface)] text-[var(--soft-danger-text)] hover:bg-[var(--agri-surface-muted)]"
                onClick={() => {
                  hapticConfirm()
                  setDeleteAccountStep1Open(true)
                }}
                disabled={isProtectedSuperadmin}
              >
                Șterge contul și ferma
              </Button>
              {isProtectedSuperadmin ? (
                <p className="text-xs font-medium text-[var(--soft-danger-text)]">
                  Cont protejat: acest cont nu poate fi șters.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {isSuperAdmin ? (
          <section id="ferma" className="agri-card space-y-3 p-6">
            <h2 className="text-lg font-semibold text-[var(--agri-text)]">Schimbă fermă</h2>
            <FarmSwitcher variant="panel" />
          </section>
        ) : null}

        <section id="tema" className="agri-card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-[var(--agri-text)]">Tema aplicației</h2>
          <p className="text-sm text-[var(--agri-text-muted)]">
            Salvez preferința pe acest dispozitiv și pot urma tema sistemului când alegi Auto.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              {
                value: 'system',
                label: 'Auto',
                description: themeReady ? `Acum: ${resolvedTheme === 'dark' ? 'Întunecat' : 'Luminos'}` : 'Urmează dispozitivul',
                icon: MonitorSmartphone,
              },
              {
                value: 'light',
                label: 'Luminos',
                description: 'Aspect clar, clasic',
                icon: Sun,
              },
              {
                value: 'dark',
                label: 'Întunecat',
                description: 'Mai confortabil seara',
                icon: Moon,
              },
            ].map((option) => {
              const Icon = option.icon
              const selected = (themeReady ? theme : 'system') === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
                      : 'border-[var(--agri-border)] bg-[var(--agri-surface)] text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--agri-surface-muted)] text-[var(--agri-text)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-[var(--agri-text-muted)]">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section id="interfata" className="agri-card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-[var(--agri-text)]">Tip interfață</h2>
          <p className="text-sm text-[var(--agri-text-muted)]">Aici alegi interfața normală sau compactă. Controlul nu mai apare în header.</p>
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
        open={demoSeedTypeDialogOpen}
        onOpenChange={(open) => {
          if (!isDemoActionPending) setDemoSeedTypeDialogOpen(open)
        }}
        title="Alege scenariul demo"
        description="Selectează tipul de fermă pentru reîncărcare."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { id: 'berries', emoji: '🫐', label: 'Fructe de pădure', hint: 'zmeură, mure, afine' },
            { id: 'solar', emoji: '🏠', label: 'Solarii', hint: 'roșii, castraveți, ardei' },
            { id: 'orchard', emoji: '🌳', label: 'Livezi', hint: 'meri, pruni, cireși' },
            { id: 'fieldcrop', emoji: '🌾', label: 'Cultură mare', hint: 'grâu, porumb, floarea-soarelui' },
          ] as Array<{ id: DemoSeedType; emoji: string; label: string; hint: string }>).map((option) => (
            <button
              key={option.id}
              type="button"
              className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-3 text-left hover:bg-[var(--agri-surface-muted)]"
              onClick={() => {
                void handleReseedDemoData(option.id)
              }}
              disabled={isDemoActionPending}
            >
              <div className="text-lg">{option.emoji}</div>
              <div className="mt-1 text-sm font-semibold text-[var(--agri-text)]">{option.label}</div>
              <div className="text-xs text-[var(--agri-text-muted)]">{option.hint}</div>
            </button>
          ))}
        </div>
      </AppDialog>
      <AppDialog
        open={demoActionDialog === 'exit'}
        onOpenChange={(open) => {
          if (!open && !isDemoActionPending) {
            setDemoActionDialog(null)
          }
        }}
        title={demoActionConfig?.title ?? 'Acțiune demo'}
        description={demoActionConfig?.description}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="agri-cta"
              disabled={isDemoActionPending}
              onClick={() => setDemoActionDialog(null)}
            >
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
              disabled={isDemoActionPending || demoActionDialog !== 'exit'}
              onClick={() => {
                if (demoActionDialog === 'exit') {
                  void handleExitDemoMode()
                }
              }}
            >
              {demoActionConfig?.confirmLabel ?? 'Continuă'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Acțiunea afectează doar tenantul curent și nu poate modifica alte ferme.
        </p>
      </AppDialog>

      <AppDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        title="Schimbă parola"
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setPasswordDialogOpen(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-primary)] text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
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
            <Label htmlFor="new-password">Parolă nouă</Label>
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
        title="Vrei să ștergi toate datele din fermă?"
        footer={
          <>
            <Button type="button" variant="outline" className="agri-cta" onClick={() => setDeleteFarmStep1Open(false)}>
              Nu, renunț
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
              disabled={isDeletingFarmData}
              onClick={handleDeleteFarmData}
            >
              {isDeletingFarmData ? 'Se șterge...' : 'Șterge datele'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Toate recoltele, lucrările, vânzările, cheltuielile și culegătorii vor fi șterse. Contul tău rămâne activ și poți adăuga date noi oricând.
        </p>
      </AppDialog>

      <AppDialog
        open={deleteAiConversationsOpen}
        onOpenChange={(open) => {
          if (!isDeletingAiConversations) {
            setDeleteAiConversationsOpen(open)
          }
        }}
        title="Ștergi istoricul conversațiilor AI?"
        description="Ești sigur? Toate conversațiile tale cu asistentul AI vor fi șterse permanent."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="agri-cta"
              disabled={isDeletingAiConversations}
              onClick={() => setDeleteAiConversationsOpen(false)}
            >
              Anulează
            </Button>
            <Button
              type="button"
              className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
              disabled={isDeletingAiConversations}
              onClick={handleDeleteAiConversations}
            >
              {isDeletingAiConversations ? 'Se șterge...' : 'Șterge conversațiile'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Acțiunea afectează doar conversațiile AI asociate contului tău curent.
        </p>
      </AppDialog>

      <AppDialog
        open={deleteAccountStep1Open}
        onOpenChange={setDeleteAccountStep1Open}
        title="Ștergi contul și tenantul?"
        description="Acțiunea elimină contul, tenantul și toate datele asociate. Această acțiune este ireversibilă."
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
              Continuă
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--agri-text-muted)]">
          Vei fi deconectat imediat după finalizare.
        </p>
      </AppDialog>

      <AppDialog
        open={deleteAccountStep2Open}
        onOpenChange={setDeleteAccountStep2Open}
        title="Confirmare finală - cont și tenant"
        description="Tastează ȘTERGE CONTUL pentru confirmare."
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
              {isDeletingAccount ? 'Se șterge...' : 'Șterge contul'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="confirm-delete-account">Confirmare</Label>
          <Input
            id="confirm-delete-account"
            className="agri-control h-11"
            placeholder="ȘTERGE CONTUL"
            value={deleteAccountConfirmText}
            onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
          />
        </div>
      </AppDialog>
    </AppShell>
  )
}



