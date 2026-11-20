# Prompt 14 — Verificarea zilnică: ger, comenzi de mâine, bani de încasat

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/notificari-zilnice` (pornit din `main` `ce150df`) · Rezultat: branch verde, cu push, fără merge

## Context

- Promptul 13 e în producție: ecranul „Ce primești” (`/notificari/setari`), tabelul `notificari_preferinte` și filtrul de push din `src/lib/notifications/create.ts`.
- În `src/lib/notifications/preferinte.ts` există deja:
  - cheile `maine`, `rest`, `meteo`;
  - regula „liniște noaptea, 22:00–6:00, gerul face excepție”;
  - mapping-ul `meteo_*` → `meteo`.
- Comutatoarele `maine` (pentru comenzile de fructe), `rest` și `meteo` **nu au încă nicio notificare în spate**. Acest prompt le dă una.
- Model de cron de urmat: `src/app/api/cron/butasi-delivery-reminders/route.ts`, cu:
  - `CRON_SECRET`;
  - citire cu service role;
  - deduplicare prin `data->>reminder_key`;
  - doar inserări în `notifications`, fără să modifice alte date.

  Cronurile sunt în `vercel.json`, cu orele în UTC.
- Meteo: Edge Function-ul `fetch-meteo` (`supabase/functions/_shared/meteo-handler.ts`, OpenWeather 2.5, cu cache pe tenant). Acasă îl folosește prin `src/hooks/useMeteo.ts`.
- Locul fermei e în `tenant_settings.latitudine_default` / `longitudine_default`, salvat din `/settings/ferma`.
- `notifications.type` e text liber, fără constrângere. **Nu e nevoie de migrare.** Dacă ajungi la concluzia că îți trebuie una, te oprești și explici în raport, fără s-o scrii.

## Ce faci

1. **Logica, în funcții pure, testabile** (`src/lib/notifications/zilnice/`), separat de rutele cron:
   - **`comenziMaine(comenzi, azi)`:**
     - comenzile de fructe (`comenzi`) cu `data_livrare` = mâine (ora României);
     - statusul nu e livrată, anulată sau deja în livrare (verifici valorile reale ale enum-ului `comanda_status`);
     - una singură pe fermă: „N comenzi de livrat mâine”, cu textul „Încă nu sunt puse în livrare.” și totalul de kg.
     - Nu atingi memento-ul pentru butași (rămâne în cronul lui).
   - **`baniDeIncasat(vanzari, azi)`:**
     - vânzările neîncasate integral (`status_plata` + `suma_incasata_partial_lei`; verifici cum le folosește modulul Vânzări / Clienți, fără să inventezi altă regulă), grupate pe client;
     - pentru fiecare client, notificare doar în zilele în care cea mai veche livrare neîncasată împlinește **7, 14 sau 30 de zile**: „Ioana Rotaru: 120 lei de 14 zile”;
     - dacă în aceeași zi sunt mai mult de 3 clienți, o singură notificare: „4 clienți au de plătit 860 lei”.
   - **`alertaMeteo(prognoza, data)`:** pragurile într-un singur obiect de configurare, comentat, ca Andrei să le poată schimba:
     - **Îngheț, ziua de 1 martie – 31 mai** (lăstari, flori): minima de la noapte **≤ 0 °C** → `meteo_inghet`, „Îngheț la noapte: −2 °C”, cu „Protejează plantele sensibile.”;
     - **Îngheț, ziua de 15 septembrie – 15 noiembrie** (fructe târzii, butași): minima **≤ −2 °C** → `meteo_inghet`;
     - **Ger, 16 noiembrie – 28/29 februarie:** minima **≤ −15 °C** → `meteo_inghet`, „Ger puternic la noapte: −17 °C”;
     - **Furtună, 1 mai – 15 septembrie:** o perioadă de 3 ore din următoarele 24 cu cod OpenWeather 2xx (furtună) și probabilitate ≥ 0,5 → `meteo_grindina`, „Risc de furtună cu grindină mâine”.
     - Ce lipsește din prognoză → nicio alertă, fără să ghicești.
   - **Teste unitare** pentru toate trei, cu date fixe: schimbarea anotimpului, ziua de 7 / 14 / 30, gruparea peste 3 clienți și comenzile deja puse în livrare (care nu intră).
2. **Două rute cron noi**, după modelul celei pentru butași:
   - **`/api/cron/notificari-dimineata`**, la `0 5 * * *` UTC (7:00 iarna, 8:00 vara, ora României): meteo + bani de încasat.
   - **`/api/cron/notificari-seara`**, la `0 17 * * *` UTC (19:00 / 20:00): comenzi de mâine.
   - Pentru amândouă:
     - **Fermele luate în calcul:** doar fermele reale. **Atenție:** `demo-tenant-cleanup` NU e o regulă bună: toate cele 110 demo-uri din producție au `is_demo = false` și `expires_at` gol. Semnul sigur e emailul proprietarului: sari peste fermele al căror proprietar are email `@demo.zmeurel.local` (demo) sau `@example.test` (conturi de test automate). Regula stă într-o funcție mică (`esteFermaReala`), cu test.
     - **Destinatarul:** proprietarul fermei, prin `createNotificationForTenantOwner`, ca push-ul să treacă prin preferințe și liniștea de noapte.
     - **Deduplicare** prin `data.reminder_key`:
       - `maine:<tenant>:<data>`;
       - `rest:<tenant>:<client>:<zile>:<data>` (pentru varianta grupată: `rest:<tenant>:grup:<data>`);
       - `meteo:<tenant>:<tip>:<data>`.
       - Dacă rulează de două ori, nu trimite de două ori.
     - **Meteo:**
       - doar pentru fermele cu loc salvat;
       - prognoza o iei prin `fetch-meteo` (cu cache), apelat de pe server cu service role. Dacă nu se poate, scrii în raport de ce și propui alternativa, fără să adaugi o cheie nouă;
       - fără loc salvat, nu trimiți nimic și nu ghicești.
     - **Erori:** o fermă care dă eroare nu oprește restul (o raportezi prin `captureApiError`). Răspunsul JSON spune câte ferme au fost verificate și câte notificări s-au trimis, pe tip.
     - **Interzis:** nu modifici nicio comandă, vânzare sau setare. Doar citești și inserezi în `notifications`.
3. **Tipurile noi** în `src/lib/notifications/`:
   - `comenzi_maine` → cheia `maine`; `incasari_restante` → cheia `rest`; `meteo_inghet`, `meteo_grindina` → `meteo` (merge deja prin prefix; verifici). Le adaugi în `TIP_LA_CHEIE` și în teste.
   - În `config.ts`, push activ pentru toate patru, cu iconiță și ton (avertizare pentru meteo și bani, informare pentru comenzi). În `navigation.ts`, unde duce atingerea:
     - meteo → `/dashboard`;
     - comenzi de mâine → `/comenzi`;
     - bani de încasat → fișa clientului (sau lista de clienți la varianta grupată).
   - Ecranul Notificări le arată cu iconițele potrivite.
4. **`vercel.json`:** adaugi cele două cronuri. Nu le schimbi pe celelalte.
5. **Textul din „Ce primești”:** verifici că detaliile comutatoarelor spun exact ce face codul acum: „Seara la 19:00…”, „După 7 zile de la livrare” (7, 14, 30), „Dimineața, pentru {loc}”. Dacă nu se potrivesc, ajustezi textul, nu regula.
6. **Verificare pe date reale, DOAR citire:**
   - rulezi funcțiile pure pe ce citești din producție (`select`), într-un script local sau test, **fără să inserezi notificări**;
   - scrii în raport câte notificări ar fi plecat azi, pe tip, și pentru ce ferme (doar numărul și tipul; fără telefoane sau sume per client în raport).
   - **Nu apelezi rutele cron în producție.**
7. **Verificări:** `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run test:critical:unit`, `npm run build`.
8. **Raportul** în `docs/redesign/raport-notificari-zilnice.md`: ce face fiecare cron și la ce oră, pragurile meteo, regula pentru bani de încasat, simularea pe datele de azi, ce rămâne de făcut.

   Apoi `git restore public/sw.js`, commit, `git push origin redesign/notificari-zilnice`. **STOP. Fără merge.**

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
