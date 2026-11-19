# Prompt 03b — Fundație: corecturi după verificarea pe preview

Model: Opus 5.5 · Effort: medium · Mod: plan · Sesiune: NOUĂ · Branch: `redesign/fundatie` (existent)

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier, `docs/redesign/tokens.md`, `docs/redesign/progres.md`. Trimite: cauza confirmată pentru fiecare problemă, fix-ul propus, lista exactă de fișiere atinse, cum verifici. **STOP. Aștepți aprobarea.**
2. **EXECUȚIE** — doar după „aprobat”. Commit-uri mici, câte unul pe problemă.
3. **RAPORT** — push pe `redesign/fundatie`, rezumat de max. 10 rânduri, link de preview (alias fix: `zmeurel-git-redesign-fundatie-zmeurelos-admins-projects.vercel.app`). **STOP. Fără merge.**

## Verificare făcută pe preview (18–19.11, browser, doar navigare)

Trecute: `dark:` urmează clasa aplicației (nu mai există `prefers-color-scheme` în CSS); noaptea pe mobil coerentă (dashboard, cheltuieli, dialoguri); dialogul de cheltuială stă peste bara de jos (overlay z 1000, nav z 50, FAB z 60 acoperit); speed dial-ul din Comenzi acoperă bara de jos; lista din Select (z 1020) se deschide peste dialogul de recoltare (z 1010); foaia de sortare din Material săditor stă peste bara de jos; Livrări ziua arată ca înainte; magazinul public `/magazin/asociatie` identic cu producția, zi și noapte.

## Probleme de reparat

### 1. Regresie: antetul desktop de pe dashboard, noaptea, e ilizibil (BLOCANT pentru merge)

- Pe desktop (`lg`), modul noapte: titlul „Bună dimineața”, data, numele utilizatorului și pastilele (Comenzi, Livrări, Recoltări, Clienți) apar cu text închis pe verde foarte închis.
- Cauză (verificată în cod): antetul folosește fundal `--agri-hero-bg` și text `--text-on-accent` (`PageHeader.tsx` l. 61–91, `dashboard/page.tsx` l. ~1489–1523). Pe `main`, în `.dark`, `globals.css` (încărcat după `theme.css`) suprascria `--agri-hero-bg: #3D7A5F`, iar valoarea din `theme.css` (`#0d2318`) nu se vedea. După consolidarea în `theme.css`, a rămas `#0d2318`, iar `--text-on-accent` → `--primary-contrast` = `#08140e` noaptea → text aproape negru pe fundal aproape negru.
- Fix cerut: valoarea efectivă de pe `main` trebuie păstrată (`--agri-hero-bg` noaptea = `#3D7A5F`), sau alternativ un fundal de noapte cu text deschis care trece 4.5:1. Propune varianta în plan, cu contrastul calculat.
- **Verificare sistematică obligatorie**: pentru TOȚI tokenii de componentă păstrați (`--agri-hero-*`, `--brand-*`, `--indicator-*`, `--cta-*`, `--skeleton-*`, hover-uri etc.), compară valoarea efectivă `main` vs `redesign/fundatie`, zi și noapte (aceeași „fotografie” din browser ca la prompt 03, dar cu `.dark` aplicat pe `<html>`). Orice diferență care nu e în lista aprobată din `progres.md` se readuce la valoarea de pe `main`. Pune tabelul în `tokens.md`.

### 2. Paginile de autentificare, noaptea (bug de corectat acum)

- `/reset-password` (și probabil `/login`, `/update-password`): card cu fundal alb scris direct (`bg-white`, `bg-gray-50`, `text-[#312E3F]`), dar `Label`/`Input` din `components/ui` iau culorile de noapte → eticheta „Email” aproape invizibilă, câmpul gri pe alb (văzut pe telefon, cu telefonul pe întunecat și tema „Sistem”).
- Fix cerut, minimal: paginile din `(auth)` rămân luminoase indiferent de temă (de ex. un wrapper care aplică tema de zi pe acel subarbore), FĂRĂ redesign. Verifici că `/login`, `/reset-password`, `/update-password`, `/start` arată identic cu `main` ziua și lizibil noaptea.

## Reguli

- Fără alte schimbări vizuale. Fișiere atinse: doar ce e în planul aprobat (așteptat: `src/styles/theme.css`, eventual layout-ul `(auth)`, `docs/redesign/tokens.md`, `docs/redesign/progres.md`).
- `public/sw.js` nu intră în commit.
- După fiecare commit: `npm run lint` (3 erori vechi acceptate) + `npm run typecheck`; la final `npm run build`.
- Nu faci merge în `main`. Nimic în baza de date.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
