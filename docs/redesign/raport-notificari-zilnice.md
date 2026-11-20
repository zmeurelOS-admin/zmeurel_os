# Raport — Verificarea zilnică: ger, comenzi de mâine, bani de încasat (prompt 14)

Branch: `redesign/notificari-zilnice`, pornit din `main` (`ce150df`). Fără migrare: `notifications.type` e text liber.

## Ce face fiecare cron

| Cron | Ora (UTC) | Ora României | Ce trimite |
| --- | --- | --- | --- |
| `/api/cron/notificari-dimineata` | `0 5 * * *` | 7:00 iarna, 8:00 vara | Îngheț / ger / furtună (`meteo_inghet`, `meteo_grindina`) și bani de încasat (`incasari_restante`) |
| `/api/cron/notificari-seara` | `0 17 * * *` | 19:00 iarna, 20:00 vara | Comenzi de mâine (`comenzi_maine`) |

Pentru amândouă:

- **Fermele:** toate fermele cu proprietar, fără demo-uri. Demo = `tenants.is_demo = true` (regula din `demo-tenant-cleanup`) **sau** proprietar cu email `…@demo.zmeurel.local` (vezi „Ce n-am putut face”).
- **Destinatarul:** proprietarul, prin `createNotificationForTenantOwner`. Push-ul trece prin `config.ts`, „Ce primești” și liniștea de noapte. Cronul așteaptă push-ul (`awaitPush: true`): o funcție oprită după răspuns ar pierde un push „fire-and-forget”.
- **Deduplicare:** după `type` + `data->>reminder_key`. Cheile (`<data>` = ziua rulării, ora României):
  - `maine:<tenant>:<data>`;
  - `rest:<tenant>:<client>:<zile>:<data>`; varianta grupată: `rest:<tenant>:grup:<data>`;
  - `meteo:<tenant>:<tip>:<data>`.
  O a doua rulare în aceeași zi nu mai trimite nimic (testat).
- **Erori:** o fermă cu eroare se raportează prin `captureApiError` (cu `tenantId`) și se trece la următoarea.
- **Răspunsul JSON:** `fermeVerificate`, `trimise` pe tip, `dubluri`, `erori`. Dimineața, în plus: `fermeCuLoc` și `fermeCuMeteo`.
- **Interzis și respectat:** doar `select` pe comenzi, vânzări, clienți și setări, plus `insert` în `notifications`.

Logica e în funcții pure, în `src/lib/notifications/zilnice/` (`comenziMaine`, `baniDeIncasat`, `alertaMeteo`, `prognozaDinFetchMeteo`, `esteFermaDemo`). Partea de server e în `zilnice/server.ts`.

### Comenzi de mâine (seara)

- Tabelul `comenzi`, `data_livrare` = mâine.
- Intră statusurile `noua`, `confirmata`, `programata`. Ies `in_livrare`, `livrata`, `anulata` (valorile enum-ului `comanda_status`).
- O notificare pe fermă: „3 comenzi de livrat mâine”, cu „Încă nu sunt puse în livrare. Total 40 kg.” (la singular: „1 comandă…”, „Încă nu e pusă în livrare.”).
- Memento-ul pentru material săditor a rămas neatins, în `butasi-delivery-reminders`.

## Pragurile meteo

Sunt toate în `PRAGURI_METEO` (`src/lib/notifications/zilnice/alerta-meteo.ts`), comentate. Se schimbă doar acolo.

| Perioada (capete incluse) | Condiția | Tip | Text |
| --- | --- | --- | --- |
| 1 martie – 31 mai | minima ≤ 0 °C | `meteo_inghet` | „Îngheț la noapte: −2 °C” / „Protejează plantele sensibile.” |
| 15 septembrie – 15 noiembrie | minima ≤ −2 °C | `meteo_inghet` | la fel |
| 16 noiembrie – 28/29 februarie | minima ≤ −15 °C | `meteo_inghet` | „Ger puternic la noapte: −17 °C” |
| 1 mai – 15 septembrie | interval de 3 ore cu furtună (cod 2xx) și probabilitate ≥ 0,5 | `meteo_grindina` | „Risc de furtună cu grindină mâine” / „Probabilitate 70%.” |

Anotimpul se ia după ziua rulării (ora României). În mai pot pleca amândouă, înghețul și furtuna.

**De unde vine prognoza.** Prin `fetch-meteo` (cu cache pe fermă, 3 ore), apelat de pe server cu service role. Dacă `fetch-meteo` nu răspunde, cronul încearcă `get-meteo`, la fel ca `useMeteo` pe Acasă: același cod, fără verificarea JWT la gateway. Nu am adăugat nicio cheie nouă.

**Ce lipsește din prognoză nu dă alertă.** Fără loc salvat nu cerem prognoza. Fără minimă nu e alertă de îngheț. Fără detaliu pe ore nu e alertă de furtună. O prognoză pentru altă zi decât mâine (cache vechi) e ignorată.

**Limitele lui `fetch-meteo` (de știut):**

1. „Minima de la noapte” = cea mai mică temperatură din intervalele de 3 ore ale zilei de mâine (00:00–24:00). Prinde dimineața de după noaptea care vine, adică momentul cel mai rece.
2. Pe ore, `fetch-meteo` păstrează doar intervalul cu cea mai mare probabilitate de ploaie: iconița lui și probabilitatea. Iconița „11” la OpenWeather = furtună (codurile 2xx). O furtună într-un alt interval al zilei, cu probabilitate mai mică decât ploaia maximă, nu se vede.
3. Fereastra e ziua de mâine, nu „următoarele 24 de ore” de la 7:00.

Ca să se aplice regula întocmai, ar trebui ca `fetch-meteo` să păstreze lista pe 3 ore (`list[].weather[0].id`, `pop`, `dt`) în `raw_json` sau în răspuns. Funcția pură primește deja o listă de perioade (`PrognozaFerma.perioade`), deci s-ar schimba doar adaptorul. Schimbarea e în Edge Function (deploy separat), așa că n-am făcut-o.

**Punctul prognozei.** `fetch-meteo` caută coordonatele în ordinea: parcela comercială cu GPS, orice parcelă cu GPS, abia apoi locul salvat. Cronul cere prognoza doar pentru fermele cu locul salvat, dar punctul poate fi al unei parcele: același pe care îl arată Acasă.

## Regula pentru bani de încasat

- **Restul unei vânzări:** cel din Vânzări și din fișa clientului (`vanzareRest`, `src/lib/vanzari/incasari.ts`).
  - Încasată = `status_plata` ∈ {platit, platita, incasat, incasata, achitat, achitata}, fără majuscule și diacritice.
  - Altfel, rest = total − `suma_incasata_partial_lei`.
  - `neplatit` și `restanta` sunt neîncasate.
- **Pe client:** se ia cea mai veche vânzare cu rest. Notificarea pleacă doar în ziua în care aceasta împlinește **7, 14 sau 30 de zile**, cu tot restul clientului: „Ioana Rotaru: 120 lei de 14 zile”.
- **Peste 3 clienți în aceeași zi la aceeași fermă:** o singură notificare, „4 clienți au de plătit 860 lei”.
- **Vânzările fără client nu intră:** n-avem pe cine numi și nici fișa la care să ducem.
- **Atingerea duce la** `/clienti?client=<id>` (se deschide fișa clientului; parametrul e nou în `ClientPageClient`). Pentru varianta grupată, la `/clienti`.

## Tipurile noi

| Tip | Comutator „Ce primești” | Push | Ton | Atingerea duce la | Iconița în Notificări |
| --- | --- | --- | --- | --- | --- |
| `comenzi_maine` | `maine` | da | informare | `/comenzi` | CalendarClock |
| `incasari_restante` | `rest` | da | avertizare | fișa clientului / `/clienti` | Banknote |
| `meteo_inghet` | `meteo` (prin prefix, verificat în test) | da | avertizare | `/dashboard` | Snowflake |
| `meteo_grindina` | `meteo` | da | avertizare | `/dashboard` | CloudLightning |

Gerul și grindina sună și noaptea (regula existentă: `meteo` trece peste liniștea de noapte). Comenzile și banii respectă liniștea, dar pleacă oricum la 7–8 și la 19–20.

## Textul din „Ce primești”

Am ajustat textul, nu regula:

- **Comenzi de mâine:** „Seara la 19:00 (vara la 20:00), dacă nu sunt puse în livrare”. Cronul e la 17:00 UTC.
- **Bani de încasat:** „La 7, 14 și 30 de zile de la livrare” (înainte: „După 7 zile de la livrare”).
- **Îngheț și grindină:** „Dimineața, pentru {loc}”, neschimbat, când ferma are locul salvat. Fără loc salvat: „Dimineața, după ce salvezi locul fermei în Setări › Ferma”. Atunci cronul nu trimite nimic, iar textul vechi promitea alerte.

## Simularea pe datele de azi (20.11.2026, doar `select`)

Am citit din producție fermele, comenzile din 20–22.11, toate vânzările fermelor reale, setările de loc și ultima prognoză din `meteo_cache`. Am rulat funcțiile pure local, fără să inserez nimic și fără să apelez rutele cron.

- **Ferme:** 156 în total; **46 reale**, 110 demo (proprietar `@demo.zmeurel.local`).
- **Seara (comenzi pentru 21.11):** 0 comenzi ale fermelor reale → **0 × `comenzi_maine`**.
- **Dimineața, bani de încasat:** 266 de vânzări, toate la o singură fermă.
  - 5 clienți au rest, dar cea mai veche livrare neîncasată are între 59 și 132 de zile. Au trecut de pragul de 30, deci **0 × `incasari_restante`** azi.
  - Nimic nici în următoarele 30 de zile, dacă nu apar vânzări noi.
  - Alte 13 vânzări neîncasate n-au client și nu intră.
- **Dimineața, meteo:** **0 ferme reale cu locul salvat** (`tenant_settings.latitudine_default` e gol peste tot; ecranul Setări › Ferma e nou) → **0 × `meteo_inghet`, 0 × `meteo_grindina`**.
  - Informativ: pe ultimele prognoze din cache ale fermelor reale (15 ferme), nicio zi n-ar fi trecut pragurile anotimpului ei.

**Total azi: 0 notificări.**

## Ce n-am putut face / ce rămâne

1. **Demo-urile nu au `is_demo`.** Toate cele 156 de ferme au `is_demo = false`. Cele 110 ferme demo se recunosc doar după emailul proprietarului. Consecința: `demo-tenant-cleanup` (care caută `is_demo = true`) nu șterge niciun demo; cel mai vechi e din 20.03. Notificările le sar oricum (regula de mai sus). Cleanup-ul rămâne de reparat separat: ori `/start` setează `is_demo`/`expires_at`, ori cleanup-ul folosește aceeași regulă pe email.
2. **Apelul `fetch-meteo` cu service role nu l-am putut încerca.** Nu am apelat nimic în producție, iar `.env.local` nu l-am citit.
   - `fetch-meteo` are `verify_jwt = true`. Dacă cheia service role e de tip JWT (cea „legacy”), trece.
   - Dacă e o cheie nouă `sb_secret_…`, gateway-ul o refuză și cronul folosește `get-meteo` (`verify_jwt = false`, același cod).
   - Primul rulaj de dimineață (după ce cineva își salvează locul) arată în JSON `fermeCuMeteo`; erorile apar în log cu `pas: meteo`.
   - Atenție: apelul de pe server **scrie** în `meteo_cache` când cache-ul a expirat, exact ca apelul de pe Acasă.
3. **Prognoza pe ore.** Detaliile sunt la „Limitele lui `fetch-meteo`”. Propunere: `fetch-meteo` păstrează lista pe 3 ore. Adaptorul e pregătit.
4. **Datoriile mai vechi de 30 de zile nu mai primesc nicio notificare.** Așa e regula 7 / 14 / 30. Dacă Andrei vrea un memento lunar după 30 (60, 90…), se schimbă doar `ZILE_RESTANTA`.
5. **Pe ecran n-am verificat nimic.** Ecranul cere un cont, iar dev-ul local scrie în producție. Acoperirea e prin teste: tipurile, iconițele (config), navigarea, comutatoarele și rutele cron cu o bază simulată.
6. **De aplicat după merge:** nimic în baza de date. Cronurile pornesc la următorul deploy, din `vercel.json`.

## Verificări

- `npm run lint`: 2 erori, aceleași dinainte (`analytics-magazin/page.tsx`, `app-date-picker.tsx`). Nimic nou.
- `npm run typecheck`: curat.
- `npm run check:kit`: curat.
- `npm run test:critical:unit`: 470 / 472.
  - Cele 2 picate sunt timeout-uri de 5 s la primul test din `integrations/google` (callback, connect), la importul rece sub încărcare.
  - Pică și cu testele mele excluse. Rulate singure trec (19 / 19).
  - Testele noi: `zilnice/__tests__/zilnice.test.ts`, `cron/__tests__/notificari-zilnice.route.test.ts`, plus cazuri noi în `preferinte.test.ts` și `navigation.test.ts` (acum în suita critică).
- `npm run build`: verde; `/api/cron/notificari-dimineata` și `/api/cron/notificari-seara` apar în listă.
