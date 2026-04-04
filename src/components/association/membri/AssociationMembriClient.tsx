'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppDrawer } from '@/components/app/AppDrawer'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import type { AssociationMemberListItem } from '@/lib/association/members-queries'
import type { AssociationRole } from '@/lib/association/auth'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const ROLES: { value: AssociationRole; label: string; hint: string }[] = [
  {
    value: 'admin',
    label: 'Administrator',
    hint: 'Acces complet. Poate gestiona produse, comenzi, producători și poate invita alți membri.',
  },
  {
    value: 'moderator',
    label: 'Moderator',
    hint: 'Poate gestiona produse (listare, preț) și comenzi (schimbare status). Nu poate invita membri.',
  },
  {
    value: 'viewer',
    label: 'Vizualizator',
    hint: 'Doar vizualizare: dashboard, produse și comenzi asociației.',
  },
]

function roleBadge(role: AssociationRole) {
  const map: Record<AssociationRole, { className: string; label: string }> = {
    admin: {
      label: 'Admin',
      className: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    },
    moderator: {
      label: 'Moderator',
      className: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    },
    viewer: {
      label: 'Viewer',
      className: 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]',
    },
  }
  const m = map[role]
  return (
    <Badge variant="outline" className={cn('font-semibold', m.className)}>
      {m.label}
    </Badge>
  )
}

function roleLabelRo(role: AssociationRole): string {
  return ROLES.find((r) => r.value === role)?.label ?? role
}

function formatDt(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export type AssociationMembriClientProps = {
  initialMembers: AssociationMemberListItem[]
}

export function AssociationMembriClient({ initialMembers }: AssociationMembriClientProps) {
  const router = useRouter()
  const { email: currentEmail } = useDashboardAuth()
  const [members, setMembers] = useState<AssociationMemberListItem[]>(initialMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AssociationRole>('viewer')
  const [inviteBusy, setInviteBusy] = useState(false)

  const [roleDialog, setRoleDialog] = useState<AssociationMemberListItem | null>(null)
  const [newRole, setNewRole] = useState<AssociationRole>('viewer')
  const [roleBusy, setRoleBusy] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<AssociationMemberListItem | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  const [mobileDetail, setMobileDetail] = useState<AssociationMemberListItem | null>(null)

  const stats = useMemo(() => {
    const n = members.length
    const a = members.filter((m) => m.role === 'admin').length
    const mo = members.filter((m) => m.role === 'moderator').length
    const v = members.filter((m) => m.role === 'viewer').length
    return { n, a, mo, v }
  }, [members])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/association/members', { credentials: 'same-origin' })
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: { members: AssociationMemberListItem[] } }
      | null
    if (res.ok && json?.ok && json.data?.members) {
      setMembers(json.data.members)
    }
    router.refresh()
  }, [router])

  const submitInvite = useCallback(async () => {
    const email = inviteEmail.trim()
    if (!email) {
      toast.error('Introdu un email.')
      return
    }
    setInviteBusy(true)
    try {
      const res = await fetch('/api/association/members', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const msg = json && typeof json === 'object' && json.error?.message
        toast.error(typeof msg === 'string' ? msg : 'Nu am putut invita.')
        return
      }
      toast.success(`${email} a fost adăugat ca ${roleLabelRo(inviteRole)}.`)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('viewer')
      await refresh()
    } finally {
      setInviteBusy(false)
    }
  }, [inviteEmail, inviteRole, refresh])

  const submitRoleChange = useCallback(async () => {
    if (!roleDialog) return
    setRoleBusy(true)
    try {
      const res = await fetch('/api/association/members', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: roleDialog.id, role: newRole }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const msg = json && typeof json === 'object' && json.error?.message
        toast.error(typeof msg === 'string' ? msg : 'Nu am putut actualiza rolul.')
        return
      }
      toast.success('Rol actualizat.')
      setRoleDialog(null)
      await refresh()
    } finally {
      setRoleBusy(false)
    }
  }, [roleDialog, newRole, refresh])

  const submitRevoke = useCallback(async () => {
    if (!revokeTarget) return
    setRevokeBusy(true)
    try {
      const res = await fetch('/api/association/members', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: revokeTarget.id }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const msg = json && typeof json === 'object' && json.error?.message
        toast.error(typeof msg === 'string' ? msg : 'Nu am putut revoca accesul.')
        return
      }
      toast.success('Acces revocat.')
      setRevokeTarget(null)
      setMobileDetail(null)
      await refresh()
    } finally {
      setRevokeBusy(false)
    }
  }, [revokeTarget, refresh])

  const openRoleDialog = (m: AssociationMemberListItem) => {
    setNewRole(m.role)
    setRoleDialog(m)
  }

  const isSelf = (m: AssociationMemberListItem): boolean =>
    Boolean(
      currentEmail && m.email.toLowerCase() === currentEmail.toLowerCase()
    )

  const kpi = (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        { label: 'Total membri', value: stats.n },
        { label: 'Admini', value: stats.a },
        { label: 'Moderatori', value: stats.mo },
        { label: 'Vieweri', value: stats.v },
      ].map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-center shadow-[var(--shadow-soft)]"
        >
          <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{k.value}</div>
          <div className="text-xs font-semibold text-[var(--text-secondary)]">{k.label}</div>
        </div>
      ))}
    </div>
  )

  const actionsFor = (m: AssociationMemberListItem) => {
    const self = isSelf(m)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={self}
          onClick={() => openRoleDialog(m)}
        >
          Schimbă rol
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={self}
          onClick={() => setRevokeTarget(m)}
        >
          Revocă acces
        </Button>
      </div>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Membri"
          subtitle="Echipa Gustă din Bucovina — invitații și roluri"
          expandRightSlotOnMobile
          rightSlot={
            <Button type="button" size="sm" className="shrink-0" onClick={() => setInviteOpen(true)}>
              Invită membru
            </Button>
          }
        />
      }
    >
      <div className="mx-auto w-full max-w-5xl pb-10">
        {kpi}

        <div className="hidden md:block">
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border-default)] bg-[var(--surface-card-muted)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Adăugat de</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {members.map((m) => (
                  <tr key={m.id} className="text-[var(--text-primary)]">
                    <td className="px-4 py-3 font-medium">{m.email}</td>
                    <td className="px-4 py-3">{roleBadge(m.role)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {m.invitedByEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                      {formatDt(m.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">{actionsFor(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {members.map((m) => (
            <MobileEntityCard
              key={m.id}
              title={m.email}
              subtitle={m.invitedByEmail ? `Invitat de ${m.invitedByEmail}` : undefined}
              meta={formatDt(m.createdAt)}
              statusLabel={roleLabelRo(m.role)}
              statusTone={m.role === 'admin' ? 'success' : m.role === 'moderator' ? 'warning' : 'neutral'}
              showChevron
              interactive
              bottomSlot={actionsFor(m)}
              bottomSlotAlign="full"
              onClick={() => setMobileDetail(m)}
              ariaLabel={`Membru ${m.email}`}
            />
          ))}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invită membru</DialogTitle>
            <DialogDescription>
              Utilizatorul trebuie să aibă deja cont în Zmeurel OS (același email ca la înregistrare).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="nume@exemplu.ro"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AssociationRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-muted)]">{ROLES.find((r) => r.value === inviteRole)?.hint}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Anulează
            </Button>
            <Button type="button" disabled={inviteBusy} onClick={() => void submitInvite()}>
              {inviteBusy ? 'Se trimite…' : 'Invită'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialog != null} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schimbă rol</DialogTitle>
            <DialogDescription>
              {roleDialog ? (
                <>
                  Membru: <span className="font-medium text-[var(--text-primary)]">{roleDialog.email}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Rol nou</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AssociationRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)]">{ROLES.find((r) => r.value === newRole)?.hint}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRoleDialog(null)}>
              Anulează
            </Button>
            <Button type="button" disabled={roleBusy} onClick={() => void submitRoleChange()}>
              {roleBusy ? 'Se salvează…' : 'Salvează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeTarget != null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoci accesul?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget ? (
                <>
                  Ești sigur? <strong>{revokeTarget.email}</strong> nu va mai avea acces la workspace-ul asociației.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={revokeBusy} onClick={() => void submitRevoke()}>
                {revokeBusy ? 'Se procesează…' : 'Revocă acces'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppDrawer
        open={mobileDetail != null}
        onOpenChange={(o) => {
          if (!o) setMobileDetail(null)
        }}
        title={mobileDetail?.email ?? 'Membru'}
        description="Acțiuni"
      >
        {mobileDetail ? (
          <div className="space-y-4 pb-6">
            <div className="flex items-center gap-2">{roleBadge(mobileDetail.role)}</div>
            <p className="text-sm text-[var(--text-secondary)]">
              Adăugat: {formatDt(mobileDetail.createdAt)}
            </p>
            {mobileDetail.invitedByEmail ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Invitat de: {mobileDetail.invitedByEmail}
              </p>
            ) : null}
            {actionsFor(mobileDetail)}
          </div>
        ) : null}
      </AppDrawer>
    </AppShell>
  )
}
