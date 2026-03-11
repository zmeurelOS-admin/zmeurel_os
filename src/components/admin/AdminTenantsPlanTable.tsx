'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BETA_MODE, BETA_PLAN_LABEL } from '@/lib/config/beta'
import { getEffectivePlan, type SubscriptionPlan } from '@/lib/subscription/plans'

export interface AdminTenantRow {
  tenant_id: string
  tenant_name: string
  owner_email: string | null
  plan: string | null
  created_at: string | null
  parcels_count: number
  users_count: number
}

interface PendingPlanChange {
  tenantId: string
  tenantName: string
  currentPlan: SubscriptionPlan
  nextPlan: SubscriptionPlan
}

interface AdminTenantsPlanTableProps {
  initialRows: AdminTenantRow[]
}

const PLAN_OPTIONS: SubscriptionPlan[] = ['freemium', 'pro', 'enterprise']

function normalizePlan(value: string | null | undefined): SubscriptionPlan {
  if (value === 'pro' || value === 'enterprise') {
    return value
  }
  return 'freemium'
}

function planBadgeClass(plan: SubscriptionPlan): string {
  if (plan === 'pro') return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  if (plan === 'enterprise') return 'border-slate-300 bg-slate-100 text-slate-800'
  return 'border-amber-300 bg-amber-50 text-amber-800'
}

export function AdminTenantsPlanTable({ initialRows }: AdminTenantsPlanTableProps) {
  const [rows, setRows] = useState<AdminTenantRow[]>(initialRows)
  const [pendingChange, setPendingChange] = useState<PendingPlanChange | null>(null)

  const updatePlanMutation = useMutation({
    mutationFn: async (payload: PendingPlanChange) => {
      const response = await fetch('/api/admin/tenant-plan', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: payload.tenantId,
          plan: payload.nextPlan,
        }),
      })

      const result = (await response.json()) as {
        ok?: boolean
        error?: string
        code?: string | null
        details?: string | null
        hint?: string | null
      }

      if (!response.ok || !result.ok) {
        const errorParts = [result.error, result.code, result.details, result.hint].filter(Boolean)
        throw new Error(errorParts.join(' | ') || 'Nu am putut actualiza planul.')
      }

      return result
    },
    onSuccess: (_data, payload) => {
      setRows((current) =>
        current.map((row) =>
          row.tenant_id === payload.tenantId
            ? {
                ...row,
                plan: payload.nextPlan,
              }
            : row
        )
      )
      toast.success(`Plan actualizat la ${payload.nextPlan} pentru ${payload.tenantName}.`)
      setPendingChange(null)
    },
    onError: (error) => {
      const message = (error as { message?: string })?.message ?? 'Nu am putut actualiza planul.'
      if (message.includes('FORBIDDEN')) {
        toast.error('Doar superadmin poate modifica planurile tenanților.')
        return
      }
      if (message.includes('INVALID_PLAN')) {
        toast.error('Plan invalid. Alege Freemium, Pro sau Enterprise.')
        return
      }
      toast.error(message)
    },
  })

  return (
    <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Tenanti</CardTitle>
        <CardDescription>
          Superadmin poate vedea toate fermele ți poate modifica planul de abonament.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          Actiunile de schimbare plan sunt protejate prin rolul `is_superadmin`.
        </div>
        {BETA_MODE ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Plan management disabled during beta.
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            Nu exist? tenanți disponibili.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fermă</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Creat la</TableHead>
                <TableHead className="text-right">Terenuri</TableHead>
                <TableHead className="text-right">Utilizatori</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const tenantPlan = normalizePlan(row.plan)
                const currentPlan = getEffectivePlan(tenantPlan)
                const createdAt = row.created_at ? row.created_at.slice(0, 10) : '-'
                const planLabel = BETA_MODE ? BETA_PLAN_LABEL : currentPlan

                return (
                  <TableRow key={row.tenant_id}>
                    <TableCell className="font-semibold text-[var(--agri-text)]">{row.tenant_name}</TableCell>
                    <TableCell>{row.owner_email ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex min-w-[190px] items-center gap-2">
                        <Badge variant="outline" className={planBadgeClass(currentPlan)}>
                          {planLabel}
                        </Badge>
                        <Select
                          value={tenantPlan}
                          disabled={BETA_MODE}
                          onValueChange={(value: SubscriptionPlan) => {
                            const nextPlan = normalizePlan(value)
                            if (nextPlan === tenantPlan) {
                              return
                            }
                            setPendingChange({
                              tenantId: row.tenant_id,
                              tenantName: row.tenant_name,
                              currentPlan: tenantPlan,
                              nextPlan,
                            })
                          }}
                        >
                          <SelectTrigger className="h-9 w-[130px]">
                            <SelectValue placeholder="Schimba plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((plan) => (
                              <SelectItem key={plan} value={plan}>
                                {plan}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>{createdAt}</TableCell>
                    <TableCell className="text-right font-semibold">{row.parcels_count}</TableCell>
                    <TableCell className="text-right font-semibold">{row.users_count}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={Boolean(pendingChange)} onOpenChange={(open) => (!open ? setPendingChange(null) : null)}>
        <AlertDialogContent className="w-[95%] max-w-md overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="px-6 pt-6">Confirmi schimbarea planului?</AlertDialogTitle>
            <AlertDialogDescription className="px-6 pb-2">
              {pendingChange
                ? `Ferma ${pendingChange.tenantName} va fi schimbata din ${pendingChange.currentPlan} in ${pendingChange.nextPlan}.`
                : 'Selecteaza un plan pentru confirmare.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 border-t px-6 py-4">
            <AlertDialogCancel className="w-full sm:w-auto">Anulează</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                className="w-full bg-[var(--agri-primary)] text-white hover:bg-emerald-700 sm:w-auto"
                disabled={!pendingChange || updatePlanMutation.isPending}
                onClick={() => {
                  if (!pendingChange) return
                  updatePlanMutation.mutate(pendingChange)
                }}
              >
                {updatePlanMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se salvează...
                  </>
                ) : (
                  'Confirma'
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
