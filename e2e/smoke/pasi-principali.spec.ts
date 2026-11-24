import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { ascultaErori, iesiDinCont, pornesteDemoNou } from './demo'

/**
 * Setul smoke (promptul 27, D): un singur demo nou „Fructe de pădure”, pașii principali în ordine, apoi
 * ieșirea din cont. Pașii depind unul de altul (aceeași pagină, același demo), deci rulează în serie.
 *
 *   1. Acasă se încarcă fără erori de consolă din aplicație;
 *   2. o recoltare (culegător, kg) → apare în listă;
 *   3. o comandă → „Pune în livrare” → livrată cu plată → stocul scade;
 *   4. o vânzare rapidă;
 *   5. o cheltuială fără bon;
 *   6. Tratamente → Analize: analiza din demo și raportul public deschis fără cont;
 *   7. Magazia (promptul 28): „+ Am cumpărat” Kelpak → un tratament făcut cu Kelpak („Repetă” stropirea demo) →
 *      stocul scade. Se sare, cu motivul scris, cât migrarea `20261122130000_magazia.sql` nu e aplicată;
 *   8. Capcanele (promptul 29): „+ Montează” Drosophila pe Delniwa Sud → „Verifică acum” cu 5 capturi în fiecare
 *      capcană (peste prag: 1 / capcană / săptămână) → apare „peste prag”. Se sare, cu motivul scris, cât migrarea
 *      `20261123100000_capcane.sql` nu e aplicată;
 *   9. Planul pe stadii (promptul 30): tab-ul Plan arată „E timpul pentru…” (planul demo „Zmeură <an>”, linia de
 *      „După recoltare”) → atingi intervenția → formularul de tratament vine completat → „Salvează · făcut” → în
 *      „Planul întreg” linia apare „făcut”. Nu cere migrare (tabelele de plan există deja);
 *  10. pe mobil (375 px), bara de jos are 5 taburi;
 *  11. prima pagină fără textele scoase (testimoniale, „locuri limitate”) și Login cu nota pentru operatori, fără cont;
 *  12. Mai mult fără „Clienți magazin” / „Analytics magazin”, iar „Planul tău” scrie „Gratuit în beta”;
 *  13–19 (promptul 33): Acasă cu vremea fără „Pune locul fermei” (demo-ul are parcele cu coordonate), foaia
 *      clopoțelului pe kit, Stocuri cu o filă pe cultură (fără „Mix fructe”) și „Pierdere” (doar cu migrarea
 *      20261125100000), Tratamente cu cele 4 taburi și rândul Magaziei, raportul public fără cookie-uri și cu
 *      `noindex`, foaia Stadiul pe lăstari la Maravilla, Setări. „La poartă” = „Vânzare rapidă” (pasul 4).
 *  Demo-ul trece prin ecranul de așteptare din `/start` (promptul 31): `pornesteDemoNou` îl verifică.
 */

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let page: Page
let erori: string[] = []
/** Calea raportului public (`/a/<token>`), găsită la pasul 6, verificată la pasul 17. */
let caleRaport: string | null = null

/** „Zmeură cal. I disponibilă: 1.234,5 kg …” → 1234.5 */
function kgDinText(text: string): number {
  const potrivire = text.match(/:\s*([\d.]+(?:,\d+)?)\s*kg/)
  if (!potrivire) throw new Error(`Nu găsesc kilogramele în „${text}”`)
  return Number(potrivire[1].replace(/\./g, '').replace(',', '.'))
}

async function stocCal1PeComenzi(p: Page): Promise<number> {
  await p.goto('/comenzi', { waitUntil: 'load' })
  const rand = p.getByText(/^Zmeură cal\. I disponibilă:/)
  await expect(rand).toBeVisible()
  return kgDinText((await rand.textContent()) ?? '')
}

async function apasaTaste(p: Page, tastatura: string, cifre: string) {
  const grup = p.getByRole('group', { name: tastatura })
  for (const cifra of cifre) await grup.getByRole('button', { name: cifra, exact: true }).click()
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  context = await browser.newContext()
  page = await context.newPage()
  erori = ascultaErori(page)
  await pornesteDemoNou(page)
})

test.afterAll(async ({ baseURL }) => {
  if (page) await iesiDinCont(page, baseURL ?? 'http://localhost:3000')
  await context?.close()
})

test('1. Acasă se încarcă fără erori de consolă din aplicație', async () => {
  erori.length = 0
  await page.goto('/dashboard', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Acasă', level: 1 })).toBeVisible()
  // Cultura vine din parcele (promptul 31): demo-ul are zmeură, deci eticheta e a zmeurei, cu date (nu „…”).
  await expect(page.getByRole('link', { name: /^Zmeură cal\. I disponibilă: [\d.,]+ kg/ })).toBeVisible()
  await page.waitForLoadState('networkidle').catch(() => undefined)
  expect(erori, `Erori de consolă pe Acasă:\n${erori.join('\n')}`).toEqual([])
})

test('2. o recoltare (culegător, kg) apare în listă', async () => {
  await page.goto('/recoltari', { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Adaugă kg' }).first().click()
  const foaie = page.getByRole('dialog', { name: 'Adaugă kilograme' })
  await foaie.getByRole('radio').first().click()

  // O parcelă fără pauză de tratament (altfel apare avertizarea înainte de salvare).
  await foaie.getByRole('button', { name: /^Parcela: .* — schimbă$/ }).click()
  await foaie.getByRole('radio').filter({ hasNotText: /Pauză/ }).first().click()

  await apasaTaste(page, 'Tastatură numerică', '7')
  await foaie.getByRole('button', { name: 'Salvează', exact: true }).click()
  await expect(foaie.getByRole('heading', { name: 'Salvat' })).toBeVisible()
  // „Elena Rusu · 7 kg · 17,50 lei”: numele culegătorului, ca să-l găsim în listă.
  const rezumat = (await foaie.getByText(/ · 7 kg · /).textContent()) ?? ''
  const nume = rezumat.split(' · ')[0].trim()
  expect(nume).not.toBe('')
  await foaie.getByRole('button', { name: 'Gata' }).click()

  await expect(page.getByRole('button', { name: `${nume}, 7 kg`, exact: false })).toBeVisible()
})

test('3. o comandă → „Pune în livrare” → livrată cu plată → stocul scade', async () => {
  const stocInainte = await stocCal1PeComenzi(page)

  await page.getByRole('button', { name: 'Comandă nouă' }).click()
  const foaie = page.getByRole('dialog', { name: 'Comandă nouă' })
  const client = foaie.getByRole('button', { name: /^Alege clientul / }).first()
  const numeClient = ((await client.getAttribute('aria-label')) ?? '').replace(/^Alege clientul /, '').trim()
  expect(numeClient).not.toBe('')
  await client.click()
  await foaie.getByRole('radio', { name: '5 kg' }).click()
  await foaie.getByRole('radio', { name: 'Azi', exact: true }).click()
  await foaie.getByRole('button', { name: 'Salvează comanda' }).click()
  await expect(foaie.getByRole('heading', { name: 'Comandă salvată' })).toBeVisible()
  await foaie.getByRole('button', { name: 'Gata' }).click()

  // „Pune în livrare azi”: bifăm doar comanda nouă (clientul ales, 5 kg).
  await page.getByRole('button', { name: /^Pune în livrare azi/ }).click()
  const livrare = page.getByRole('dialog', { name: 'Pune în livrare azi' })
  const escapat = numeClient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await livrare.getByRole('checkbox', { name: new RegExp(`^${escapat} .* 5 kg$`) }).click()
  await livrare.getByRole('button', { name: /^Trimite în Livrări \(1\)/ }).click()
  await expect(livrare).toBeHidden()

  // Livrări: oprirea comenzii noi → „Livrat” → plătit cash → „Da, livrat”.
  await page.goto('/livrari', { waitUntil: 'load' })
  const oprire = page.getByRole('region', { name: 'Următoarea oprire' })
  await expect(oprire).toContainText(numeClient)
  await expect(oprire).toContainText('5 kg')
  await oprire.getByRole('button', { name: 'Livrat', exact: true }).click()
  const confirmare = page.getByRole('dialog', { name: 'Confirmi livrarea?' })
  await expect(confirmare.getByRole('tab', { name: 'Cash' })).toHaveAttribute('aria-selected', 'true')
  await confirmare.getByRole('button', { name: 'Da, livrat' }).click()
  await expect(confirmare).toBeHidden()

  const stocDupa = await stocCal1PeComenzi(page)
  expect(stocDupa).toBeCloseTo(stocInainte - 5, 3)
})

test('4. o vânzare rapidă', async () => {
  await page.goto('/vanzari', { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Vânzare rapidă' }).click()
  const foaie = page.getByRole('dialog', { name: 'Vânzare rapidă' })
  await apasaTaste(page, 'Tastatură pentru cantitate', '3')
  await foaie.getByRole('button', { name: /Salvează$/ }).click()
  await expect(foaie.getByRole('heading', { name: 'Vândut și încasat' })).toBeVisible()
  await expect(foaie).toContainText('3 kg')
  await foaie.getByRole('button', { name: 'Gata' }).click()
  await expect(foaie).toBeHidden()
})

test('5. o cheltuială fără bon', async () => {
  await page.goto('/cheltuieli', { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Adaugă cheltuială' }).click()
  const foaie = page.getByRole('dialog', { name: 'Cheltuială nouă' })
  await foaie.getByRole('radio', { name: 'Ambalaje' }).click()
  await apasaTaste(page, 'Tastatură pentru sumă', '42')
  await foaie.getByRole('button', { name: /^Salvează( 42 lei)?$/ }).click()
  await expect(foaie.getByRole('heading', { name: 'Salvat' })).toBeVisible()
  await expect(foaie).toContainText('Ambalaje · 42 lei')
  await foaie.getByRole('button', { name: 'Gata' }).click()
  await expect(page.getByRole('button', { name: /^Ambalaje, 42 lei/ })).toBeVisible()
})

test('6. Tratamente → Analize: analiza din demo și raportul public, fără cont', async ({ browser }) => {
  await page.goto('/tratamente?tab=analize', { waitUntil: 'load' })
  await expect(page.getByRole('button', { name: /^Ultima analiză Conform/ })).toBeVisible()
  await page.getByRole('button', { name: /· prelevată .*Conform/ }).first().click()
  await page.getByRole('button', { name: 'Vezi raportul' }).click()
  const raport = page.getByRole('dialog', { name: 'Raportul analizei' })
  const link = raport.getByText(/\/a\/[A-Za-z0-9_-]{10,64}$/)
  await expect(link).toBeVisible()
  const url = ((await link.textContent()) ?? '').trim()
  const cale = new URL(url).pathname
  caleRaport = cale

  // Fără cont: context nou, fără cookie-uri.
  const anonim = await browser.newContext()
  try {
    const p = await anonim.newPage()
    const raspuns = await p.goto(cale, { waitUntil: 'load' })
    expect(raspuns?.status()).toBe(200)
    await expect(p.getByText('Conform: nicio limită depășită')).toBeVisible()
    await expect(p.getByRole('heading', { level: 1 })).toHaveText(/^Ferma demo/)
    const text = await p.locator('main').innerText()
    expect(text).not.toMatch(/tenant_/i)
    // Fiecare soi o singură dată (raportul promptului 26 le dubla).
    const rand = text.split('\n').find((linie) => linie.includes('· parcelele')) ?? ''
    const soiuri = rand.split(' · ')[0].split(', ')
    expect(new Set(soiuri).size).toBe(soiuri.length)
    expect(p.url()).not.toContain('/login')
  } finally {
    await anonim.close()
  }
})

/** „Kelpak: 2,85 l, ajunge pentru ~19 aplicări” (eticheta rândului din Magazie) → 2.85 */
async function stocInMagazie(p: Page, produs: string): Promise<number> {
  await p.goto('/tratamente/magazie', { waitUntil: 'load' })
  const rand = p.getByRole('button', { name: new RegExp(`^${produs}: `) })
  await expect(rand).toBeVisible()
  const eticheta = (await rand.getAttribute('aria-label')) ?? ''
  const potrivire = eticheta.match(/: (−?[\d.]+(?:,\d+)?) (kg|l|buc)/)
  if (!potrivire) throw new Error(`Nu găsesc cantitatea în „${eticheta}”`)
  return Number(potrivire[1].replace('−', '-').replace(/\./g, '').replace(',', '.'))
}

test('7. Magazia: „+ Am cumpărat” → tratament făcut cu produsul → stocul scade', async () => {
  await page.goto('/tratamente/magazie', { waitUntil: 'load' })
  // Așteptăm pagina gata: fie mesajul „după actualizarea bazei de date”, fie butonul „Am cumpărat”.
  const mesaj = page.getByText(/Magazia va merge după actualizarea bazei de date/).first()
  await expect(mesaj.or(page.getByRole('button', { name: 'Am cumpărat', exact: true }))).toBeVisible()
  const faraMigrare = await mesaj.isVisible()
  test.skip(faraMigrare, 'Migrarea 20261122130000_magazia.sql nu e aplicată: Magazia arată „după actualizarea bazei de date”.')

  // „+ Am cumpărat” 2 l de Kelpak (în demo e deja în magazie, cu unitatea l).
  const stocInitial = await stocInMagazie(page, 'Kelpak')
  await page.getByRole('button', { name: 'Am cumpărat', exact: true }).click()
  const foaie = page.getByRole('dialog', { name: 'Am cumpărat' })
  await foaie.getByLabel('Caută produsul').fill('Kelpak')
  await foaie.getByRole('button', { name: /^Kelpak/ }).first().click()
  await apasaTaste(page, 'Tastatură pentru cantitate și preț', '2')
  await foaie.getByRole('button', { name: /^Salvează/ }).click()
  await expect(foaie.getByRole('heading', { name: 'Intrat în magazie' })).toBeVisible()
  await foaie.getByRole('button', { name: 'Gata' }).click()
  const stocDupaCumparare = await stocInMagazie(page, 'Kelpak')
  expect(stocDupaCumparare).toBeCloseTo(stocInitial + 2, 3)

  // Un tratament făcut cu Kelpak: „Repetă” stropirea din demo (Switch 62.5 WG + Kelpak), „Făcut acum”.
  await page.goto('/tratamente', { waitUntil: 'load' })
  await page.getByRole('button', { name: /Stropire.*Kelpak/ }).first().click()
  await page.getByRole('button', { name: 'Repetă tratamentul' }).click()
  const formular = page.getByRole('dialog', { name: 'Stropire' })
  // Parcela demo n-are volumul de soluție salvat: îl scriem, altfel „Continuă” rămâne dezactivat.
  const solutie = formular.getByRole('textbox', { name: 'Soluție, l' })
  if ((await solutie.inputValue()) === '') await solutie.fill('60')
  await formular.getByRole('button', { name: 'Continuă' }).click()
  await expect(formular.getByRole('heading', { name: 'Din magazie' })).toBeVisible()
  await formular.getByRole('button', { name: 'Salvează tratamentul' }).click()
  await expect(formular.getByRole('heading', { name: 'Salvat' })).toBeVisible()
  await formular.getByRole('button', { name: 'Gata' }).click()

  const stocDupaTratament = await stocInMagazie(page, 'Kelpak')
  expect(stocDupaTratament).toBeLessThan(stocDupaCumparare)
})

test('8. Capcane: montează → verifică peste prag → apare „peste prag”', async () => {
  await page.goto('/tratamente?tab=capcane', { waitUntil: 'load' })
  // Așteptăm tab-ul gata: fie mesajul „după actualizarea bazei de date”, fie butonul „Montează”.
  const mesaj = page.getByText(/Capcanele vor merge după actualizarea bazei de date/).first()
  const monteaza = page.getByRole('button', { name: 'Montează', exact: true }).first()
  await expect(mesaj.or(monteaza)).toBeVisible()
  const faraMigrare = await mesaj.isVisible()
  test.skip(faraMigrare, 'Migrarea 20261123100000_capcane.sql nu e aplicată: tab-ul Capcane arată „după actualizarea bazei de date”.')

  // „+ Montează”: Drosophila, 3 bucăți pe Delniwa Sud (parcela de vânzare, în fereastra culesului din demo).
  await monteaza.click()
  const montare = page.getByRole('dialog', { name: 'Montează capcane' })
  await montare.getByRole('radio', { name: /Drosophila/ }).click()
  await montare.getByRole('button', { name: 'Delniwa Sud', exact: true }).click()
  await montare.getByRole('button', { name: 'Continuă' }).click()
  await montare.getByRole('button', { name: /^Montează/ }).click()
  await expect(montare.getByRole('heading', { name: 'Capcane montate' })).toBeVisible()
  await montare.getByRole('button', { name: 'Gata' }).click()

  // Fișa grupului → „Verifică acum”: 5 capturi în fiecare dintre cele 3 capcane (15 ≥ 3 = peste prag).
  await page.getByRole('button', { name: /Delniwa Sud · 3 Drosophila/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Delniwa Sud · capturi' })).toBeVisible()
  await page.getByRole('button', { name: 'Verifică acum' }).click()
  const verificare = page.getByRole('dialog', { name: 'Verificare capcane' })
  for (let i = 1; i <= 3; i += 1) {
    await expect(verificare.getByRole('heading', { name: `Delniwa Sud · capcana ${i}` })).toBeVisible()
    await apasaTaste(page, 'Tastatură pentru capturi', '5')
    await verificare.getByRole('button', { name: i < 3 ? 'Următoarea capcană' : 'Salvează verificarea' }).click()
  }
  await expect(verificare.getByRole('heading', { name: 'Verificare salvată' })).toBeVisible()
  await expect(verificare.getByText('Peste prag la Delniwa Sud', { exact: true })).toBeVisible()
  await verificare.getByRole('button', { name: 'Gata' }).click()
  await expect(page.getByText('peste prag', { exact: true }).first()).toBeVisible()
})

test('9. Plan: „E timpul pentru…” → formularul completat → „Salvează · făcut” → linia apare „făcut”', async () => {
  await page.goto('/tratamente?tab=plan', { waitUntil: 'load' })
  await expect(page.getByText('E timpul pentru', { exact: true }).first()).toBeVisible()

  // Intervenția din demo: Cupru (exemplu), „După recoltare” pe Delniwa Nord + Maravilla.
  await page.getByRole('button', { name: /Cupru \(exemplu\)/ }).first().click()
  const formular = page.getByRole('dialog', { name: 'Stropire · din plan' })
  await expect(formular.getByText(/Completat din „Zmeură \d{4} · /)).toBeVisible()
  // Parcelele demo n-au volumul de soluție salvat: îl scriem, altfel „Salvează · făcut” rămâne dezactivat.
  const solutie = formular.getByRole('textbox', { name: 'Soluție, l' })
  if ((await solutie.inputValue()) === '') await solutie.fill('120')
  await formular.getByRole('button', { name: 'Salvează · făcut' }).click()
  await expect(formular.getByRole('heading', { name: 'Salvat' })).toBeVisible()
  await formular.getByRole('button', { name: 'Gata' }).click()

  await page.getByRole('button', { name: 'Vezi planul întreg' }).first().click()
  await expect(page.getByRole('heading', { name: /^Zmeură \d{4}$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Cupru \(exemplu\).*făcut/ })).toBeVisible()
})

test('11. prima pagină și Login (fără cont): fără textele scoase, nota pentru operatori', async ({ browser }) => {
  const anonim = await browser.newContext()
  try {
    const p = await anonim.newPage()
    await p.goto('/', { waitUntil: 'load' })
    await expect(p.getByRole('heading', { level: 1, name: 'Ferma ta, pe telefon. Fără hârtii.' })).toBeVisible()
    await expect(p.getByRole('link', { name: 'Încearcă fără cont' })).toBeVisible()
    const text = (await p.locator('body').innerText()) ?? ''
    for (const scos of ['locuri limitate', 'Ion M., Bacău', 'Maria D., Iași', 'Nu mai pierde bani din fermă']) {
      expect(text, `Prima pagină încă are „${scos}”`).not.toContain(scos)
    }
    await p.goto('/login', { waitUntil: 'load' })
    await expect(p.getByText('Ești operator? Intră din linkul primit pe WhatsApp.')).toBeVisible()
    await expect(p.getByRole('link', { name: 'Încearcă demo-ul' })).toBeVisible()
  } finally {
    await anonim.close()
  }
})

test('12. Mai mult fără intrările de magazin; Planul tău scrie „Gratuit în beta”', async () => {
  await page.goto('/mai-mult', { waitUntil: 'load' })
  await expect(page.getByRole('link', { name: /Planul tău/ })).toBeVisible()
  const text = await page.locator('body').innerText()
  expect(text).not.toContain('Clienți magazin')
  expect(text).not.toContain('Analytics magazin')
  await page.getByRole('link', { name: /Planul tău/ }).click()
  await expect(page.getByText('Gratuit în beta')).toBeVisible()
})

test('13. Acasă: vremea (fără „Pune locul fermei”: demo-ul are parcele cu coordonate), fără erori', async () => {
  erori.length = 0
  await page.goto('/dashboard', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Acasă', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await expect(page.getByText('Pune locul fermei ca să vezi vremea ta')).toHaveCount(0)
  // Zilele următoare apar doar după redeploy-ul `fetch-meteo` (promptul 33); până atunci, nimic stricat.
  const zile = page.getByRole('list', { name: 'Următoarele zile' })
  if ((await zile.count()) > 0) await expect(zile.first().getByRole('listitem')).toHaveCount(3)
  expect(erori, `Erori de consolă pe Acasă:\n${erori.join('\n')}`).toEqual([])
})

test('14. clopoțelul: foaia „Notificări” pe kit, titlul o singură dată, „Vezi toate notificările”', async () => {
  await page.goto('/dashboard', { waitUntil: 'load' })
  await page.getByRole('button', { name: /^Notificări/ }).first().click()
  const foaie = page.getByRole('dialog', { name: 'Notificări' })
  await expect(foaie).toBeVisible()
  await expect(foaie.getByRole('heading', { name: 'Notificări' })).toHaveCount(1)
  await expect(foaie.getByRole('link', { name: 'Vezi toate notificările' })).toBeVisible()
  await foaie.getByRole('link', { name: 'Vezi toate notificările' }).click()
  await expect(page).toHaveURL(/\/notificari/)
})

test('15. Stocuri: o filă pe fiecare cultură din parcele, fără „Mix fructe”; „Pierdere” cu motiv (doar cu migrarea)', async () => {
  await page.goto('/stocuri', { waitUntil: 'load' })
  const file = page.getByRole('tablist', { name: 'Cultura' })
  await expect(file).toBeVisible()
  const nume = await file.getByRole('tab').allInnerTexts()
  expect(nume.join(' ')).toMatch(/Zmeură/)
  expect(nume.join(' ')).not.toMatch(/Mix fructe/)
  const pierdere = page.getByRole('button', { name: 'Pierdere', exact: true })
  if ((await pierdere.count()) === 0) {
    test.info().annotations.push({ type: 'netestat', description: '„Pierdere” cere migrarea 20261125100000 (neaplicată).' })
    return
  }
  await pierdere.first().click()
  const formular = page.getByRole('dialog', { name: 'Pierdere' })
  await formular.getByRole('radio', { name: /Stricat/ }).click()
  await apasaTaste(page, 'Tastatură pentru kilograme', '1')
  await formular.getByRole('button', { name: /Salvează/ }).click()
  await expect(formular.getByText('Pierdere notată')).toBeVisible()
  await formular.getByRole('button', { name: 'Gata' }).click()
  await expect(page.getByText('Pierderi în sezon')).toBeVisible()
})

test('16. Tratamente: Aplicări, Plan, Capcane, Analize și rândul Magaziei', async () => {
  await page.goto('/tratamente', { waitUntil: 'load' })
  for (const tab of ['Aplicări', 'Plan', 'Capcane', 'Analize']) {
    await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible()
  }
  await expect(page.getByText(/^Magazia/).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Plan', exact: true }).click()
  await expect(page).toHaveURL(/tab=plan/)
})

test('17. raportul public: fără cookie-uri de sesiune și cu noindex', async ({ browser }) => {
  test.skip(!caleRaport, 'Pasul 6 n-a găsit raportul public.')
  const anonim = await browser.newContext()
  try {
    const raspuns = await anonim.request.get(caleRaport as string)
    expect(raspuns.status()).toBe(200)
    const cookies = raspuns.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value)
    expect(cookies.filter((c) => /sb-|supabase/i.test(c) && !/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c))).toEqual([])
    const html = await raspuns.text()
    expect(html).toMatch(/<meta[^>]+name="robots"[^>]+noindex/i)
  } finally {
    await anonim.close()
  }
})

test('18. Parcele: la Maravilla foaia Stadiul are „Floricane · lăstar an 2 / Primocane · lăstar an 1”', async () => {
  await page.goto('/parcele', { waitUntil: 'load' })
  await page.getByRole('button', { name: /^Maravilla/ }).first().click()
  await expect(page).toHaveURL(/\/parcele\/[^/?]+/)
  await page.getByRole('button', { name: 'Actualizează' }).click()
  const foaie = page.getByRole('dialog', { name: /^Stadiul ·/ })
  await expect(foaie).toBeVisible()
  await expect(foaie.getByRole('tab', { name: 'Floricane · lăstar an 2' })).toBeVisible()
  await expect(foaie.getByRole('tab', { name: 'Primocane · lăstar an 1' })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('19. Setări se încarcă fără erori', async () => {
  erori.length = 0
  await page.goto('/settings', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Setări', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle').catch(() => undefined)
  expect(erori, `Erori de consolă în Setări:\n${erori.join('\n')}`).toEqual([])
})

test('10. pe mobil (375 px), bara de jos are 5 taburi', async () => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard', { waitUntil: 'load' })
  const bara = page.getByRole('navigation', { name: 'Navigare principală' })
  await expect(bara).toBeVisible()
  await expect(bara.getByRole('link')).toHaveCount(5)
  await expect(bara.getByRole('link', { name: /Acasă/ })).toBeVisible()
  await expect(bara.getByRole('link', { name: 'Mai mult' })).toBeVisible()
})
