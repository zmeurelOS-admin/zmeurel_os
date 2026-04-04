'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ListChecks, Store, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { AppDrawer } from '@/components/app/AppDrawer'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { ProducerProfileEditor } from '@/components/association/producatori/ProducerProfileEditor'
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
import { AppCard } from '@/components/ui/app-card'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { AssociationRole } from '@/lib/association/auth'
import type { AssociationProducer } from '@/lib/association/queries'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function farmInitials(numeFerma: string) {
  const parts = numeFerma.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0] ?? ''
    const b = parts[1][0] ?? ''
    return `${a}${b}`.toUpperCase() || 'F'
  }
  const t = numeFerma.trim()
  return (t.slice(0, 2) || 'F').toUpperCase()
}

async function postProducerProductsListed(tenantId: string, listed: boolean) {
  const res = await fetch('/api/association/producers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, listed }),
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: { updatedCount: number }; error?: { message?: string } }
    | null
  if (!res.ok || !json?.ok || json.data == null) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Operațiune eșuată.')
  }
  return json.data
}

const ALLOC_ROLES: { value: AssociationRole; label: string; hint: string }[] = [
  {
    value: 'admin',
    label: 'Administrator',
    hint: 'Acces complet (produse, comenzi, membri)',
  },
  {
    value: 'moderator',
    label: 'Moderator',
    hint: 'Produse și comenzi',
  },
  {
    value: 'viewer',
    label: 'Vizualizator',
    hint: 'Doar vizualizare',
  },
]

function producerRoleBadge(role: AssociationRole) {
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
    <Badge variant="outline" className={cn('text-[12px] font-semibold', m.className)}>
      {m.label}
    </Badge>
  )
}

function roleLabelRo(role: AssociationRole): string {
  return ALLOC_ROLES.find((r) => r.value === role)?.label ?? role
}

function approvedBadge() {
  return (
    <Badge className="border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
      ✅ Aprobat
    </Badge>
  )
}

export type AssociationProducatoriClientProps = {
  initialProducers: AssociationProducer[]
  canManageProducts: boolean
  /** Doar adminul asociației poate aloca/schimba/revoca roluri workspace. */
  canManageAssociationRoles: boolean
}

export function AssociationProducatoriClient({
  initialProducers,
  canManageProducts,
  canManageAssociationRoles,
}: AssociationProducatoriClientProps) {
  const router = useRouter()
  const { userId: currentUserId } = useDashboardAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [producers, setProducers] = useState<AssociationProducer[]>(initialProducers)
  const [batchBusyId, setBatchBusyId] = useState<string | null>(null)
  const [mobileId, setMobileId] = useState<string | null>(null)
  const [profileTarget, setProfileTarget] = useState<AssociationProducer | null>(null)

  const [allocateTarget, setAllocateTarget] = useState<AssociationProducer | null>(null)
  const [allocateBusy, setAllocateBusy] = useState(false)

  const [changeTarget, setChangeTarget] = useState<AssociationProducer | null>(null)
  const [changeRole, setChangeRole] = useState<AssociationRole>('viewer')
  const [changeBusy, setChangeBusy] = useState(false)

  const [revokeTarget, setRevokeTarget] = useState<AssociationProducer | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  useEffect(() => {
    setProducers(initialProducers)
  }, [initialProducers])

  const mobileProducer = useMemo(
    () => (mobileId ? producers.find((p) => p.id === mobileId) ?? null : null),
    [mobileId, producers]
  )

  const mergeProducer = useCallback((id: string, patch: Partial<AssociationProducer>) => {
    setProducers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const refreshProducers = useCallback(() => {
    router.refresh()
  }, [router])

  const openProfileEditor = useCallback(
    (producer: AssociationProducer) => {
      if (isMobile) {
        setMobileId(null)
      }
      setProfileTarget(producer)
    },
    [isMobile]
  )

  const batchListAll = useCallback(
    async (p: AssociationProducer) => {
      if (!canManageProducts || batchBusyId) return
      if (p.activeProductCount === 0) {
        toast.message('Nu există produse active de listat.')
        return
      }
      if (p.listedProductCount >= p.activeProductCount) {
        toast.message('Toate produsele active sunt deja listate.')
        return
      }
      setBatchBusyId(p.id)
      try {
        const { updatedCount } = await postProducerProductsListed(p.id, true)
        mergeProducer(p.id, { listedProductCount: p.activeProductCount })
        toast.success(`${updatedCount} produse listate în magazinul asociației.`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Nu am putut lista produsele.')
      } finally {
        setBatchBusyId(null)
      }
    },
    [batchBusyId, canManageProducts, mergeProducer, router]
  )

  const submitAllocate = useCallback(
    async (role: AssociationRole) => {
      const target = allocateTarget
      if (!target?.ownerEmail?.trim()) return
      setAllocateBusy(true)
      try {
        const res = await fetch('/api/association/members', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: target.ownerEmail.trim(), role }),
        })
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        if (!res.ok) {
          const msg = json && typeof json === 'object' && json.error?.message
          toast.error(typeof msg === 'string' ? msg : 'Nu am putut aloca rolul.')
          return
        }
        toast.success(`${target.nume_ferma} a primit rol de ${roleLabelRo(role)}.`)
        setAllocateTarget(null)
        refreshProducers()
      } finally {
        setAllocateBusy(false)
      }
    },
    [allocateTarget, refreshProducers]
  )

  const openChangeDialog = useCallback((p: AssociationProducer) => {
    const others = ALLOC_ROLES.map((r) => r.value).filter((r) => r !== p.associationRole) as AssociationRole[]
    setChangeRole(others[0] ?? 'viewer')
    setChangeTarget(p)
  }, [])

  const submitChangeRole = useCallback(async () => {
    if (!changeTarget?.associationMemberId) return
    setChangeBusy(true)
    try {
      const res = await fetch('/api/association/members', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: changeTarget.associationMemberId, role: changeRole }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const msg = json && typeof json === 'object' && json.error?.message
        toast.error(typeof msg === 'string' ? msg : 'Nu am putut actualiza rolul.')
        return
      }
      toast.success('Rol actualizat.')
      setChangeTarget(null)
      refreshProducers()
    } finally {
      setChangeBusy(false)
    }
  }, [changeTarget, changeRole, refreshProducers])

  const submitRevoke = useCallback(async () => {
    if (!revokeTarget?.associationMemberId) return
    setRevokeBusy(true)
    try {
      const res = await fetch('/api/association/members', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: revokeTarget.associationMemberId }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const msg = json && typeof json === 'object' && json.error?.message
        toast.error(typeof msg === 'string' ? msg : 'Nu am putut revoca accesul.')
        return
      }
      toast.success(`Accesul la workspace a fost revocat pentru ${revokeTarget.nume_ferma}.`)
      setRevokeTarget(null)
      refreshProducers()
    } finally {
      setRevokeBusy(false)
    }
  }, [revokeTarget, refreshProducers])

  const renderRoleSection = (p: AssociationProducer) => {
    if (!canManageAssociationRoles) return null

    const self = Boolean(currentUserId && p.ownerUserId && currentUserId === p.ownerUserId)
    const canAllocate = Boolean(p.ownerUserId && p.ownerEmail?.trim())

    return (
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
            {p.associationRole == null ? (
              <span className="text-[12px] font-medium leading-snug text-[var(--text-secondary)]">
                Fără acces la workspace
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">{producerRoleBadge(p.associationRole)}</div>
            )}
          </div>

          {p.associationRole == null ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAllocate || allocateBusy}
                title={!canAllocate ? 'Nu există email pentru contul fermierului.' : undefined}
                className="h-8 text-[12px] font-semibold"
                onClick={() => setAllocateTarget(p)}
              >
                Alocă rol
                <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={self}
                title={self ? 'Nu îți poți schimba propriul rol din aici.' : undefined}
                className="h-8 text-[12px] font-semibold"
                onClick={() => openChangeDialog(p)}
              >
                Schimbă
                <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={self}
                title={self ? 'Nu îți poți revoca singur accesul.' : undefined}
                className="h-8 border-[var(--status-danger-border)] text-[12px] font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => setRevokeTarget(p)}
              >
                Revocă
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const cardActions = (p: AssociationProducer) => (
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canManageProducts ? (
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openProfileEditor(p)}>
            ✏️ Editează profil
          </Button>
        ) : null}
        <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
          <Link href={`/asociatie/produse?producer=${encodeURIComponent(p.id)}`}>
            <Store className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Vezi produsele
          </Link>
        </Button>
        {canManageProducts ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            disabled={
              p.activeProductCount === 0 || batchBusyId === p.id || p.listedProductCount >= p.activeProductCount
            }
            onClick={() => void batchListAll(p)}
          >
            <ListChecks className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {batchBusyId === p.id ? 'Se procesează…' : 'Listează toate produsele'}
          </Button>
        ) : null}
      </div>
      {renderRoleSection(p)}
    </div>
  )

  const cardInner = (p: AssociationProducer) => (
    <>
      <div className="flex gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-[var(--shadow-soft)]"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in oklab, var(--agri-primary) 92%, black), var(--agri-primary))',
          }}
          aria-hidden
        >
          {farmInitials(p.nume_ferma)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
            {p.nume_ferma}
          </h3>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="tabular-nums">{p.activeProductCount}</span> produse active ·{' '}
            <span className="tabular-nums">{p.listedProductCount}</span> listate în magazin
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">{approvedBadge()}</div>
        </div>
      </div>
      {cardActions(p)}
    </>
  )

  const allocateSheetOrDialog = (
    <>
      {isMobile ? (
        <Sheet open={allocateTarget != null} onOpenChange={(o) => !o && setAllocateTarget(null)}>
          <SheetContent side="bottom" className="z-[1002]">
            <SheetHeader>
              <SheetTitle>Alege rol workspace</SheetTitle>
              <SheetDescription>
                {allocateTarget ? (
                  <>
                    Producător: <span className="font-medium text-[var(--text-primary)]">{allocateTarget.nume_ferma}</span>
                  </>
                ) : null}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2 pb-4">
              {ALLOC_ROLES.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start py-3 text-left"
                  disabled={allocateBusy}
                  onClick={() => void submitAllocate(r.value)}
                >
                  <span className="block font-semibold">{r.label}</span>
                  <span className="block text-xs font-normal text-[var(--text-secondary)]">{r.hint}</span>
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={allocateTarget != null} onOpenChange={(o) => !o && setAllocateTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Alocă rol workspace</DialogTitle>
              <DialogDescription>
                {allocateTarget ? (
                  <>
                    Producător:{' '}
                    <span className="font-medium text-[var(--text-primary)]">{allocateTarget.nume_ferma}</span>
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {ALLOC_ROLES.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start py-3 text-left"
                  disabled={allocateBusy}
                  onClick={() => void submitAllocate(r.value)}
                >
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block text-xs font-normal text-[var(--text-secondary)]">{r.hint}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={changeTarget != null} onOpenChange={(o) => !o && setChangeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schimbă rol</DialogTitle>
            <DialogDescription>
              {changeTarget ? (
                <>
                  Producător:{' '}
                  <span className="font-medium text-[var(--text-primary)]">{changeTarget.nume_ferma}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Rol nou</Label>
            <Select value={changeRole} onValueChange={(v) => setChangeRole(v as AssociationRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {changeTarget
                  ? ALLOC_ROLES.filter((r) => r.value !== changeTarget.associationRole).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)]">{ALLOC_ROLES.find((r) => r.value === changeRole)?.hint}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setChangeTarget(null)}>
              Anulează
            </Button>
            <Button type="button" disabled={changeBusy} onClick={() => void submitChangeRole()}>
              {changeBusy ? 'Se salvează…' : 'Salvează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeTarget != null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoci accesul la workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget ? (
                <>
                  <strong>{revokeTarget.nume_ferma}</strong> nu va mai avea acces la echipa Gustă din Bucovina.
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
    </>
  )

  return (
    <AppShell header={<PageHeader title="Producători" subtitle="Fermieri aprobați în asociație" />}>
      <div className="mx-auto w-full max-w-6xl pb-10 md:pb-8">
        <p className="mb-4 text-sm text-[var(--text-secondary)] md:mb-6">
          Aprobarea fermierilor pentru vitrina „Gustă din Bucovina” este gestionată de administratorul Zmeurel.ro. Aici
          vezi producătorii aprobați și poți lista produsele lor în magazinul asociației (admin / moderator).
        </p>

        {producers.length === 0 ? (
          <AppCard className="py-12 text-center text-sm text-[var(--text-secondary)]">
            Nu există producători aprobați încă. După ce un fermier este aprobat în panoul admin, va apărea aici.
          </AppCard>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {producers.map((p) => (
                <AppCard key={p.id} className="hidden md:block">
                  {cardInner(p)}
                </AppCard>
              ))}
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {producers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobileId(p.id)}
                  className={cn(
                    'w-full rounded-[var(--agri-radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-[var(--shadow-soft)] transition-transform active:scale-[0.985]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                      style={{
                        background:
                          'linear-gradient(135deg, color-mix(in oklab, var(--agri-primary) 92%, black), var(--agri-primary))',
                      }}
                    >
                      {farmInitials(p.nume_ferma)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[var(--text-primary)]">{p.nume_ferma}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {p.activeProductCount} active · {p.listedProductCount} listate
                      </div>
                      <div className="mt-2">{approvedBadge()}</div>
                      {canManageAssociationRoles && p.associationRole ? (
                        <div className="mt-2">{producerRoleBadge(p.associationRole)}</div>
                      ) : canManageAssociationRoles && !p.associationRole ? (
                        <div className="mt-2 text-[11px] text-[var(--text-muted)]">Fără acces workspace</div>
                      ) : null}
                    </div>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success-text)]" aria-hidden />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {allocateSheetOrDialog}

      <ProducerProfileEditor
        producer={profileTarget}
        open={profileTarget != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setProfileTarget(null)
        }}
        onSaved={(producerId, patch) => {
          mergeProducer(producerId, patch)
          refreshProducers()
          setProfileTarget(null)
        }}
      />

      <AppDrawer
        open={mobileId != null}
        onOpenChange={(o) => {
          if (!o) setMobileId(null)
        }}
        title={mobileProducer?.nume_ferma ?? 'Producător'}
        description={mobileProducer ? 'Detalii și acțiuni' : undefined}
      >
        {mobileProducer ? (
          <div className="space-y-4 pb-6">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="tabular-nums font-semibold">{mobileProducer.activeProductCount}</span> produse active ·{' '}
              <span className="tabular-nums font-semibold">{mobileProducer.listedProductCount}</span> listate în magazin
            </p>
            <div>{approvedBadge()}</div>
            {cardInner(mobileProducer)}
          </div>
        ) : null}
      </AppDrawer>
    </AppShell>
  )
}
