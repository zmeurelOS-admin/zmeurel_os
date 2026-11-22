# Prompt 25 — Deciziile după noaptea 24, viteză, desktop

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport. Branch nou din `main` (`95b5f65`): `redesign/decizii-25`. Commit-uri mici, push după fiecare bucată. Fără merge.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, rapoartele `docs/redesign/raport-22…24*.md`, mai ales `raport-24-noapte.md` (tabelul RLS și deciziile).

**Ordinea contează.** Dacă timpul nu ajunge, se termină întâi părțile 1–4.

---

## 1. De ce n-a rulat curățarea demo-urilor

În noaptea 21→22.11 n-a șters nimic: 113 demo-uri mai vechi de 24 h au rămas. Cauza e una din două:
- `DEMO_CLEANUP_MODE` nu e `sterge`;
- în lot a fost un „semn de fermă reală”, iar modul `sterge` oprește atunci toată rularea (`src/app/api/cron/demo-tenant-cleanup/route.ts`).

**Ce faci:**
- **Nu apelezi ruta de cron.** Rulezi local, cu service role, doar citire, aceeași selecție ca modul `proba`: `selecteazaDemoDeSters` + `reverifica` pe primul lot. Faci un script în `scripts/` care nu scrie nimic.
- Notezi în raport: câte ar fi de șters, ce semne de fermă reală apar, la ce tenanturi și de ce.
- **Schimbi regula:** un candidat cu semn de fermă reală **se sare și se raportează**. Restul lotului se șterge. Așa nu se mai blochează totul din cauza unuia. Ferma suspectă rămâne neatinsă, deci siguranța e aceeași.
- Test unitar: lot cu un candidat suspect → ceilalți se șterg, suspectul rămâne în răspuns la `sariteFermaReala`.
- Dacă semnele găsite sunt false (de ex. un operator ascuns dezactivat sau o redenumire de fermă), repari și regula semnului, cu test.

## 2. Citirea banilor și a actelor: doar proprietarul

Decizia lui Andrei: **vânzările, cheltuielile, investițiile și actele fermei le citește doar proprietarul.** Politicile superadminului și ale asociației rămân.

- Migrare aditivă, NEAPLICATĂ, pe `vanzari`, `cheltuieli_diverse`, `investitii`, `farmer_legal_docs`: SELECT cu `tenant_id = current_tenant_id() and is_tenant_owner(tenant_id)`.
- **Excepții, ca să nu se strice ce folosește operatorul.** Cauți în cod ce citește un operator din aceste tabele: Comenzi, Livrări, Recoltări, Acasă, notificări, Rapoarte.
  - Operatorul cu „Scrie” pe Recoltări trebuie să poată citi rândul automat „Manoperă cules” (`[AUTO_MANOPERA]`) pe care îl actualizează. Politica îi lasă doar acel rând.
  - Dacă Comenzi / Livrări arată starea plății din `vanzari`, faci un RPC `SECURITY DEFINER` sau un view restrâns care dă doar câmpurile necesare, cu verificarea dreptului pe modul. Nu lași tabelul deschis.
  - Acasă pentru operator nu arată bani.
- Test: operator din link (demo nou) cu Comenzi + Recoltări pe „Scrie”. Lucrează normal (livrare, recoltare cu manoperă automată), dar `select` direct pe `vanzari` / `investitii` / `farmer_legal_docs` întoarce 0 rânduri.

## 3. Material săditor: scrie doar proprietarul

Pe `vanzari_butasi*` (și ce mai ține de modul, vezi raportul 24): INSERT / UPDATE / DELETE doar pentru proprietar. Citirea rămâne cum e. Migrare aditivă, neaplicată. Modulul nu se reface.

## 4. Limita AI la „Din mesaj”

Raportul 24: `check_and_increment_ai_usage` refuză apelul cu service role, iar ruta (`parse-order` și celelalte `paste-to-*`, prin `paste-to-x-handler-factory.ts`) lasă cererea să treacă. Deci limita nu se aplică.

- Faci limita să meargă: apelul cu sesiunea utilizatorului (`createClient()`) sau o variantă a funcției care primește utilizatorul verificat pe server. Fără să deschizi funcția pentru `anon`.
- Dacă limita nu se poate verifica, cererea e refuzată, cu mesaj în română.
- Limitele rămân cele din `CLAUDE.md`.
- Test unitar: peste limită → refuz; eroare la verificare → refuz.
- Repari și testul `parse-order` care pica deja (raportul 24) și îl pui în `test:critical:unit`.

## 5. Operatorul vede doar modulele lui

- Bara de jos (`BottomTabBar`) și bara laterală pe desktop arată unui operator doar modulele cu drept „Citește” sau „Scrie”, plus „Mai mult”.
- Dacă are un singur modul, bara are modulul + „Mai mult”.
- Butonul plutitor „+” nu apare pe modulele unde operatorul are doar „Citește”.
- Proprietarul vede exact ce vede azi.
- Test: operator din link doar cu Recoltări → bara are Recoltări + Mai mult.

## 6. Viteza paginilor (partea 4 din 24)

Măsori numărul de cereri Supabase și timpul până la date pe Comenzi, Livrări, Recoltări, Stocuri, Tratamente, Parcele, Lucrări, Rapoarte și Clienți. Folosești un cont demo nou, build de producție local, pe mobil.
- Paginile cu peste 15 cereri primesc tratamentul de la Acasă din 22.
- Nu schimbi ce arată paginile.
- Pui în raport un tabel înainte/după.

## 7. Desktopul „să funcționeze” (partea 5 din 24)

Treci la 1280 px și 1024 px prin modulele refăcute. Repari doar ce e stricat: conținut tăiat sau suprapus, foi care nu se închid sau ajung sub bara laterală, butoane care nu se pot apăsa, tabele fără scroll. Nu redesenezi nimic. Screenshot-urile înainte/după le pui în `docs/redesign/screenshots/25/`.

## Ce NU atingi

Asociația, chatul AI (în afară de limita din partea 4), `/start`, Login, Admin, magazinul `comanda.zmeurel.ro`, aspectul modulelor refăcute, logica de bani, variabilele din Vercel, cronurile (nu le apelezi), `public/sw.js`.

## Verificări și raport

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`: toate trec pe codul final.
- **Teste în browser:** doar într-un cont demo nou. Verifici întâi că tabul nu e logat într-un demo vechi (`/api/auth/sign-out`). Operatorii ascunși sunt legați doar de demo-ul nou; la final îi dezactivezi. Notezi tenantul în raport.
- **Migrările:** scrise în `supabase/migrations/`, aditive, NEAPLICATE. Pentru fiecare spui dacă aplicația merge fără ea și dacă merge **cu** ea pe codul de azi din `main`, ca să știu ordinea: migrare înainte sau după merge. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-25-decizii.md`. Începe cu 10 rânduri pentru Andrei, apoi: cauza curățării, migrările cu SQL complet și ordinea lor, tabelul de viteză, desktopul, ce n-ai putut testa, verificările, hash-urile commit-urilor.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
