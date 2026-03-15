'use client'

import { useMemo, useState } from 'react'
import { MessageCircleMore, Loader2 } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { AppDialog } from '@/components/app/AppDialog'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import { toast } from '@/lib/ui/toast'

const RATING_OPTIONS = [
  { value: 1, emoji: ':(' },
  { value: 2, emoji: ':/' },
  { value: 3, emoji: ':|' },
  { value: 4, emoji: ':)' },
  { value: 5, emoji: '<3' },
] as const

export function HeaderBetaBadge() {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2 text-[12px] font-semibold leading-none text-emerald-900">
      BETA
    </span>
  )
}

export function HeaderFeedbackButton() {
  const { userId } = useDashboardAuth()
  const pathname = usePathname()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number>(4)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(
    () => message.trim().length > 0 && rating >= 1 && rating <= 5,
    [message, rating]
  )

  const submitFeedback = async () => {
    if (!userId || !canSubmit || submitting) return
    setSubmitting(true)

    try {
      const supabase = getSupabase()
      const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
      if (!tenantId) throw new Error('Tenant indisponibil pentru feedback.')

      const { error: insertError } = await supabase
        .from('feedback' as never)
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          rating,
          message: message.trim(),
          page_url: pathname || '/',
        } as never)

      if (insertError) throw insertError

      track('feedback_sent', { rating, page: pathname || '/' })
      toast.success('Mulțumim pentru feedback!')
      setMessage('')
      setRating(4)
      setFeedbackOpen(false)
    } catch (error) {
      const resolved = error instanceof Error ? error.message : 'Nu am putut trimite feedback-ul.'
      toast.error(resolved)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-[27px] items-center gap-1.5 rounded-full border border-[var(--agri-border)] bg-white/96 px-2.5 text-[12px] font-medium text-[var(--agri-text)] shadow-sm transition hover:bg-[var(--agri-surface-muted)]"
        onClick={() => {
          track('feedback_header_click', { page: pathname || '/' })
          setFeedbackOpen(true)
        }}
      >
        <MessageCircleMore className="h-3.5 w-3.5" />
        Feedback
      </button>

      <AppDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        title="Trimite feedback"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFeedbackOpen(false)}>
              Anulează
            </Button>
            <Button type="button" onClick={submitFeedback} disabled={!canSubmit || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se trimite...
                </>
              ) : (
                'Trimite'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            placeholder="Ce funcționează bine? Ce ai îmbunătăți?"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28"
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--agri-text)]">Cum ți se pare experiența?</p>
            <div className="flex items-center gap-2">
              {RATING_OPTIONS.map((option) => {
                const selected = rating === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`Rating ${option.value}`}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-xl ${
                      selected
                        ? 'border-amber-600 bg-amber-100'
                        : 'border-[var(--agri-border)] bg-white hover:bg-[var(--agri-surface-muted)]'
                    }`}
                    onClick={() => setRating(option.value)}
                  >
                    {option.emoji}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </AppDialog>
    </>
  )
}

export function BetaBanner() {
  return null
}

export function resetBetaBannerDismissal() {
  // preserved for compatibility with existing imports/tests
}
