'use client'

import { Copy, MessageCircle } from 'lucide-react'

import { Button, kitText } from '@/components/kit'
import { linkWhatsApp } from '@/lib/echipa/drepturi'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

export interface LinkInvitatieProps {
  rol: 'operator' | 'livrator'
  nume?: string | null
  telefon?: string | null
  link: string
}

async function copiaza(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Link copiat.')
  } catch {
    toast.error('Nu am putut copia. Ține apăsat pe link și copiază-l de mână.')
  }
}

/** Linkul generat, cu „Trimite pe WhatsApp” (link `wa.me`) și „Copiază linkul”. */
export function LinkInvitatie({ rol, nume, telefon, link }: LinkInvitatieProps) {
  return (
    <div className="space-y-2.5">
      <p
        className={cn('select-all break-all rounded-box border border-border bg-surface-muted px-3.5 py-3 font-semibold text-fg', kitText.secondary)}
        aria-label="Linkul de acces"
      >
        {link}
      </p>
      <Button asChild variant="primary" size="touch-lg" className="w-full">
        <a href={linkWhatsApp({ rol, nume, telefon, link })} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden />
          Trimite pe WhatsApp
        </a>
      </Button>
      <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => void copiaza(link)}>
        <Copy aria-hidden />
        Copiază linkul
      </Button>
    </div>
  )
}
