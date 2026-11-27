'use client'

import type { ReactNode } from 'react'
import { EllipsisVertical, Share, SquarePlus } from 'lucide-react'

import { BottomSheet, Button, kitText } from '@/components/kit'
import { cereInstalarea, esteIphone } from '@/lib/pwa/instalare'
import { cn } from '@/lib/utils'

import { useInstalare } from './useInstalare'

function Pas({ numar, children, icon }: { numar: number; children: ReactNode; icon: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary', kitText.base)} aria-hidden>
        {numar}
      </span>
      <span className={cn('flex min-w-0 flex-1 items-center gap-2 pt-1.5 text-fg', kitText.base)}>
        <span className="min-w-0 break-words">{children}</span>
        <span className="shrink-0 text-fg-muted [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
      </span>
    </li>
  )
}

/**
 * „Pune Caietul pe ecranul telefonului” (promptul 34, §4): pe Android cu promptul prins, butonul sistemului; pe
 * iPhone, pașii din Safari (Distribuie → Adaugă pe ecranul principal); pe Android fără prompt, meniul browserului.
 */
export function FoaieInstalare({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { arePrompt } = useInstalare()
  const iphone = typeof navigator !== 'undefined' && esteIphone(navigator.userAgent)
  const cuPrompt = arePrompt && !iphone

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pune Caietul pe ecranul telefonului"
      description="Se deschide ca o aplicație, dintr-o atingere, fără să cauți adresa."
      footer={
        cuPrompt ? (
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            onClick={async () => {
              const acceptat = await cereInstalarea()
              if (acceptat) onOpenChange(false)
            }}
          >
            Instalează
          </Button>
        ) : (
          <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => onOpenChange(false)}>
            Am înțeles
          </Button>
        )
      }
    >
      {cuPrompt ? (
        <p className={cn('text-fg', kitText.base)}>Apasă „Instalează”, apoi confirmă în fereastra telefonului.</p>
      ) : iphone ? (
        <ol className="space-y-3" aria-label="Pașii pe iPhone">
          <Pas numar={1} icon={<Share />}>
            În Safari, apasă Distribuie (pătratul cu săgeata)
          </Pas>
          <Pas numar={2} icon={<SquarePlus />}>
            Alege „Adaugă pe ecranul principal”
          </Pas>
        </ol>
      ) : (
        <ol className="space-y-3" aria-label="Pașii pe Android">
          <Pas numar={1} icon={<EllipsisVertical />}>
            Apasă meniul browserului (cele 3 puncte)
          </Pas>
          <Pas numar={2} icon={<SquarePlus />}>
            Alege „Instalează aplicația” sau „Adaugă pe ecranul principal”
          </Pas>
        </ol>
      )}
    </BottomSheet>
  )
}
