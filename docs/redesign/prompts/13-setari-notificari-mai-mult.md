# Prompt 13 — Mai mult + Notificări + Setări (ecranele)

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/setari` (pornit din `main` `8f69aa8`) · Rezultat: migrare scrisă (NEAPLICATĂ), branch verde, cu push, fără merge

## Context

- **Mockup aprobat** (20.11): https://claude.ai/artifact/VmUHX55R1qC6Xm5oRm62K7. Are 10 ecrane: Mai mult, Notificări, Ce primești, Setări, Ferma, Aspect și Contul tău, plus variantele de noapte. Le poți citi prin Artifact; textele de acolo sunt de urmat.
- **Model de modul refăcut:** Recoltări (`src/app/(dashboard)/recoltari/`, `src/components/recoltari/`). Folosești doar kitul (`@/components/kit`) și tokenii canonici. Regulile din `CLAUDE.md` → „Kitul de componente” sunt obligatorii.
- **Ce e acum:**
  - „Mai mult” e o foaie (`src/components/app/MoreMenuDrawer.tsx`), deschisă din `BottomTabBar.tsx`;
  - `/settings` e o pagină lungă de 1664 rânduri (`src/app/(dashboard)/settings/page.tsx`) și include `src/components/setari/SetariFerma.tsx` (preț standard, ce arată Acasă, ștergerea clienților);
  - `/notificari` e în `NotificariPageClient.tsx`, iar clopoțelul în `src/components/notifications/NotificationBell.tsx` (folosit în `PageHeader`).
- **Notificările de azi** (tabelul `notifications`, câte una pe `user_id`):
  - `order_new` și `order_status_changed` (magazin/asociație);
  - memento-urile pentru butași din `src/app/api/cron/butasi-delivery-reminders/route.ts`;
  - câteva `system` / `product_listed` / `producer_approved` / `weekly_sales_summary` / `tratament_reminder`.
  - Push-ul pleacă din `src/lib/notifications/create.ts` → `send-push.ts`.

## Decizii (Andrei, 20.11)

1. **„Mai mult” devine pagină întreagă**, ruta `/mai-mult`. Tab-ul 5 din bara de jos devine link și rămâne aprins pe pagină. Foaia dispare.
2. **Ecranele notificărilor se fac acum. Verificarea zilnică de pe server (îngheț, comenzi de mâine, bani de încasat, rezumat) NU intră în acest prompt.** Preferințele se salvează acum, ca jobul de mai târziu să le găsească.
3. **Din Setări se scot:**
   - istoricul chatului AI (secțiunea „Asistent AI”);
   - „Tip interfață” compact/normal.

   „Schimbă ferma” rămâne doar pentru cine îl vede și azi, iar „Mod demo” doar în conturile demo.
4. **Echipa și Documentele legale rămân pe ecranele lor** (`/settings/echipa`, `/settings/documente-legale`). Se mută doar intrarea către ele.
5. **Liniște noaptea: 22:00–6:00.** Gerul face excepție.

## Ce faci

1. **Migrarea** `supabase/migrations/20261120130000_notificari_preferinte.sql`, aditivă. **NU o aplici.**
   - Tabel nou `public.notificari_preferinte`, cu coloanele:
     - `user_id uuid primary key references auth.users(id) on delete cascade`;
     - `tipuri jsonb not null default '{}'::jsonb`;
     - `liniste_noaptea boolean not null default true`;
     - `updated_at timestamptz not null default now()`.
   - RLS pornit, cu politici select / insert / update `to authenticated` pe `user_id = auth.uid()`. Fără delete.
   - Fără funcții `SECURITY DEFINER`. Dacă totuși îți trebuie una, respecți regula din `CLAUDE.md`.
   - Codul merge și fără tabel (feature detection, ca în `src/lib/schema-features.ts`): ecranul arată valorile implicite, toate pornite, iar salvarea dă un mesaj clar.
2. **Pagina „Mai mult”** (`src/app/(dashboard)/mai-mult/`):
   - **Sus:**
     - titlul;
     - clopoțelul cu numărul de necitite (aceeași sursă ca `NotificationBell`), care duce la `/notificari`;
     - cardul fermei (nume, utilizator, rol, localitate), care duce în Setări.
   - **Plăcile:**
     - grupul „Ferma”: Parcele, Activități, Stocuri, Produse, Material săditor, Rapoarte;
     - grupul „Bani și oameni”: Vânzări, Cheltuieli, Investiții, Clienți, Culegători.
     - Păstrezi regulile de azi din `MoreMenuDrawer`: `canSeeParcele`, ce e deja în bara de jos nu se repetă, numărul de comenzi în livrare dacă există.
   - **Jos:**
     - Setări;
     - Ajutor pe WhatsApp (același număr și link ca widgetul beta, fără număr nou scris de tine);
     - „Ieși din cont”, prin formularul POST existent către `/api/auth/sign-out`, cu `prepareClientBeforeServerSignOut`.
   - **Admin** apare doar pentru superadmin, ca azi.
   - **Asociație:** în spațiul asociației (`inAssociationWorkspace`) pagina arată ce arăta foaia (Oferte, Fermieri, Membri, Setări, Vezi magazinul, Înapoi la fermă). Doar o muți, nu o refaci.
   - Ștergi `MoreMenuDrawer` dacă nu-l mai folosește nimic.
3. **Notificări** (`/notificari`):
   - `Segments` Toate / Necitite (cu număr);
   - grupuri Azi / Ieri / Săptămâna asta / Mai vechi;
   - rândul are iconiță pe tip, titlu, text, ora și punctul de necitit;
   - atingerea marchează citit și duce unde duce azi (refolosești logica din `NotificationPanel` / `NotificariPageClient`);
   - „Marchează toate ca citite” jos, doar când există necitite;
   - starea goală: „Le-ai citit pe toate”;
   - butonul din dreapta sus duce la „Ce primești”.
4. **Ce primești** (`/notificari/setari`):
   - **Comutatorul principal**, „Notificări pe telefon”, refolosește logica din `PushNotificationsSettings` (abonare/dezabonare).
   - **7 comutatoare**, cu textele din mockup și cheile din `tipuri`:

     | Cheie | Text | Ce acoperă |
     |---|---|---|
     | `noi` | Comenzi noi | `order_new` |
     | `maine` | Comenzi de mâine | memento-ul pentru butași din cron |
     | `rest` | Bani de încasat | — |
     | `meteo` | Îngheț și grindină | — |
     | `pauza` | Pauza după tratament | `tratament_reminder` |
     | `sapt` | Săptămâna ta | `weekly_sales_summary` |
     | `acte` | Echipa și documentele | `system`, `producer_approved`, `product_listed` |

     Cheie lipsă = pornit.
   - **„Liniște noaptea”.**
   - Sub listă scrii: „Ce oprești aici nu mai sună pe telefon. Rămâne în lista de notificări.”
   - **În `create.ts`:** înainte de push, citești preferințele utilizatorului. Dacă tipul e oprit, nu trimiți push, dar rândul din `notifications` se creează în continuare. Dacă e liniște noaptea (22:00–6:00, `Europe/Bucharest`) și tipul nu e `meteo`, nu trimiți push.
   - Mapping-ul tip → cheie stă într-un singur loc (`src/lib/notifications/preferinte.ts`), cu test unitar. Mapping-ul pentru `order_status_changed` îl hotărăști tu și îl explici.
5. **Setări** (`/settings`): pagina devine o listă pe 4 grupuri, ca în mockup. Fiecare rând deschide o subpagină:
   - **Ferma** (`/settings/ferma`):
     - nume, telefon pentru clienți, localitate;
     - „Locul fermei pe hartă”: refolosești salvarea din secțiunea „Locație fermă” de azi și mesajele din `src/lib/livrari/device.ts` pentru localizare refuzată;
     - Salvează.
   - **Prețul standard** (`/settings/pret-standard`) și **Ce arată Acasă** (`/settings/acasa`): muți `PretStandardSection` și `AcasaSection` din `SetariFerma.tsx`, cu aceeași logică și salvare (`src/lib/farm-settings.ts`), pe kit.
   - **Notificări** duce la `/notificari/setari`.
   - **Aspect** (`/settings/aspect`):
     - Automat / Zi / Noapte (`next-themes`);
     - Mărimea Normală / Mare;
     - Contrast ridicat;
     - previzualizarea din mockup.
     - Citești întâi ce fac azi `html.high-visibility-mode` și `data-density` (`src/app/globals.css`, `DensityProvider`, `HighVisibilityInit`). „Mare” = ținte și text mai mari, „Contrast ridicat” = culori și borduri mai tari, cu tokenii canonici. Dacă mecanismul de azi le leagă și nu se poate despărți simplu, scrii în raport ce ai făcut.
     - Cine avea `compact` trece pe Normală.
     - Valorile rămân salvate pe dispozitiv, ca azi.
   - **Echipa** și **Documente legale** duc la paginile de acum, iar textul de sub titlu arată starea (câte persoane; complete / ce lipsește / când expiră, dacă datele există). **Abonament** duce la `/planuri`.
   - **Contul tău** (`/settings/cont`), toate pe fluxurile existente, mutate pe kit:
     - email, schimbarea parolei, telefonul contului;
     - „Descarcă datele” (exportul GDPR de azi);
     - grupul „Ireversibil”: „Șterge datele fermei” (`/api/gdpr/farm`), „Șterge contul” (`/api/gdpr/account`) și ștergerea tuturor clienților din `SetariFerma`. Fiecare cere confirmare în același ecran, cu parola acolo unde o cere și azi.
     - Fără foi peste foi.
   - **Mod demo** și **Schimbă ferma** sunt rânduri doar pentru cine le vede azi.
   - **Legăturile vechi** (`/settings#profil`, `#tema`, `#notificari-push`, `#echipa`, `#gdpr`, `#parola`, `#documente-legale` etc.) duc la subpagina nouă potrivită. Cauți toate locurile care le folosesc.
6. **Desktopul** doar să funcționeze: sidebarul duce la paginile noi, iar paginile nu se strică la lățime mare. Fără design separat.
7. **Kitul:** adaugi în `KIT_RULE_DIRS` folderele refăcute: `src/app/(dashboard)/mai-mult`, `src/app/(dashboard)/notificari`, `src/app/(dashboard)/settings` și `src/components/setari`, plus ce componente noi creezi. Nu adaugi foldere pe care nu le refaci (ex. `src/components/notifications` dacă rămâne cum e).
8. **Verificări:**
   - `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`;
   - test unitar pentru mapping-ul și regula de liniște din `preferinte.ts`.
   - Testezi în browser, la 390 px, zi și noapte, **doar într-un cont demo** (`/start` → „Continuă fără cont”):
     - Mai mult → fiecare placă;
     - Notificări, marcarea ca citite;
     - Setări → fiecare subpagină;
     - salvarea numelui fermei și a prețului standard;
     - Aspect: tema și mărimea.
   - Ștergerile NU le apeși până la capăt, nici în demo: verifici doar că apare confirmarea.
9. **Raportul** în `docs/redesign/raport-setari.md`:
   - ce s-a mutat unde;
   - ce s-a scos;
   - legăturile vechi și unde duc acum;
   - ce n-ai putut testa;
   - cum ai rezolvat Mărime / Contrast.

   Apoi `git restore public/sw.js`, commit, `git push origin redesign/setari`. **STOP. Fără merge.**

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
