'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, MessageCircle, MoreHorizontal, RefreshCw, UserPlus, UsersRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/ui/toast'

type FarmMemberRole = 'operator' | 'livrator'

type FarmMember = {
  id: string
  created_at: string
  role: FarmMemberRole
  name: string
  phone: string | null
  invite_token: string | null
}

type GeneratedInvite = {
  name: string
  phone?: string | null
  inviteUrl: string
  token: string
}

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
      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
      : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {roleLabel(role)}
    </span>
  )
}

function InviteResult({ invite }: { invite: GeneratedInvite }) {
  const waUrl = buildLivratorWaUrl(invite)

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
            className="min-h-11 flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
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

function MemberCard({
  member,
  busy,
  onDeactivate,
  onRegenerate,
}: {
  member: FarmMember
  busy: boolean
  onDeactivate: (member: FarmMember) => void
  onRegenerate: (member: FarmMember) => void
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

  const [operatorEmail, setOperatorEmail] = useState('')
  const [operatorBusy, setOperatorBusy] = useState(false)
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

  const inviteOperator = async () => {
    const email = operatorEmail.trim()
    if (!email) {
      toast.error('Introdu emailul operatorului.')
      return
    }
    setOperatorBusy(true)
    try {
      const res = await fetch('/api/farm-members/invite-operator', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(getApiErrorMessage(json?.error, 'Nu am putut adăuga operatorul.'))
      }
      toast.success('Operator adăugat. Se poate loga acum.')
      setOperatorEmail('')
      await loadMembers()
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut adăuga operatorul.')
    } finally {
      setOperatorBusy(false)
    }
  }

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
      const invite = { name, phone: phone || null, token: json.token, inviteUrl: json.invite_url }
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
      })
      toast.success('Link regenerat.')
      await loadMembers()
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Nu am putut regenera linkul.')
    } finally {
      setBusyId(null)
    }
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
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1D4ED8]">
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Operator — acces comenzi și livrări</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Persoana trebuie să aibă deja cont pe zmeurel.ro. Va putea adăuga și edita comenzi.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="operator-email">Email</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="operator-email"
              type="email"
              autoComplete="email"
              className="min-h-11"
              placeholder="nume@exemplu.ro"
              value={operatorEmail}
              onChange={(event) => setOperatorEmail(event.target.value)}
            />
            <Button
              type="button"
              className="min-h-11 shrink-0"
              disabled={operatorBusy}
              onClick={() => void inviteOperator()}
            >
              {operatorBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Invită operator
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#15803D]">
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

        {generatedInvite ? (
          <div className="mt-4">
            <InviteResult invite={generatedInvite} />
          </div>
        ) : null}
      </section>
    </div>
  )
}
