'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Check,
  Facebook,
  Instagram,
  Menu,
  Minus,
  Plus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const navLinks = [
  { href: '#functionalitati', label: 'Funcționalități' },
  { href: '#planuri', label: 'Planuri' },
  { href: '#despre', label: 'Despre' },
]

const probleme = [
  {
    emoji: '📓',
    titlu: 'Caietul cu totul',
    text:
      'Notezi recolta, cheltuielile, vânzările — în caiet. Dar când vrei să calculezi cât te-a costat un kilogram de zmeură, trebuie să răsfoiești 40 de pagini.',
  },
  {
    emoji: '📊',
    titlu: 'Excel-ul de pe laptop',
    text:
      'Poate ai un fișier Excel. Dar când ești în câmp, laptopul e acasă. Și fișierul de anul trecut... unde era?',
  },
  {
    emoji: '🤷',
    titlu: 'Presupunerile',
    text:
      'Simți că merge bine, dar nu știi sigur. Care teren produce mai bine?? Câte kilograme a cules fiecare culegător azi?? Câți bani ai pierdut pe un client?',
  },
]

const functionalitati = [
  {
    emoji: '🗺️',
    titlu: 'Terenuri',
    text: 'Creează-ți harta fermei: fiecare teren cu soiul, suprafața și numărul de plante.',
  },
  {
    emoji: '✂️',
    titlu: 'Activități',
    text: 'Notează tratamente, tăieri, fertilizări — direct din câmp, în câteva secunde.',
  },
  {
    emoji: '🫐',
    titlu: 'Recoltări',
    text: 'Înregistrează recolta zilnic, pe teren și pe culegător. Vezi exact cât culegi pe zi.',
  },
  {
    emoji: '💰',
    titlu: 'Vânzări & Comenzi',
    text: 'Urmărește fiecare vânzare, fiecare client, fiecare comandă — cu statusuri și notificări.',
  },
  {
    emoji: '📉',
    titlu: 'Cheltuieli',
    text: 'Vezi clar unde se duc banii: tratamente, forță de muncă, materiale, transport.',
  },
  {
    emoji: '📊',
    titlu: 'Dashboard',
    text: 'Totul rezumat pe un singur ecran: producție, venituri, cheltuieli, profit estimat.',
  },
]

const pasi = [
  {
    nr: '①',
    titlu: 'Creează-ți terenurile',
    text: 'Adaugă terenurile tale: soi, suprafață, număr de plante. Durează un minut.',
    placeholder: '[Placeholder: screenshot terenuri]',
  },
  {
    nr: '②',
    titlu: 'Notează zilnic',
    text: 'Ce ai făcut, cât ai cules, cui ai vândut. Direct de pe telefon, în câteva secunde.',
    placeholder: '[Placeholder: screenshot recoltări]',
  },
  {
    nr: '③',
    titlu: 'Vezi unde stai',
    text: 'Deschide dashboard-ul și ai imaginea completă: producție, cheltuieli, profit.',
    placeholder: '[Placeholder: screenshot dashboard]',
  },
]

const planuri = [
  {
    emoji: '🌱',
    nume: 'Sămânță',
    pret: 'Gratuit — pentru totdeauna',
    cta: 'Creează cont gratuit',
    nota: 'Perfect dacă vrei să testezi sau ai un teren mic.',
    recomandat: false,
    features: [
      '1 teren',
      'Activități agricole nelimitate',
      'Recoltări de bază',
      'Cheltuieli de bază',
      'Dashboard sumar',
      'Export tratamente PDF',
      '1 utilizator',
    ],
  },
  {
    emoji: '🫐',
    nume: 'Recoltă',
    pret: '49 lei/lună sau 399 lei/an (2 luni gratuite)',
    cta: 'Încearcă gratuit în beta',
    nota: 'Pentru fermierul activ care vrea evidență completă.',
    recomandat: true,
    features: [
      'Tot din Sămânță plus',
      'Terenuri nelimitate',
      'Culegători + raport per culegător',
      'Vânzări fructe și material săditor',
      'Comenzi cu statusuri',
      'Dashboard complet cu grafice',
      'Export date CSV și PDF',
      'Până la 3 utilizatori',
    ],
  },
  {
    emoji: '🏔️',
    nume: 'Livadă',
    pret: '99 lei/lună sau 799 lei/an (2 luni gratuite)',
    cta: 'Încearcă gratuit în beta',
    nota: 'Pentru ferme mai mari sau cu mai mulți clienți și culegători.',
    recomandat: false,
    features: [
      'Tot din Recoltă plus',
      'Utilizatori nelimitați',
      'Rapoarte avansate (profit per teren, per soi, per client)',
      'Liste de prețuri sezoniere',
      'Suport prioritar (WhatsApp)',
      'Acces prioritar la funcționalități noi',
    ],
  },
]

const faq = [
  {
    q: 'Trebuie să fiu expert în calculatoare?',
    a: 'Nu. Dacă poți folosi Facebook pe telefon, poți folosi Zmeurel OS. E gândit să fie simplu, cu pași clari.',
  },
  {
    q: 'Funcționează pe telefonul meu?',
    a: 'Da. Zmeurel OS funcționează pe orice telefon cu browser — iPhone sau Android. Îl poți instala pe ecranul principal ca o aplicație normală, fără App Store.',
  },
  {
    q: 'Ce se întâmplă cu datele mele?',
    a: 'Datele tale sunt ale tale. Le poți exporta oricând. Le poți șterge complet dacă vrei. Respectăm GDPR integral.',
  },
  {
    q: 'Funcționează fără internet?',
    a: 'Ai nevoie de internet pentru a salva datele, dar funcționează și cu semnal slab. Modul offline complet e planificat pentru viitor.',
  },
  {
    q: 'Este doar pentru zmeură?',
    a: 'Am început cu fructe de pădure (zmeură, mur), dar poți folosi Zmeurel OS pentru orice fermă mică — căpșuni, afine, coacăze, sau alte culturi.',
  },
  {
    q: 'Cât costă?',
    a: 'În perioada beta, totul e gratuit. După beta, planul de bază rămâne gratuit permanent. Planurile complete pornesc de la 49 lei/lună.',
  },
  {
    q: 'Pot exporta tratamentele pentru APIA?',
    a: 'Da. Poți exporta lista completă de tratamente aplicate pe fiecare teren, în format PDF.',
  },
  {
    q: 'Cine a făcut aplicația?',
    a: 'Andrei, fermier de zmeură din Suceava. Zmeurel este și marca fermei mele — nu e un proiect de laborator, e un instrument născut din nevoie reală.',
  },
]

function Placeholder({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-[var(--agri-border)] bg-white px-6 text-center text-sm font-medium italic text-[var(--agri-text-muted)]/80 shadow-sm ${className}`}
    >
      {text}
    </div>
  )
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [isHeroVisible, setIsHeroVisible] = useState(true)

  useEffect(() => {
    const heroElement = heroRef.current
    if (!heroElement) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroVisible(entry.isIntersecting)
      },
      {
        root: null,
        threshold: 0.15,
        rootMargin: '-64px 0px 0px 0px',
      },
    )

    observer.observe(heroElement)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      style={
        {
          '--landing-accent': '#F16B6B',
          '--landing-dark': '#312E3F',
          '--landing-soft': '#F9F9FB',
          '--landing-about': '#FFF5F3',
          '--landing-hero-start': 'var(--agri-primary)',
          '--landing-hero-end': '#2fa65e',
        } as CSSProperties
      }
      className="bg-white text-[var(--agri-text)]"
    >
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isHeroVisible
            ? 'border-transparent bg-transparent text-white'
            : 'border-b border-[var(--agri-border)] bg-white/90 shadow-sm backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className={`text-lg font-extrabold tracking-tight transition-colors ${
              isHeroVisible ? 'text-white' : 'text-[color:var(--landing-dark)]'
            }`}
          >
            Zmeurel OS
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition-colors ${
                  isHeroVisible
                    ? 'text-white/80 hover:text-white'
                    : 'text-[var(--agri-text-muted)] hover:text-[color:var(--landing-dark)]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">
            <Button
              asChild
              className={`agri-control text-white ${
                isHeroVisible ? 'bg-white/15 hover:bg-white/25' : 'bg-[color:var(--landing-accent)] hover:opacity-95'
              }`}
            >
              <Link href="/login">Intră în cont</Link>
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`md:hidden ${isHeroVisible ? 'text-white hover:bg-white/15' : ''}`}
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Deschide meniul"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t border-[var(--agri-border)] bg-white md:hidden">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 px-4 py-3 sm:px-6">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-[var(--agri-text-muted)] hover:bg-[var(--landing-soft)]"
                >
                  {link.label}
                </a>
              ))}
              <Button asChild className="mt-2 bg-[color:var(--landing-accent)] text-white hover:opacity-95">
                <Link href="/login">Intră în cont</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="-mt-16">
        <section
          ref={heroRef}
          className="flex min-h-[85vh] items-center bg-gradient-to-br from-[var(--landing-hero-start)] to-[var(--landing-hero-end)] pb-16 pt-24 md:pb-24 md:pt-28"
        >
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:px-6 lg:grid-cols-5 lg:items-center">
            <div className="space-y-6 lg:col-span-3">
              <h1 className="text-4xl font-bold leading-tight text-white md:text-6xl">
                Fermă ta. Cifrele tale. Pe telefon.
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-white/80">
                Zmeurel OS este aplicația de evidență agricolă construită de un fermier din Suceava, pentru fermieri.
                Terenuri, recoltări, cheltuieli, vânzări — totul într-un singur loc, direct de pe telefonul tău.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild className="agri-cta rounded-xl bg-amber-500 px-8 py-3 text-lg text-white hover:bg-amber-600">
                  <Link href="/register">Încearcă gratuit</Link>
                </Button>
                <Link href="/login" className="text-sm font-semibold text-white/70 underline underline-offset-4 hover:text-white">
                  Ai deja cont?? Intră aici
                </Link>
              </div>
              <p className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">
                ✓ Gratuit în perioada beta · Fără card bancar
              </p>
            </div>
            <div className="lg:col-span-2">
              <Placeholder
                text="[Screenshot: Dashboard pe telefon]"
                className="h-64 rounded-3xl border-4 border-white/30 bg-white/20 text-white/50 shadow-2xl sm:h-72 md:h-80"
              />
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <h2 className="text-center text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">Cunoști situația asta?</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {probleme.map((item) => (
                <Card key={item.titlu} className="border-[var(--agri-border)] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">{item.emoji}</CardTitle>
                    <CardTitle className="text-lg text-[color:var(--landing-dark)]">{item.titlu}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed text-[var(--agri-text-muted)]">{item.text}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="mt-8 text-center text-base font-semibold text-[var(--agri-text-muted)]">
              Dacă te regăsești, Zmeurel OS e construit exact pentru tine.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24" style={{ backgroundColor: '#F8FAF8' }}>
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:px-6 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">
                Totul într-un singur loc. Pe telefon.
              </h2>
              <p className="text-[var(--agri-text-muted)]">
                Zmeurel OS îți ține evidența completă a fermei. Introduci câteva date simple — ce ai făcut, cât ai
                cules, cui ai vândut — și vezi imediat unde stai: ce produce fiecare teren, cât cheltuiești, cât
                câștigi.
              </p>
              <p className="text-[var(--agri-text-muted)]">
                Nu trebuie să fii expert în calculatoare. Dacă poți folosi Facebook pe telefon, poți folosi Zmeurel OS.
              </p>
            </div>
            <Placeholder text="[Screenshot: Dashboard complet cu date demo]" className="h-64 sm:h-72" />
          </div>
        </section>

        <section id="functionalitati" className="bg-white py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <h2 className="text-center text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">
              Ce poți face cu Zmeurel OS
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {functionalitati.map((item, index) => {
                const accents = [
                  'border-l-green-500',
                  'border-l-amber-500',
                  'border-l-purple-500',
                  'border-l-blue-500',
                  'border-l-red-500',
                  'border-l-cyan-500',
                ] as const

                return (
                <Card key={item.titlu} className={`border-[var(--agri-border)] border-l-4 shadow-sm ${accents[index] ?? 'border-l-green-500'}`}>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">{item.emoji}</CardTitle>
                    <CardTitle className="text-lg text-[color:var(--landing-dark)]">{item.titlu}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed text-[var(--agri-text-muted)]">{item.text}</CardDescription>
                  </CardContent>
                </Card>
              )})}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24" style={{ backgroundColor: '#F8FAF8' }}>
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <h2 className="text-center text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">3 pași simpli</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {pasi.map((pas, index) => (
                <Card key={pas.titlu} className="relative border-[var(--agri-border)] shadow-sm">
                  <CardHeader>
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--landing-accent)] text-xl font-bold text-white">
                      {pas.nr}
                    </div>
                    {index < pasi.length - 1 ? (
                      <div className="absolute left-10 top-20 h-12 w-px bg-[color:var(--landing-accent)]/35 lg:hidden" />
                    ) : null}
                    <CardTitle className="text-lg text-[color:var(--landing-dark)]">{pas.titlu}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-[var(--agri-text-muted)]">{pas.text}</CardDescription>
                    <Placeholder text={pas.placeholder} className="h-44" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="despre" className="py-16 md:py-24" style={{ backgroundColor: 'var(--landing-about)' }}>
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:px-6 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">
                Făcut de un fermier. Pentru fermieri.
              </h2>
              <p className="text-[var(--agri-text-muted)]">Zmeurel OS nu a apărut într-un birou de IT.</p>
              <p className="text-[var(--agri-text-muted)]">
                Sunt Andrei din Suceava. Am o plantație mică de zmeură — Zmeurel. Aceleași ambalaje pe care poate
                le-ai văzut la piață, aceeași marcă.
              </p>
              <p className="text-[var(--agri-text-muted)]">
                Am început cu un caiet, am trecut pe Excel, și pentru că niciuna nu-mi răspundea la întrebarea „cât mă
                costă de fapt un kilogram de zmeură?”, am construit aplicația asta.
              </p>
              <p className="text-[var(--agri-text-muted)]">
                Zmeurel OS este instrumentul pe care mi l-am făcut pentru fermă mea. Acum îl ofer și ție.
              </p>
              <a
                href="https://www.facebook.com/ZMEUREL.ZMEURASUCEAVA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-semibold text-[color:var(--landing-dark)] underline-offset-4 hover:underline"
              >
                Vezi plantația Zmeurel pe Facebook →
              </a>
            </div>
            <Placeholder text="[Poză autentică din plantația Zmeurel]" className="h-64 sm:h-72" />
          </div>
        </section>

        <section id="planuri" className="bg-white py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <h2 className="text-center text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">
              Planuri simple, prețuri corecte
            </h2>
            <Card className="mx-auto mt-8 w-full max-w-2xl border-[var(--agri-border)] shadow-md">
              <CardHeader className="space-y-3">
                <span className="inline-flex w-fit rounded-full bg-[color:var(--landing-accent)]/10 px-3 py-1 text-xs font-bold text-[color:var(--landing-accent)]">
                  🎁 Beta 2026
                </span>
                <CardTitle className="text-2xl text-[color:var(--landing-dark)]">Acces complet gratuit</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-[var(--agri-text-muted)]">
                  În perioada beta, toate funcționalitățile sunt disponibile gratuit pentru toți utilizatorii.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2">
                  {[
                    'Terenuri nelimitate',
                    'Recoltări, vânzări, comenzi',
                    'Dashboard complet cu grafice',
                    'Export CSV și PDF',
                    'Fără card bancar',
                    'Fără obligații',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--agri-text-muted)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--landing-accent)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="agri-control w-full bg-[color:var(--landing-accent)] text-white hover:opacity-95">
                  <Link href="/register">Creează cont gratuit</Link>
                </Button>
                <p className="text-xs text-[var(--agri-text-muted)]">
                  După beta, planul de bază rămâne gratuit permanent. Planurile premium vor porni de la 49 lei/lună.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 md:py-24" style={{ backgroundColor: '#F8FAF8' }}>
          <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6">
            <h2 className="text-center text-2xl font-black text-[color:var(--landing-dark)] sm:text-3xl">Întrebări frecvente</h2>
            <div className="mt-8 space-y-4">
              {faq.map((item, index) => {
                const expanded = openFaq === index
                return (
                  <Card key={item.q} className="border-[var(--agri-border)] shadow-sm transition-colors hover:bg-gray-50">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-6 py-6 text-left"
                      onClick={() => setOpenFaq(expanded ? null : index)}
                      aria-expanded={expanded}
                    >
                      <span className="text-sm font-semibold text-[color:var(--landing-dark)] sm:text-base">{item.q}</span>
                      {expanded ? (
                        <Minus className="h-4 w-4 shrink-0 text-[color:var(--landing-accent)]" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-[color:var(--landing-accent)]" />
                      )}
                    </button>
                    {expanded ? (
                      <CardContent className="pb-5 pt-0 text-sm leading-relaxed text-[var(--agri-text-muted)]">
                        {item.a}
                      </CardContent>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-[var(--landing-hero-start)] to-[var(--landing-hero-end)] py-16 md:py-24">
          <div className="mx-auto w-full max-w-[900px] px-4 text-center text-white sm:px-6">
            <h2 className="text-2xl font-black sm:text-3xl">Gata să-ți ții evidența fermei din telefon?</h2>
            <p className="mt-3 text-sm sm:text-base">Creează cont gratuit. Fără obligații, fără card bancar.</p>
            <Button asChild className="agri-cta mt-6 bg-amber-500 px-8 text-white hover:bg-amber-600">
              <Link href="/register">Creează cont gratuit</Link>
            </Button>
            <p className="mt-4 text-xs font-semibold sm:text-sm">Ai întrebări?? Scrie-ne la zmeurel@gmail.com</p>
          </div>
        </section>
      </main>

      <footer className="bg-[#312E3F] py-8 text-white">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-sm">© 2026 Zmeurel · Suceava, România</p>
          <div className="flex items-center justify-center gap-4 text-sm md:justify-start">
            <Link href="/termeni" className="text-white/70 hover:text-white hover:underline">Termeni și condiții</Link>
            <Link href="/confidentialitate" className="text-white/70 hover:text-white hover:underline">Politica de confidențialitate</Link>
          </div>
          <div className="flex items-center justify-center gap-3 md:justify-end">
            <a
              href="https://www.facebook.com/ZmeuraSuceava/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Zmeurel"
              className="rounded-md border border-white/30 p-2 text-white hover:text-white/80"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/zmeurel_sv/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Zmeurel"
              className="rounded-md border border-white/30 p-2 text-white hover:text-white/80"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
