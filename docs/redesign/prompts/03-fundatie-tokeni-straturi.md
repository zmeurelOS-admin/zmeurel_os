# Prompt 03 — Faza 1a: Fundația (modul noapte, straturi, tokeni)

Model: Fable 5.2 · Effort: high · Mod: plan · Sesiune: NOUĂ · Branch: `redesign/fundatie` (din `main`) · Rezultat: branch + preview Vercel + `docs/redesign/tokens.md`

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier, `CLAUDE.md`, `docs/redesign/audit.md` (Rezumat, 1.1–1.4, 3.1, 3.3, 5, 6 cu blocul „Decizii”, Anexele C și D) și `docs/redesign/progres.md`. Trimite:
   - numele finale ale tokenilor noi (tabel: token → valoare zi → valoare noapte → ce tokeni vechi devin alias spre el), inclusiv cum reconciliezi cu setul shadcn (`--primary`, `--border`, `--background` …);
   - scara de straturi și lista exactă de locuri unde o aplici;
   - cum rezolvi stratul `z-10` din `AppShell` și ce verifici după;
   - ce faci cu blocul `@media (prefers-color-scheme: dark)` din `globals.css`;
   - lista schimbărilor vizibile pe care le aștepți (ideal: doar modul noapte devine coerent și foile/ferestrele stau peste bara de jos);
   - lista exactă de fișiere atinse și comenzile de verificare.
   **STOP. Aștepți aprobarea.**
2. **EXECUȚIE** — doar după „aprobat”. Exact planul aprobat, în commit-uri mici, câte unul pe pas (de mai jos). La orice abatere te oprești și întrebi.
3. **RAPORT** — push pe `redesign/fundatie`, rezumat de max. 15 rânduri, linkul de preview Vercel (îl iei din lista de deployment-uri), lista de verificări pe telefon. **STOP. Fără merge în main.**

## Context

Faza 0 (audit) și curățenia sunt pe `main`. Faza 1 se face în două prompturi: **03 = fundația** (acest prompt), **04 = componentele kitului + pagina `/admin/kit`**. Fundația nu redesenează nimic: pregătește terenul ca modulele să poată fi refăcute pe un singur set de tokeni, fără să le strice pe cele încă nerefăcute.

Decizii deja luate (audit, secțiunea 6): tema coral dispare, dar **nu în acest prompt** — dispare la refacerea fiecărui modul (Recoltări, apoi Comenzi + Livrări). Asociația, desktopul și chat-ul AI sunt în afara revamp-ului; modulele refăcute nu au voie să strice desktopul actual.

## Pași (fiecare = un commit)

1. **Branch** — `git checkout -b redesign/fundatie origin/main`.
2. **Modul noapte pe clasa aplicației.**
   - În `src/app/globals.css` adaugi `@custom-variant dark (&:where(.dark, .dark *));`.
   - Analizezi blocul `@media (prefers-color-scheme: dark)` (~l. 637): dacă dublează `.dark`, îl elimini sau îl muți pe `.dark`, ca tema să urmeze doar alegerea din aplicație.
   - `ThemeProvider` rămâne `attribute="class"`, `defaultTheme="system"` (la prima pornire urmează telefonul, apoi alegerea din Setări). Verifici că `tailwind.config.ts` nu mai e necesar pentru `darkMode`; nu îl ștergi în acest prompt dacă mai e folosit la altceva.
3. **Scara de straturi.**
   - Tokeni de strat (propunerea din audit: navigare 50, FAB 60, fundal 1000, foaie/dialog 1010, listă derulantă 1020, notificare 1030), expuși în `@theme` ca să existe clase scurte.
   - Aplici scara în: `BottomTabBar`, FAB-ul (`UnifiedMobileFab`), butonul AI, `ui/dialog`, `ui/sheet`, `ui/alert-dialog`, `ui/popover`/`select`/`dropdown-menu`, `Toaster`, `TopBar`/antet, `StickyActionBar`, `AppDialog`/`AppDrawer`.
   - Rezolvi stratul `z-10` de pe conținutul din `AppShell.tsx` (~l. 24), care închide tot ce e randat în pagină sub bara de jos și sub FAB. Verifici în cod cele două cazuri cunoscute (speed dial-ul din Comenzi, bara „Livrate x / y”) și orice alt element `fixed` randat în pagină din Anexa C.
4. **Setul nou de tokeni pe roluri** (principal, suprafață, text, contur, stări info/succes/atenție/pericol cu `-bg`/`-text`/`-border`, raze 12/16/22/28 + full, umbre 1/2/suprapunere, atingere 48/56 legată de `--touch-control-h*`), definit o singură dată în `:root` și `.dark`, expus în `@theme inline`. Valorile se iau din cele dominante azi (verdele aplicației), ca modulele nerefăcute să nu se schimbe vizual.
5. **Aliasuri.** Toate familiile vechi din Anexa D (`--agri-*`, `--surface-*`/`--text-*`, `--soft-*`, `--status-*` etc.) devin alias spre setul nou. Unde seturile paralele au valori diferite, alegi după contrast și listezi diferențele în `tokens.md`. Cei 7 tokeni folosiți dar nedefiniți primesc alias. **Nu** înlocuiești utilizările din module și **nu** atingi `zmeurel-orders.module.css` (tema coral).
6. **`docs/redesign/tokens.md`** — referința pentru Faza 1b și pentru module: token → zi → noapte → clasă Tailwind → aliasuri vechi → regula de folosire. Scara de text (26/22/19/17/15/13 + 64 pentru cifra mare; câmpuri min. 16 px, folosim 17; 13 doar pentru text ajutător) și scara de straturi, tot aici. În `CLAUDE.md`, rândul „Design tokens” trimite la `docs/redesign/tokens.md`.
7. **`docs/redesign/progres.md`** — ce s-a făcut, ce s-a schimbat vizibil, ce trebuie verificat pe telefon.

## Verificare

- După fiecare commit: `npm run lint` (cele 3 erori existente sunt acceptate, nicio eroare nouă) și `npm run typecheck`.
- La final: `npm run build` și `npm run test:critical:unit` (timeout-urile de mediu se consemnează, nu se repară).
- `git grep` care arată că nu a rămas niciun token vechi fără definiție.
- Lista de verificat pe telefon, pe preview, include obligatoriu: aplicația pe „Luminos” cu telefonul pe întunecat (bug-ul inițial), aplicația pe „Întunecat”, comutarea din Setări, o foaie și un dialog deschise peste bara de jos, FAB-ul ascuns sub dialog, butonul „înapoi” pe Android închide foaia, Comenzi/Livrări/Recoltări arată ca înainte.

## Reguli

- Fără redesign: nicio componentă nouă, niciun modul refăcut, nicio culoare schimbată intenționat în afara modului noapte.
- Fișiere atinse: doar ce e în planul aprobat (așteptat: `globals.css`, eventual `src/styles/theme.css`, componentele de strat din `components/ui` și `components/app`, `AppShell.tsx`, `CLAUDE.md`, `docs/redesign/*`).
- `public/sw.js` e generat de build: nu intră în niciun commit (`git restore public/sw.js` înainte de commit).
- Nu faci merge în `main`, nu deschizi PR. Nimic în baza de date.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
