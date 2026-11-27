# Prompt 34 — final: corecturi din testarea pe ferma reală + desktopul pe interfața nouă

Model: Opus 5.5 · Effort: high

## Context
Caietul Fermei (caietulfermei.ro, fost Zmeurel OS). Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase (RLS, current_tenant_id()), Vercel. Repo zmeurelOS-admin/zmeurel_os; producția = main (a5b60e1). Ultimul prompt al revamp-ului; punctele vin din testarea lui Andrei pe ferma lui (zmeură Maravilla + Delniwa, două recolte pe an).

## Fluxul
1. Întâi planul, apoi te oprești până la aprobare.
2. După aprobare: branch nou redesign/34-final din origin/main; commit + push după fiecare secțiune; fără merge în main.
3. La final: raport docs/redesign/raport-34-final.md (pe secțiuni, commit-uri, migrări, teste, ce n-ai putut testa, capturi la 360 px și 1440 px).

## §1 Lăstari: „Tai tot / Păstrez” la rânduri vechi
Butoanele nu apar când „După recoltare” e salvat fără lăstar (rânduri vechi, fără cohortă). În modul an1_an2, rândul fără cohortă = lăstar de an 1, doar pentru afișarea butoanelor; datele nu se rescriu. Test unitar.

## §2 „Lăstar an 1: Tăiat” pe fișa parcelei
Recomandare: rămâne vizibil, cu data. Întrebare în plan.

## §3 Scoate punctul verde „Ești în beta”
src/components/beta-widget.tsx (din DashboardShellSlots.tsx) se scoate; stă și peste „⋯” pe fișa parcelei. În Mai mult: rând „Scrie-mi o problemă sau o sugestie” → WhatsApp (SUPPORT_WHATSAPP_URL), ascuns pentru superadmin. Componenta veche se șterge dacă nu mai e folosită.

## §4 Invitația de instalare (PWA) în platformă
Azi PWAInstallPrompt e doar în magazin (src/app/comanda/layout.tsx); refolosește-l. Recomandare (întrebare în plan): doar cont real, nu demo; de la a doua zi de folosire sau după prima salvare; bandă jos „Pune Caietul pe ecranul telefonului · Instalează” (beforeinstallprompt pe Android, instrucțiuni pe iPhone: Distribuie → Adaugă pe ecranul principal); închisă = 30 de zile; nu apare dacă e instalată (display-mode: standalone); rând „Instalează aplicația” în Mai mult cât nu e instalată. Nu atinge public/sw.js și nici comportamentul magazinului.

## §5 Blocare la „înapoi” cu swipe (Android, aplicația instalată)
Văzută pe fișa parcelei (Maravilla 1); detaliile exacte nu se știu încă. Bănuială: intrările din istoric puse de BottomSheet / StepForm rămân încurcate după închiderea foii (buton, salvare, tragere în jos, „înapoi”). Auditează mecanismul, reprodu în Playwright (mobil: deschizi/închizi foi pe fișa parcelei pe toate căile, apoi page.goBack() repetat) și repară: fiecare foaie lasă istoricul cum l-a găsit. Test e2e: după 2–3 foi deschise și închise, „înapoi” duce la ecranul anterior din prima și nu se blochează. Dacă nu reproduci, spune în plan ce ai găsit și ce propui.

## §6 Fișa parcelei
- Titlurile rândurilor se taie („Pune data cules…”, „Analiza sezonului: netrim…”) → titlul întreg, pe două rânduri.
- Fără dată de cules: notița albastră „Pune data culesului pe parcele…” dublează rândul „Pune data culesului” → rămâne doar rândul.
- „+ Lucrare / + Tratament” plutitoare acoperă „Jurnal / Sezon” și jurnalul → spațiu jos = înălțimea lor + zona sigură.

## §7 Lucrări → „Altele”
- Pasul 2: câmp obligatoriu „Ce ai făcut?”; textul devine titlul lucrării în jurnal (ex. „Plasă de umbrire: demontat și legat”), nu „Altele” + notă.
- Textele folosite des la „Altele” apar ca alegeri rapide în pasul 1 (per fermă, ~5 cele mai folosite, derivate din date; fără tabel nou dacă se poate).
- Recomandare: fără tip fix nou pentru plasă (întrebare în plan). Lucrările „Altele” vechi se afișează ca acum.

## §8 Tratament → „La sol” (gunoi de grajd, îngrășăminte solide)
Verifică întâi ce e azi (formular, salvare, registru/jurnal/stoc) și descrie în plan. Țintă: unitate pe suprafață — kg sau t pe parcelă sau la ha (cu conversia afișată), nu doar g/plantă; produsul se poate scrie de mână, fără catalog/magazie; în registru apar corect cantitatea și unitatea. Coloane noi doar prin migrare aditivă.

## §9 Text care iese din chenar
- Produs nou (Tratamente/Magazia), „Ce fel de produs”: „Îngrășământ”, „Biostimulator” ies din plăci → să încapă (2 pe rând sau text micșorat; fără tăiere).
- Magazia „Am cumpărat”, pasul 2: „Cantitate” iese din câmp (ex. 846488) → câmpul crește / cifrele se micșorează; confirmare „Sigur?” peste un prag pe unitate (propune pragurile).
- Test Playwright: deschide ecranele și formularele refăcute (Acasă, Livrări, Recoltări, Comenzi, Mai mult, Tratamente cu taburile, Magazia, Parcele + fișa, Lucrări, Echipa, Setări, foile principale de adăugare) la 360 px și cu text mare (setarea Aspect); pică la orice buton, placă, câmp sau titlu cu text tăiat/ieșit din chenar (scrollWidth > clientWidth, scrollHeight > clientHeight unde nu e scroll permis; excepții doar listate explicit în test). Rulează în demo. Repară tot ce găsește.

## §10 Desktopul pe interfața nouă
Verificat 27.11 la 1440 px: cadrul e vechi (bara laterală „Dashboard” + grupuri FERMĂ / COMERCIAL / FINANȚE / ADMINISTRARE; bara de sus cu „Comenzi · Livrări · Recoltări · Clienți” și „Editează”); /dashboard arată cardurile vechi („Ce ai de făcut azi”, „Meteo azi”, „Recomandări pentru azi”, „Magazinul meu”, „Operațional și recent”). Modulele sunt noi, dar într-o coloană îngustă. Pe telefon totul e nou.
Țintă (desktopul doar „să funcționeze”, fără layout-uri dedicate):
- Bara laterală = aceeași navigație și aceleași nume ca pe telefon: Acasă · Livrări · Recoltări · Comenzi, apoi rândurile din Mai mult (aceeași sursă de date pentru ambele). Logo „Caietul Fermei”. Fără grupurile vechi, fără chipurile și „Editează”; clopoțelul și contul rămân.
- /dashboard pe desktop = aceeași Acasă ca pe telefon (coloană ~720 px sau 2 coloane — recomandă). Cardurile vechi ies.
- Coloana modulelor lărgită (~720–960 px, propune); BottomSheet pe desktop ca dialog centrat, dacă nu e deja.
- Componentele vechi nefolosite (shell vechi, carduri vechi, editarea layout-ului) se șterg; listează-le în plan.
- Test e2e la 1440 px: Acasă nouă pe /dashboard; nu apar „Dashboard”, „Operațional și recent”, „Recomandări pentru azi”; bara laterală duce în fiecare modul. Rulează și testul de la §9 la 1440 px.

## Reguli
- Local și preview folosesc baza de PRODUCȚIE (ilybohhdeplwcrbpblqw). Scrieri doar în ferme demo (@demo.zmeurel.local). Nu atinge ferma reală 99485d6b-f186-49db-a379-bb9a12d34968.
- Migrări doar aditive, în supabase/migrations/, NU le aplica tu; politici modificate cu alter policy, nu drop/create. SECURITY DEFINER noi: revoke ... from public, anon + verificare internă a fermei/utilizatorului.
- Interzise: comiterea public/sw.js, git commit -a, slăbirea .claude/settings.json, apelarea cronurilor în producție, cheile secrete, schimbări în package.json fără motiv scris în plan.
- Nu schimbi deciziile din docs/redesign/. Texte în română, pe limba fermierului.
- Înainte de fiecare push: npm run test:critical:unit, npm run check:critical, npm run build; la final și npm run test:e2e:smoke + testele noi.
- Dacă te oprești la limita de utilizare: notează în raport ce e gata și ce rămâne, în ordine.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
