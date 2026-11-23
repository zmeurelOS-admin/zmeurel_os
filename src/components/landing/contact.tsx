import { MessageCircle } from 'lucide-react'

import { buttonVariants, kitText } from '@/components/kit'
import { SectionShell, SectionTitle } from '@/components/landing/landing-shared'
import { SUPPORT_WHATSAPP_URL } from '@/lib/support'
import { cn } from '@/lib/utils'
import { CONTACT_EMAIL } from '@/lib/brand'

/** Contactul: WhatsApp și email. */
export function Contact() {
  return (
    <SectionShell label="Contact">
      <SectionTitle>Scrie-mi</SectionTitle>
      <p className={cn(kitText.secondary, 'mt-1 text-fg-muted')}>Răspund eu, Andrei. De obicei în aceeași zi.</p>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full sm:w-auto sm:px-6')}
        >
          <MessageCircle aria-hidden />
          Scrie-mi pe WhatsApp
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`} className={cn(buttonVariants({ variant: 'quiet', size: 'touch' }), 'w-full sm:w-auto sm:px-6')}>
          {CONTACT_EMAIL}
        </a>
      </div>
    </SectionShell>
  )
}
