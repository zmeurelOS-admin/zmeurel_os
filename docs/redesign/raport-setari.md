# Raport: prompt 13 — Mai mult, Notificări, Setări

Branch: `redesign/setari` (pornit din `main` `8f69aa8`). Migrarea e scrisă, **neaplicată**. Fără merge.

## Ce s-a mutat unde

### Mai mult → pagină întreagă (`/mai-mult`)

- Foaia `src/components/app/MoreMenuDrawer.tsx` e ștearsă. Tab-ul 5 din `BottomTabBar` e acum link către `/mai-mult` și rămâne aprins pe `/mai-mult`, `/settings/*` și `/notificari/*`.
- Sus: titlul, clopoțelul cu numărul de necitite (aceeași sursă ca `NotificationBell`: `GET /api/notifications` → `unreadCount`), cardul fermei (nume, utilizator, rol, localitate) care duce la `/settings`. Pentru operator cardul nu e link (operatorii sunt blocați pe `/settings` în proxy).
- Plăci: „Ferma” (Parcele, Activități, Stocuri, Produse, Material săditor, Rapoarte) și „Bani și oameni” (Vânzări, Cheltuieli, Investiții, Clienți, Culegători). Regulile vechi rămân: `canSeeParcele`, ce e în bara de jos nu se repetă, numărul de comenzi în livrare pe placa Livrări (pe telefon nu apare, fiindcă Livrări e în bară; regula e păstrată ca înainte).
- Cine are rol în asociație vede și rândul „Gustă din Bucovina” → `/asociatie` (ca în foaie).
- Admin (Panou admin, Analytics global, Audit, Kit de componente): doar superadmin.
- Jos: Setări (ascuns pentru operator), Ajutor pe WhatsApp (același link ca widgetul beta, mutat în `src/lib/support.ts` și folosit de amândouă), „Ieși din cont” (formularul POST `/api/auth/sign-out` cu `prepareClientBeforeServerSignOut`).
- Spațiul asociației: tab-ul din bara asociației duce la `/mai-mult?spatiu=asociatie`, iar pagina arată lista din foaie (Oferte, Fermieri, Membri doar pentru admin, Setări, Vezi magazinul, Înapoi la fermă). Bara de jos rămâne cea a asociației.

### Notificări (`/notificari`) și Ce primești (`/notificari/setari`)

- Notificări pe kit: `Segments` Toate / Necitite (cu număr), grupuri Azi / Ieri / Săptămâna asta / Mai vechi (zilele după ora României, `notificari/group.ts`), rând cu iconiță pe tip, titlu, text, oră și punct de necitit. Atingerea marchează citit și duce unde ducea (`getNotificationHref`, aceeași logică). „Marchează toate ca citite” jos, doar cu necitite. Gol: „Le-ai citit pe toate”. Dreapta sus → „Ce primești”.
- Ce primești: comutatorul principal „Notificări pe telefon” (`PushToggle`, aceeași logică ca vechiul `PushNotificationsSettings`: `usePushSubscription`, plus butonul de notificare de probă), cele 7 comutatoare cu textele din mockup, „Liniște noaptea”, nota de jos.
- Logica: `src/lib/notifications/preferinte.ts` (singurul loc cu tip → cheie, liniștea 22:00–6:00 `Europe/Bucharest`, gerul face excepție), `preferinte-server.ts` (citire cu service role, nu aruncă), `preferinte-client.ts` (ecranul).
- Push: `create.ts` citește preferințele înainte de push (doar când tipul ar trimite push oricum). Tip oprit sau liniște noaptea → rândul din `notifications` se creează, push-ul nu pleacă. Am pus aceeași verificare și în cronul `butasi-delivery-reminders`, fiindcă el trimite push direct (`sendPushToUser`), nu prin `create.ts`; altfel „Comenzi de mâine” n-ar fi avut efect.
- Mapping-ul pentru `order_status_changed` → `noi`: e aceeași comandă din magazin, într-un pas următor; cine nu vrea să fie sunat pentru comenzile din magazin nu vrea nici pentru schimbările lor. Azi push-ul pentru el e oprit oricum din `config.ts`, deci nu schimbă nimic acum. Am mai legat de `acte` perechile `product_unlisted`, `producer_suspended` și `legal_docs_*`; tipurile `meteo_*` (alertele de mai târziu) → `meteo`. Ofertele din asociație nu au comutator: sună ca acum, dar respectă liniștea de noapte.

### Setări (`/settings`) → listă pe 4 grupuri + subpagini

| Rând | Subpagină | De unde vine |
|---|---|---|
| Ferma (nume, localitate · telefon) | `/settings/ferma` | „Profil” (nume, telefon fermă) + „Locație fermă”. Localitatea e nouă în formular (coloana `tenants.localitate` exista). „Locul fermei pe hartă” salvează direct locul de acum cu `saveTenantSettingsRow` și mesajele din `src/lib/livrari/device.ts`. |
| Prețul standard | `/settings/pret-standard` | `PretStandardSection` din `SetariFerma.tsx`, aceeași logică (`src/lib/farm-settings.ts`) |
| Ce arată Acasă | `/settings/acasa` | `AcasaSection` din `SetariFerma.tsx` |
| Notificări | `/notificari/setari` | „Notificări push” |
| Aspect | `/settings/aspect` | „Temă” + mărime + contrast |
| Echipa | `/settings/echipa` (neschimbată) | textul arată câte persoane (`/api/farm-members`) |
| Documente legale | `/settings/documente-legale` (neschimbată) | textul arată complete / ce lipsește / când expiră |
| Contul tău (email) | `/settings/cont` | email, parola (formular în ecran), telefonul contului, „Descarcă datele” (JSON + CSV pe categorie, codul mutat în `src/lib/setari/export-data.ts`), „Arată din nou ghidul de pornire”, „Ireversibil”: Șterge datele fermei, Șterge contul, Șterge toți clienții (din `SetariFerma`). Confirmările sunt în același ecran, cu parola unde o cerea și înainte; la cont rămâne și „ȘTERGE CONTUL”. |
| Abonament | `/planuri` | |
| Mod demo (doar demo) | `/settings/demo` | Creează-ți ferma, Reîncarcă exemplele (alegerea tipului în ecran), Ieși din demo |
| Schimbă ferma (doar superadmin) | `/settings/schimba-ferma` | `FarmSwitcher` |

„Șterge datele fermei” folosește în continuare `POST /api/farm/reset` (fluxul de azi din pagină, cu token de confirmare `farmReset`), nu `DELETE /api/gdpr/farm` cum scrie în prompt: promptul cere și „toate pe fluxurile existente”, iar butonul de azi chema `/api/farm/reset`. Codul e în `src/lib/setari/destructive-actions.ts`; dacă vrei `gdpr/farm`, se schimbă acolo, într-un rând.

Desktop: sidebarul duce tot la `/settings`, care e lista; paginile au conținutul centrat (max. 672 px).

## Ce s-a scos

- Foaia „Mai mult” (`MoreMenuDrawer.tsx`).
- Setări: istoricul chatului AI („Asistent AI”), „Tip interfață” compact/normal, meniul de pe desktop (`DesktopSettingsNav.tsx`), `PushNotificationsSettings.tsx` (logica e în `PushToggle`), `useUiDensity.ts` (nu-l mai folosea nimic).
- Notificări: butonul de ștergere a unei notificări (nu e în mockup) și „Mai mult / Mai puțin” pe textele lungi (textul se taie la 3 rânduri).
- CSS-ul pentru `data-density='compact'`. Cine avea `compact` trece pe Normală (`parseDensity`).

## Migrarea (neaplicată)

`supabase/migrations/20261120130000_notificari_preferinte.sql`: tabelul `public.notificari_preferinte` (`user_id` PK → `auth.users` cu `on delete cascade`, `tipuri jsonb`, `liniste_noaptea boolean default true`, `updated_at`), RLS pornit, politici select / insert / update `to authenticated` pe `user_id = auth.uid()`, fără delete, fără funcții `SECURITY DEFINER`.

Fără tabel: ecranul arată totul pornit și o notă „Încă nu se pot salva”; o atingere pe comutator nu schimbă nimic și spune de ce. Push-ul merge ca acum (totul pornit, cu liniște noaptea).

## Mărime / Contrast

Azi o singură clasă, `html.high-visibility-mode`, făcea și contrast (doar pe aliasurile vechi `--agri-*`), și ținte mai mari (52/60), și text de bază 17 px. Nimic din aplicație nu o pornea. `data-density` avea doar `compact` / `normal`.

Le-am despărțit:

- **Mărimea** (Normală / Mare) e `data-density` = `normal` / `large` (`DensityProvider`, tot în `localStorage`, cheia `ui_preferences`). „Mare” urcă țintele la 56 / 64 (`--touch-control-h*`) și textul kitului cu un pas: `kitText` citește acum `--kit-fs-*` (64→72, 26→28, 22→24, 19→21, 17→19, 15→17, 13→15). Modulele nerefăcute primesc țintele (`agri-control`) și textul de bază 17 px pe `body`; textele lor scrise în `text-sm` etc. nu cresc.
- **Contrastul ridicat** e tot `html.high-visibility-mode` (tot în `localStorage`, `agri.highVisibility`), dar schimbă doar tokenii canonici `--fg`, `--fg-muted`, `--fg-subtle`, `--border*`, `--primary`, `--primary-soft`, zi și noapte (`html.high-visibility-mode.dark`). Aliasurile vechi îi urmează singure, deci contrastul se vede și în modulele nerefăcute. Nu mai schimbă mărimile.

Previzualizarea din Aspect folosește componentele reale (`ListRow`, butonul plin), deci arată exact schimbarea.

## Legăturile vechi și unde duc

Redirecționarea se face în `/settings`, în browser (ancora nu ajunge la server): `src/lib/setari/legacy-links.ts`, cu test.

| Legătura veche | Duce la |
|---|---|
| `#profil`, `#parola`, `#password` | `/settings/cont` |
| `#locatie` | `/settings/ferma` |
| `#pret-standard` | `/settings/pret-standard` |
| `#acasa` | `/settings/acasa` |
| `#gdpr`, `#date-clienti`, `#actiuni-permanente` | `/settings/cont` |
| `#documente-legale` | `/settings/documente-legale` |
| `#echipa` | `/settings/echipa` |
| `#notificari-push` | `/notificari/setari` |
| `#tema`, `#interfata` | `/settings/aspect` |
| `#demo` | `/settings/demo` |
| `#ferma` (vechiul „Schimbă fermă”) | `/settings/schimba-ferma` |
| `#ai` | rămâne pe `/settings` (secțiunea e scoasă) |

În cod: `UserProfileMenu` avea `/settings#gdpr` → acum `/settings/cont`; `MoreMenuDrawer` avea `/settings#profil` (șters). Testele e2e care deschideau foaia sau căutau CTA-ul demo pe `/settings` sunt actualizate (`admin-access`, `onboarding-flows`; CTA-ul e pe `/settings/demo`). Nu le-am rulat: scriu în baza de producție.

## Testat (cont demo, 390 px, zi și noapte)

- Mai mult: toate cele 11 plăci, Setări, linkul de WhatsApp, tab-ul aprins; cardul fermei.
- Notificări: contul demo nu are notificări și nu am scris în baza de date, așa că lista am verificat-o cu răspunsuri false injectate în browser (inclusiv PATCH-urile, interceptate, ca să nu ajungă la server): grupurile, ora, punctul, Necitite cu număr, atingerea (marcat citit + dus la `/comenzi`), „Marchează toate ca citite”, starea goală.
- Ce primești: fără tabel, nota și mesajul la atingere; comutatorul de push apare blocat (browserul are notificările refuzate).
- Setări: fiecare subpagină se deschide; salvat numele fermei („Ferma Demo Prompt13”) și prețul de vârf (25 → 26 lei/kg), amândouă păstrate după reîncărcare.
- Aspect: Zi / Noapte / Automat, Mare (text 19 px, ținte 56 px), Contrast ridicat zi și noapte; la final am pus la loc Automat / Normală / fără contrast.
- Contul tău: confirmările pentru Șterge datele fermei, Șterge contul, Șterge toți clienții apar în ecran, cu „Șterge” blocat; **nu le-am apăsat**. Mod demo: alegerea tipului și confirmarea „Ieși din demo” apar; nu le-am apăsat.
- Legăturile vechi `#gdpr`, `#tema`, `#notificari-push` duc la subpaginile noi.
- Desktop (1366 px): Setări, Mai mult, sidebarul.

## Ce n-am putut testa

- Salvarea preferințelor de notificări și push-ul filtrat de ele: tabelul nu există până la migrare. Logica e acoperită de teste unitare (`preferinte.test.ts`, `create.test.ts`).
- Notificările reale din listă (contul demo nu are) și abonarea la push (service worker-ul nu pornește în modul dezvoltare, iar browserul de test are notificările refuzate).
- „Sunt la fermă: folosește locul de acum” (locația în browserul de test) și salvarea telefonului și localității fermei; schimbarea parolei și a telefonului contului (contul demo nu are parolă).
- Ștergerile, reîncărcarea și ieșirea din demo (nu le-am dus la capăt, cum cere promptul).
- Spațiul asociației (`/mai-mult?spatiu=asociatie`), contul de operator și de superadmin (Admin, Schimbă ferma): contul demo nu are aceste roluri.
- Testele e2e (scriu în producție).

## Verificări

- `npm run lint`: doar cele 2 erori vechi (`analytics-magazin/page.tsx`, `ui/app-date-picker.tsx`).
- `npm run typecheck`: trece.
- `npm run check:kit`: trece (132 de fișiere). `settings/echipa/EchipaClient.tsx` e în `KIT_RULE_PENDING_FILES`: Echipa rămâne pe ecranul ei vechi.
- `npm run test:critical:unit`: 432 din 434. Cele 2 care pică (`integrations/google` callback și connect, depășire de 5 s la primul test) pică la fel pe `main` `8f69aa8`; separat trec. Noi: `preferinte.test.ts`, `create.test.ts` (adăugat în suită), `setari-legacy-links.test.ts`.
- `npm run build`: trece.
