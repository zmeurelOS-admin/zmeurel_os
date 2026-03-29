'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import { toast } from '@/lib/ui/toast'
import { isValidRomanianPhone, normalizePhone } from '@/lib/utils/phone'

export function OnboardingModal() {
  const { userId } = useDashboardAuth()
  const [open, setOpen] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Show modal only when profiles.phone IS NULL (DB-based gate)
  useEffect(() => {
    if (!userId) return

    const supabase = getSupabase()
    Promise.all([
      getTenantIdByUserIdOrNull(supabase, userId),
      supabase.from('profiles').select('phone').eq('id', userId).single(),
    ]).then(([resolvedTenantId, profileResult]) => {
      if (!resolvedTenantId) return
      setTenantId(resolvedTenantId)

      const profilePhone = profileResult.data?.phone
      if (!profilePhone) {
        setOpen(true)
      }
    }).catch(() => {
      // silently ignore
    })
  }, [userId])

  function handleClose() {
    setOpen(false)
  }

  async function handleSavePhone() {
    const cleaned = phone.trim()
    if (!isValidRomanianPhone(cleaned)) {
      setPhoneError('Număr invalid. Trebuie să înceapă cu 07 și să aibă 10 cifre.')
      return
    }
    setPhoneError('')

    setIsSaving(true)
    try {
      const res = await fetch('/api/profile/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error((payload as { error?: string }).error ?? 'Eroare la salvare.')
      }

      // Also backfill tenants.contact_phone if tenant has none yet
      if (tenantId) {
        const normalized = normalizePhone(cleaned)!
        const supabase = getSupabase()
        const { data: tenantRow } = await supabase
          .from('tenants')
          .select('contact_phone')
          .eq('id', tenantId)
          .single()
        if (!tenantRow?.contact_phone) {
          await supabase
            .from('tenants')
            .update({ contact_phone: normalized })
            .eq('id', tenantId)
        }
      }

      toast.success('Numărul a fost salvat. Te contactăm în curând!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nu am putut salva numărul. Încearcă din nou.'
      toast.error(msg)
    } finally {
      setIsSaving(false)
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="w-[95%] max-w-sm rounded-2xl border-0 bg-[var(--agri-surface)] p-6 shadow-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[var(--agri-text)]">
            Bun venit în Zmeurel! 🌿
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-[var(--agri-text-muted)]">
            Ești printre primii fermieri care testează aplicația. Pot să te sun 10 minute să înțeleg cum îți merge și să te ajut să începi?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Input
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (phoneError) setPhoneError('')
              }}
              className="h-12 text-base"
              inputMode="tel"
              autoComplete="tel"
            />
            {phoneError ? (
              <p className="text-xs text-[var(--soft-danger-text)]">{phoneError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="order-2 w-full sm:order-1 sm:w-auto"
              onClick={handleClose}
              disabled={isSaving}
            >
              Nu acum
            </Button>
            <Button
              type="button"
              className="order-1 w-full bg-[var(--agri-primary)] text-white hover:bg-emerald-700 sm:order-2 sm:w-auto"
              onClick={handleSavePhone}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                'Da, sună-mă'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
