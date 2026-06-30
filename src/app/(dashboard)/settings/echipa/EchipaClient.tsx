'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, MessageCircle, MoreHorizontal, RefreshCw, Settings2, UserPlus, UsersRound } from 'lucide-react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FARM_MEMBER_MODULE_LABELS,
  FARM_MEMBER_MODULES,
  normalizeFarmMemberAccess,
  type FarmMemberAccessLevel,
  type FarmMemberModule,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'
import { toast } from '@/lib/ui/toast'

type FarmMemberRole = 'operator' | 'livrator'

type FarmMember = {
  id: string
  created_at: string
  role: FarmMemberRole
  name: string
  phone: string | null
  invite_token: string | null
  modules_access?: unknown
}

type GeneratedInvite = {
  name: string
  phone?: string | null
  inviteUrl: string
  token: string
  role: FarmMemberRole
}

type AccessDraft = Record<FarmMemberModule, { enabled: boolean; level: FarmMemberAccessLevel }>

function roleLabel(role: FarmMemberRole): string {
  return role === 'operator' ? 'Operator' : 'Livrator'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value))
}

function normalizeWaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('40')) return digits
  return `40${digits.replace(/^0/, '')}`
}

function buildLivratorWaUrl(invite: GeneratedInvite): string | null {
  if (!invite.phone) return null
  const phone = normalizeWaPhone(invite.phone)
  if (!phone) return null
  const text = `Salut ${invite.name}! 🚚
Acesta e linkul tău de acces pentru livrările Zmeurel:
${invite.inviteUrl}

Deschide-l pe telefon înainte de fiecare zi de livrări.
— Echipa Zmeurel`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

function buildOperatorWaUrl(invite: GeneratedInvite): string {
  const text = `Salut!
Ți-am pregătit acces de operator în Zmeurel OS:
${invite.inviteUrl}

Deschide linkul și creează-ți contul pentru a lucra în ferma mea.`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

function createAccessDraft(defaultEnabled = false): AccessDraft {
  return FARM_MEMBER_MODULES.reduce((draft, module) => {
    draft[module] = { enabled: defaultEnabled, level: 'write' }
    return draft
  }, {} as AccessDraft)
}

function createDefaultOperatorDraft(): AccessDraft {
  const draft = createAccessDraft(false)
  draft.comenzi.enabled = true
  draft.livrari.enabled = true
  return draft
}

function accessToDraft(value: unknown, legacyFallback = false): AccessDraft {
  const draft = createAccessDraft(false)
  for (const item of normalizeFarmMemberAccess(value, { legacyFallback })) {
    draft[item.module] = { enabled: true, level: item.level }
  }
  return draft
}

function draftToModules(draft: AccessDraft): FarmMemberModuleAccess[] {
  return FARM_MEMBER_MODULES.flatMap((module) =>
    draft[module].enabled ? [{ module, level: draft[module].level }] : [],
  )
}

function accessLevelLabel(level: FarmMemberAccessLevel): string {
  return level === 'write' ? 'scriere' : 'citire'
}

function getApiErrorMessage(error: string | undefined, fallback: string): string {
  switch (error) {
    case 'no_account':
      return 'Această persoană nu are cont Zmeurel OS. Roagă-o să își creeze un cont gratuit pe zmeurel.ro'
    case 'already_member':
      return 'Această persoană e deja în echipa ta.'
    case 'forbidden':
      return 'Doar proprietarul fermei poate gestiona echipa.'
    default:
      return fallback
  }
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
  toast.success('Link copiat.')
}

function RoleBadge({ role }: { role: FarmMemberRole }) {
  const classes =
    role === 'operator'
      ? 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
      : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {roleLabel(role)}
    </span>
  )
}

function InviteResult({ invite }: { invite: GeneratedInvite }) {
  const waUrl = invite.role === 'livrator' ? buildLivratorWaUrl(invite) : buildOperatorWaUrl(invite)

  return (
    <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] p-3">
      <p className="text-sm font-semibold text-[var(--success-text)]">
        Link generat pentru {invite.name}:
      </p>
      <p className="mt-2 break-all rounded-xl bg-[var(--surface-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]">
        {invite.inviteUrl}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 gap-2"
          onClick={() => void copyText(invite.inviteUrl)}
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copiază linkul
        </Button>
        {waUrl ? (
          <Button
            type="button"
            className="min-h-11 flex-1 gap-2 bg-[var(--whatsapp-green)] text-white hover:opacity-90"
            onClick={() => window.open(waUrl, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Trimite pe WA
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function AccessPills({ access }: { access: unknown }) {
  const modules = normalizeFarmMemberAccess(access, { legacyFallback: true })
  if (modules.length === 0) {
    return <p className="mt-3 text-xs font-medium text-[var(--text-tertiary)]">Fără module active.</p>
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {modules.map((item) => (
        <span
          key={item.module}
          className="rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]"
        >
          {FARM_MEMBER_MODULE_LABELS[item.module]} · {accessLevelLabel(item.level)}
        </span>
      ))}
    </div>
  )
}

function ModuleAccessEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: AccessDraft
  onChange: (draft: AccessDraft) => void
  disabled?: boolean
}) {
  const updateModule = (
    module: FarmMemberModule,
    patch: Partial<{ enabled: boolean; level: FarmMemberAccessLevel }>,
  ) => {
    onChange({
      ...draft,
      [module]: {
        ...draft[module],
        ...patch,
      },
    })
  }

  return (
    <div className="space-y-2">
      {FARM_MEMBER_MODULES.map((module) => {
        const value = draft[module]
        return (
          <div
            key={module}
            className="grid gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3 sm:grid-cols-[1fr_150px]"
          >
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-[var(--border-default)]"
                checked={value.enabled}
                disabled={disabled}
                onChange={(event) => updateModule(module, { enabled: event.target.checked })}
              />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {FARM_MEMBER_MODULE_LABELS[module]}
              </span>
            </label>
            <Select
              value={value.level}
              disabled={disabled || !value.enabled}
              onValueChange={(level) => updateModule(module, { level: level as FarmMemberAccessLevel })}
            >
              <SelectTrigger className="min-h-11 bg-[var(--surface-card)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Citire</SelectItem>
                <SelectItem value="write">Citire + scriere</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}

function OperatorInviteDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (invite: GeneratedInvite) => void
}) {
  const [draft, setDraft] = useState<AccessDraft>(() => createDefaultOperatorDraft())
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const modules = draftToModules(draft)
    if (modules.length === 0) {
      toast.error('Alege cel puțin un modul pentru operator.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/farm-members/create-invite', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; invite_url?: string } | null
      if (!res.ok || !json?.invite_url) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut genera invitația.'))
      }
      onCreated({
        name: 'operator',
        role: 'operator',
        token: '',
        inviteUrl: json.invite_url,
      })
      setDraft(createDefaultOperatorDraft())
      onOpenChange(false)
      toast.success('Link de operator generat.')
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut genera invitația.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Invită operator"
      description="Alege modulele vizibile și nivelul de acces pentru contul nou."
      showCloseButton
      desktopFormWide
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Generează link
          </Button>
        </div>
      }
    >
      <ModuleAccessEditor draft={draft} onChange={setDraft} disabled={busy} />
    </AppDrawer>
  )
}

function ManageAccessDrawer({
  member,
  open,
  onOpenChange,
  onSaved,
}: {
  member: FarmMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (memberId: string, modules: FarmMemberModuleAccess[]) => void
}) {
  const [draft, setDraft] = useState<AccessDraft>(() => createDefaultOperatorDraft())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (member) {
      setDraft(accessToDraft(member.modules_access, true))
    }
  }, [member])

  const submit = async () => {
    if (!member) return
    const modules = draftToModules(draft)
    if (modules.length === 0) {
      toast.error('Alege cel puțin un modul pentru operator.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/farm-members/${member.id}/access`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        modules?: FarmMemberModuleAccess[]
      } | null
      if (!res.ok || !json?.modules) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut salva accesul.'))
      }
      onSaved(member.id, json.modules)
      onOpenChange(false)
      toast.success('Acces actualizat.')
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut salva accesul.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Gestionează acces"
      description={member ? `Module pentru ${member.name}` : undefined}
      showCloseButton
      desktopFormWide
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button type="button" disabled={busy || !member} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvează accesul
          </Button>
        </div>
      }
    >
      <ModuleAccessEditor draft={draft} onChange={setDraft} disabled={busy || !member} />
    </AppDrawer>
  )
}

function MemberCard({
  member,
  busy,
  onDeactivate,
  onRegenerate,
  onManageAccess,
}: {
  member: FarmMember
  busy: boolean
  onDeactivate: (member: FarmMember) => void
  onRegenerate: (member: FarmMember) => void
  onManageAccess: (member: FarmMember) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[var(--text-primary)]">{member.name}</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            📞 {member.phone?.trim() || 'Telefon necompletat'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Adăugat: {formatDate(member.created_at)}</p>
          {member.role === 'operator' ? <AccessPills access={member.modules_access} /> : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <RoleBadge role={member.role} />
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]"
              aria-label="Acțiuni membru"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-soft)]">
                {member.role === 'livrator' ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-card-muted)]"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false)
                      onRegenerate(member)
                    }}
                  >
                    Regenerează link
                  </button>
                ) : null}
                {member.role === 'operator' ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-card-muted)]"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false)
                      onManageAccess(member)
                    }}
                  >
                    <Settings2 className="h-4 w-4" aria-hidden />
                    Gestionează acces
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-[var(--soft-danger-text)] hover:bg-[var(--soft-danger-bg)]"
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false)
                    onDeactivate(member)
                  }}
                >
                  Dezactivează
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export function EchipaClient() {
  const [members, setMembers] = useState<FarmMember[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [operatorInviteOpen, setOperatorInviteOpen] = useState(false)
  const [managingAccessMember, setManagingAccessMember] = useState<FarmMember | null>(null)
  const [livratorName, setLivratorName] = useState('')
  const [livratorPhone, setLivratorPhone] = useState('')
  const [livratorBusy, setLivratorBusy] = useState(false)
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null)

  const activeCountLabel = useMemo(() => {
    if (members.length === 0) return 'Niciun membru activ'
    if (members.length === 1) return '1 membru activ'
    return `${members.length} membri activi`
  }, [members.length])

  const loadMembers = async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/farm-members', { credentials: 'same-origin' })
      const json = (await res.json().catch(() => null)) as { members?: FarmMember[]; error?: string } | null
      if (!res.ok) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut încărca echipa.'))
      }
      setMembers(json?.members ?? [])
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut încărca echipa.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadMembers('initial')
  }, [])

  const inviteLivrator = async () => {
    const name = livratorName.trim()
    const phone = livratorPhone.trim()
    if (!name) {
      toast.error('Introdu numele livratorului.')
      return
    }
    setLivratorBusy(true)
    setGeneratedInvite(null)
    try {
      const res = await fetch('/api/farm-members/invite-livrator', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: phone || undefined }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        token?: string
        invite_url?: string
      } | null
      if (!res.ok || !json?.token || !json.invite_url) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut genera linkul.'))
      }
      const invite = {
        name,
        phone: phone || null,
        token: json.token,
        inviteUrl: json.invite_url,
        role: 'livrator' as const,
      }
      setGeneratedInvite(invite)
      setLivratorName('')
      setLivratorPhone('')
      toast.success('Link de acces generat.')
      await loadMembers()
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut genera linkul.')
    } finally {
      setLivratorBusy(false)
    }
  }

  const deactivateMember = async (member: FarmMember) => {
    setBusyId(member.id)
    try {
      const res = await fetch(`/api/farm-members/${member.id}/deactivate`, {
        method: 'PATCH',
        credentials: 'same-origin',
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut dezactiva membrul.'))
      }
      setMembers((current) => current.filter((item) => item.id !== member.id))
      toast.success('Membru dezactivat.')
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut dezactiva membrul.')
    } finally {
      setBusyId(null)
    }
  }

  const regenerateToken = async (member: FarmMember) => {
    setBusyId(member.id)
    setGeneratedInvite(null)
    try {
      const res = await fetch(`/api/farm-members/${member.id}/regenerate-token`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        token?: string
        invite_url?: string
      } | null
      if (!res.ok || !json?.token || !json.invite_url) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut regenera linkul.'))
      }
      setGeneratedInvite({
        name: member.name,
        phone: member.phone,
        token: json.token,
        inviteUrl: json.invite_url,
        role: 'livrator',
      })
      toast.success('Link regenerat.')
      await loadMembers()
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut regenera linkul.')
    } finally {
      setBusyId(null)
    }
  }

  const handleAccessSaved = (memberId: string, modules: FarmMemberModuleAccess[]) => {
    setMembers((current) =>
      current.map((item) => (item.id === memberId ? { ...item, modules_access: modules } : item)),
    )
  }

  return (
    <div className="mx-auto mt-3 flex w-full max-w-md flex-col gap-4 pb-8 sm:max-w-3xl md:max-w-5xl">
      <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Membri activi</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeCountLabel}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={refreshing}
            aria-label="Reîncarcă echipa"
            onClick={() => void loadMembers()}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 text-sm text-[var(--text-secondary)]">
              Se încarcă echipa...
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] p-6 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-[var(--text-tertiary)]" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Nu ai membri activi încă.</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Adaugă un operator sau generează un link pentru un livrator.
              </p>
            </div>
          ) : (
            members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                busy={busyId === member.id}
                onDeactivate={deactivateMember}
                onRegenerate={regenerateToken}
                onManageAccess={setManagingAccessMember}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Operator — acces pe module</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Generează un link de creare cont și alege exact modulele vizibile pentru operator.
            </p>
          </div>
        </div>
        <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => setOperatorInviteOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Generează link operator
        </Button>
      </section>

      {generatedInvite ? <InviteResult invite={generatedInvite} /> : null}

      <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
            🚚
          </span>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Livrator — acces doar la livrări</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Nu necesită cont. Primește un link de acces pe telefon, valabil 30 de zile.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="livrator-name">Nume</Label>
            <Input
              id="livrator-name"
              className="min-h-11"
              value={livratorName}
              onChange={(event) => setLivratorName(event.target.value)}
              placeholder="Nume livrator"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="livrator-phone">Telefon (opțional)</Label>
            <Input
              id="livrator-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="min-h-11"
              value={livratorPhone}
              onChange={(event) => setLivratorPhone(event.target.value)}
              placeholder="07XX XXX XXX"
            />
          </div>
        </div>
        <Button
          type="button"
          className="mt-4 min-h-11 w-full"
          disabled={livratorBusy}
          onClick={() => void inviteLivrator()}
        >
          {livratorBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Generează link acces
        </Button>

      </section>

      <OperatorInviteDrawer
        open={operatorInviteOpen}
        onOpenChange={setOperatorInviteOpen}
        onCreated={setGeneratedInvite}
      />
      <ManageAccessDrawer
        member={managingAccessMember}
        open={Boolean(managingAccessMember)}
        onOpenChange={(open) => {
          if (!open) setManagingAccessMember(null)
        }}
        onSaved={handleAccessSaved}
      />
    </div>
  )
}
