import { kitText } from '@/components/kit'
import { SectionShell } from '@/components/landing/landing-shared'
import { cn } from '@/lib/utils'

/** „Gratuit cât e în beta” și rândul „Pentru asociații: în curând”. */
export function Beta() {
  return (
    <SectionShell label="Gratuit cât e în beta" className="py-6 md:py-8">
      <div className="rounded-card border border-success-border bg-success-bg p-4 text-success-text">
        <p className={cn(kitText.card, 'font-extrabold')}>Gratuit cât e în beta.</p>
        <p className={cn(kitText.secondary, 'mt-1')}>Datele sunt ale tale: le exporți oricând în Excel sau le ștergi.</p>
      </div>
      <p className={cn(kitText.secondary, 'mt-3 text-fg-muted')}>
        <span className="font-bold text-fg">Pentru asociații:</span> în curând.
      </p>
    </SectionShell>
  )
}
