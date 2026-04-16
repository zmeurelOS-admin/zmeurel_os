'use client'

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const faqItems = [
  { question: 'Cât costă?', answer: 'Aplicația este gratuită în perioada de beta.' },
  { question: 'Trebuie instalată?', answer: 'Nu. Funcționează direct din browser, pe orice telefon sau calculator.' },
  { question: 'Merge pe Android și iPhone?', answer: 'Da, pe orice telefon cu browser modern.' },
  { question: 'Datele mele sunt în siguranță?', answer: 'Da. Datele sunt salvate în cloud și doar tu ai acces la ferma ta.' },
  { question: 'Pot folosi pentru solarii sau livezi?', answer: 'Da — fructe de pădure, solarii, livezi și orice alt tip de fermă.' },
  { question: 'Ce e magazinul pentru asociații?', answer: 'Un magazin public unde producătorii unei asociații vând împreună, cu branding comun și administrare centralizată.' },
  { question: 'Cum primesc ajutor?', answer: 'Scrie-mi direct pe WhatsApp și te ajut.' },
]

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <SectionShell label="Întrebări frecvente" className="bg-[#FAFAF6] py-16 md:py-24">
      <SectionIntro badge="Răspunsuri rapide" title="Întrebări frecvente" />

      <div className="mx-auto mt-10 max-w-2xl space-y-3">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index

          return (
            <article key={item.question} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-inset"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span className="text-sm font-semibold text-slate-800 md:text-base">{item.question}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F5EE] text-[#2D6A4F]">
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
              {isOpen ? <p className="px-5 pb-5 text-sm leading-7 text-slate-500">{item.answer}</p> : null}
            </article>
          )
        })}
      </div>
    </SectionShell>
  )
}
