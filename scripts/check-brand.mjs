#!/usr/bin/env node
/**
 * `npm run check:brand` (promptul 33): pică la un „Zmeurel” nou în textele platformei (Caietul Fermei).
 *
 * Caută (fără majuscule) „zmeurel” în fișierele urmărite de git din `src/`, `public/` (fără `sw.js`) și
 * `supabase/functions/`. Nu se uită la teste, la tipurile generate și la comentarii (nu le vede omul).
 * Ce rămâne intenționat e în `EXCEPTII` (identificatorii tehnici, oriunde) și `EXCEPTII_FISIER` (rânduri anume),
 * fiecare cu motivul. `node scripts/check-brand.mjs --lista` scrie toate aparițiile rămase, cu motivul (pentru raport).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const RADACINI = ['src', 'public', 'supabase/functions']

/** Fișiere întregi care nu sunt text pentru om sau care sunt ale magazinului lui Andrei (`comanda.zmeurel.ro`). */
const FISIERE_IGNORATE = [
  { re: /^public\/sw\.js$/, motiv: 'generat la build din push-handlers.js' },
  { re: /^public\/workbox-[^/]+\.js$/, motiv: 'generat la build' },
  { re: /(^|\/)__tests__\//, motiv: 'teste' },
  { re: /\.test\.tsx?$/, motiv: 'teste' },
  { re: /^src\/types\/supabase\.ts$/, motiv: 'tipuri generate din bază' },
  { re: /^src\/app\/comanda\//, motiv: 'magazinul lui Andrei (comanda.zmeurel.ro)' },
  { re: /^src\/lib\/shop\/(campaign-mock|b2c-order-helpers|pricing)\.ts$/, motiv: 'magazinul lui Andrei și campania lui' },
  { re: /^public\/shop\//, motiv: 'iconițele magazinului' },
  { re: /\.(png|jpe?g|webp|ico|gif|woff2?|ttf|mp4|pdf)$/i, motiv: 'fișier binar' },
]

/** Identificatori tehnici, acceptați oriunde (nu se văd sau sunt adrese interne). */
const EXCEPTII = [
  { re: /x-zmeurel-/i, motiv: 'antetele interne x-zmeurel-*' },
  { re: /zmeurel[_:]/i, motiv: 'chei interne (localStorage, note, setări SQL)' },
  { re: /['"`]zmeurel-[a-z${]/i, motiv: 'chei și etichete interne (zmeurel-…)' },
  { re: /__zmeurel/i, motiv: 'marcaj intern' },
  { re: /@?(demo|operator)\.zmeurel\.local/i, motiv: 'domeniile conturilor demo / operator' },
  { re: /noreply@zmeurel\.local/i, motiv: 'subiectul VAPID (intern)' },
  { re: /comanda\.zmeurel\.ro/i, motiv: 'magazinul lui Andrei' },
  { re: /contact@zmeurel\.ro/i, motiv: 'adresa de contact până la NEXT_PUBLIC_CONTACT_EMAIL' },
  { re: /zmeurel\.permite_/i, motiv: 'setare de sesiune SQL' },
]

/** Rânduri anume, păstrate intenționat. */
const EXCEPTII_FISIER = [
  { fisier: 'src/components/landing/story.tsx', re: /Andrei, Ferma Zmeurel/, motiv: 'semnătura poveștii de pe prima pagină' },
  { fisier: 'src/app/manifest.ts', re: /(short_)?name: 'Zmeurel'/, motiv: 'ramura magazinului din manifest (host comanda.zmeurel.ro)' },
  { fisier: 'src/components/pwa/PWAInstallPrompt.tsx', re: /iconAlt = 'Zmeurel'/, motiv: 'promptul de instalare, folosit doar de magazin' },
  { fisier: 'src/lib/redirect-domeniu.ts', re: /zmeurel\.ro/, motiv: 'hosturile vechi din redirecționare' },
  { fisier: 'src/lib/supabase/queries/produse.ts', re: /Zmeurel OS/, motiv: 'potrivește textul unei erori din funcția SQL; omul vede alt mesaj' },
  { fisier: 'src/docs/gdpr-data-mapping.md', re: /fostul Zmeurel OS/, motiv: 'documentul spune numele vechi, ca istoric' },
]

const lista = process.argv.includes('--lista')

function fisiereUrmarite() {
  const iesire = execFileSync('git', ['ls-files', '-z', '--', ...RADACINI], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return iesire.split('\0').filter(Boolean)
}

function esteComentariu(rand) {
  const t = rand.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')
}

const abateri = []
const ramase = []

for (const fisier of fisiereUrmarite()) {
  const ignorat = FISIERE_IGNORATE.find((regula) => regula.re.test(fisier))
  let continut
  try {
    continut = readFileSync(fisier, 'utf8')
  } catch {
    continue
  }
  if (!/zmeurel/i.test(continut)) continue
  const randuri = continut.split(/\r?\n/)
  randuri.forEach((rand, index) => {
    if (!/zmeurel/i.test(rand)) return
    const loc = `${fisier}:${index + 1}`
    if (ignorat) {
      ramase.push({ loc, motiv: ignorat.motiv })
      return
    }
    if (esteComentariu(rand)) {
      ramase.push({ loc, motiv: 'comentariu' })
      return
    }
    // Fiecare apariție de pe rând trebuie acoperită de o excepție.
    const aparitii = [...rand.matchAll(/zmeurel/gi)]
    const neacoperite = aparitii.filter((potrivire) => {
      const fereastra = rand.slice(Math.max(0, potrivire.index - 40), potrivire.index + 40)
      if (EXCEPTII.some((regula) => regula.re.test(fereastra))) return false
      return !EXCEPTII_FISIER.some((regula) => regula.fisier === fisier && regula.re.test(rand))
    })
    if (neacoperite.length > 0) {
      abateri.push({ loc, text: rand.trim().slice(0, 160) })
      return
    }
    const motiv =
      EXCEPTII_FISIER.find((regula) => regula.fisier === fisier && regula.re.test(rand))?.motiv ??
      EXCEPTII.find((regula) => regula.re.test(rand))?.motiv ??
      'excepție'
    ramase.push({ loc, motiv })
  })
}

if (lista) {
  for (const { loc, motiv } of ramase) console.log(`${loc}\t${motiv}`)
  console.log(`\n${ramase.length} apariții rămase intenționat.`)
}

if (abateri.length > 0) {
  console.error(`\n❌ check:brand: ${abateri.length} „Zmeurel” în textele platformei. Folosește APP_NAME / APP_URL din src/lib/brand.ts`)
  console.error('   sau, dacă e intenționat (magazinul lui Andrei, un identificator tehnic), adaugă excepția în scripts/check-brand.mjs.\n')
  for (const { loc, text } of abateri) console.error(`  ${loc}  ${text}`)
  process.exit(1)
}

if (!lista) console.log(`✅ check:brand: niciun „Zmeurel” nou în textele platformei (${ramase.length} apariții rămase intenționat).`)
