import Reveal from '@/components/landing/reveal'

const faqItems = [
  {
    question: 'Cât costă?',
    answer: 'Aplicația este gratuită în perioada de beta.',
  },
  {
    question: 'Trebuie instalată aplicația?',
    answer: 'Nu. Funcționează direct din browser, pe orice telefon sau calculator.',
  },
  {
    question: 'Pot să o folosesc și pe calculator?',
    answer: 'Da, funcționează pe orice dispozitiv cu browser — telefon, tabletă sau calculator.',
  },
  {
    question: 'Merge pe Android și iPhone?',
    answer: 'Da, pe orice telefon cu browser modern.',
  },
  {
    question: 'Datele mele sunt în siguranță?',
    answer: 'Da. Datele sunt salvate în cloud și doar tu ai acces la ferma ta.',
  },
  {
    question: 'Pot folosi aplicația pentru solarii sau livezi?',
    answer: 'Da, aplicația funcționează pentru fructe de pădure, solarii, livezi și orice alt tip de fermă.',
  },
  {
    question: 'Cum primesc ajutor?',
    answer: 'Scrie-mi direct pe WhatsApp și te ajut.',
  },
]

export default function Faq() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-raspberry)] uppercase">
          Răspunsuri rapide
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
          Întrebări frecvente
        </h2>
      </Reveal>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4">
        {faqItems.map((item, index) => (
          <Reveal
            key={item.question}
            delayMs={index * 70}
            className="rounded-[24px] border border-[color:rgba(49,46,63,0.08)] bg-white p-6 shadow-[0_10px_28px_rgba(49,46,63,0.06)]"
          >
            <h3 className="text-lg font-semibold text-[var(--landing-dark)]">{item.question}</h3>
            <p className="mt-3 text-sm leading-6 text-[color:var(--agri-text-muted)]">{item.answer}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
