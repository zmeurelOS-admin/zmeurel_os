# PWA Testing

Acest ghid explică rularea suitei automate PWA și verificările manuale recomandate.

## Rulare locală

- Build complet + suită PWA:
  - `npm run test:pwa:full`
- Rulează suita PWA:
  - `npm run test:pwa`
- Rulează în mod headed (browser vizibil):
  - `npm run test:pwa:headed`

`test:pwa` presupune că build-ul de producție există deja.
Configurația Playwright pornește doar `npm run start`, deci pentru o rulare curată folosește `npm run test:pwa:full`.

## Ce acoperă testul automat

Suita `tests-e2e/pwa/service-worker.spec.ts` validează:

1. **Worker target real + cache storage**: Chromium pornește workerul real `/sw.js` și materializează cache-ul Workbox în Cache Storage.
2. **Offline cached route**: testul încearcă rularea comportamentală reală, dar se marchează `skip` explicit dacă documentul nu ajunge să fie controlat de SW în acest setup.
3. **Offline fallback `/offline`**: testul încearcă navigare offline către rută necached, dar se marchează `skip` explicit dacă takeover-ul SW nu se produce.
4. **Update flow**: rămâne `skip` documentat până când acest stack permite două build-uri distincte + un waiting worker observabil automat.

Raportarea include:
- output clar pass/fail per test (`--reporter=line`)
- screenshot/video/trace pe failure (config Playwright existent: screenshot `only-on-failure`, video `retain-on-failure`, trace `on-first-retry`)

## Limitare actuală a setup-ului

Pe Windows, în acest repo, rulările automate Playwright pot vedea targetul Chromium `service_worker` și cache-ul Workbox, dar documentul nu ajunge consecvent la `navigator.serviceWorker.controller !== null`.

Consecințe observate în practică:

- `navigator.serviceWorker.register('/sw.js')` rezolvă cu worker `installing`
- `context.serviceWorkers()` vede `/sw.js`
- `caches.keys()` conține cache-ul Workbox precache
- `navigator.serviceWorker.getRegistrations()` poate reveni ulterior cu `[]`
- `context.setOffline(true)` + `page.reload()` cade în `net::ERR_INTERNET_DISCONNECTED` în loc de conținut servit de SW

Din acest motiv, testele 2-4 nu mint: ele nu sunt transformate în string matching pe `sw.js`, ci fac `skip` explicit când condiția tehnică minimă (document controlat de SW) nu este îndeplinită.

## Ce NU acoperă

- comportament PWA instalată pe device real (Android/iOS)
- verificări de UX pe „Add to Home Screen” și lifecycle de install prompt
- comportament pe rețele mobile reale (latency/jitter/pierderi pachete)
- actualizări SW între două deployment-uri reale în medii distincte
- takeover-ul SW pe Windows + Playwright atunci când Chromium nu expune controller activ pentru document

## Checklist manual scurt (telefon)

1. Deschide aplicația în Chrome pe telefon și adaug-o pe home screen (PWA install).
2. Rulează aplicația instalată online și navighează în câteva ecrane de bază.
3. Activează airplane mode / dezactivează datele mobile.
4. Redeschide PWA instalată:
   - verifică fallback-ul offline la o rută nouă,
   - verifică că ecranele vizitate anterior se deschid fără erori critice.
5. Rebuild / redeploy:
   - deschide aplicația într-un tab online,
   - publică o versiune nouă,
   - confirmă apariția toast-ului „Versiune nouă disponibilă. Reîmprospătează.”,
   - apasă acțiunea și verifică reload-ul pe noul worker.
6. Încearcă o acțiune de tip mutație (formular/POST):
   - confirmă că eșuează clar, fără blocare UI.
7. Revino online și verifică recuperarea normală.

## Debug rapid

- Pentru investigații vizuale: `npm run test:pwa:headed`
- Pentru regresie controlată a testului automat care trece azi, modifică temporar resursele PWA astfel încât `/sw.js` să nu mai pornească sau Cache Storage să nu mai fie creat; Testul 1 trebuie să pice clar.
- Pentru fallback-ul `/offline` și update flow, fă verificarea manuală până când takeover-ul SW devine reproductibil în Playwright pe acest setup.
