# Redesign UI — progres

Ultima actualizare: 18 noiembrie 2026, după Faza 0.

| Fază | Stare |
|---|---|
| 0 — Audit UI | **gata**: `docs/redesign/audit.md` |
| 1 — Kit de design | neîncepută; așteaptă răspunsurile de mai jos |
| 2 — Mockupuri pe module | neîncepută |
| 3 — Implementare modul cu modul | neîncepută |

## Ce s-a făcut în Faza 0

- Inventarul celor 22 de rute din `src/app/(dashboard)` (inclusiv admin), cu fișiere, formulare și felul în care se desparte mobilul de desktop.
- Problemele care țin de toată aplicația, numărate cu `git grep` pe HEAD `1e3ca48` (comenzile sunt în Anexa F din raport).
- Componentele duplicate și lista de fișiere nereferite.
- Propunerea de kit: valori, 16 componente de extras din Material săditor, strategia de migrare a tokenilor.
- Ordinea propusă a modulelor și riscurile.

Cod neatins: singurele fișiere create sunt `docs/redesign/audit.md` și acest fișier. Nu s-a scris nimic în baza de date.

## Ce a rămas

- **Analytics.** Interogarea aprobată nu a rulat: conectorul Supabase din sesiune nu are acces la proiectul Zmeurel. Interogarea e în Anexa G. De știut: `view_module` e emis doar din 6 pagini, deci nu poate compara Comenzi sau Livrări cu restul.
- **Atribuirea țintelor mici pe ecrane.** Numărătoarea automată nu separă butoanele de iconițe; lista exactă pe ecran se face la mockupuri.
- **Teste.** Nu am rulat `lint`, `typecheck` și nici testele e2e. Unele e2e caută text fără diacritice și s-ar putea să pice deja.
- **Fișierele nereferite** (36) sunt candidați stabiliți după nume; înainte de ștergere trebuie un build de control.
- **Zona publică** (magazin, comandă, livrator, landing) apare doar în cifrele pe zone, nu are inventar detaliat.

## Decizii de care depinde Faza 1

1. Tema coral din Comenzi / Livrări / Recoltări: rămâne ca accent sau dispare?
2. Spațiul Asociație (`/asociatie/*`) intră în revamp?
3. Chat-ul AI nu are buton de deschidere — intenționat?
4. Desktop: păstrăm spațiul de lucru cu panou lateral sau trecem la varianta de telefon centrată?
5. Analytics: rulați voi interogarea sau reautorizați conectorul?
6. Ștergem codul nefolosit într-un commit separat înainte de Faza 1?

## De verificat pe telefon

Totul de mai jos e dedus din cod; nimic nu a fost văzut pe ecran.

| # | Unde | Ce verificați | De ce |
|---|---|---|---|
| 1 | `/asociatie/livrari`, cont de asociație | Se vede bara „Livrate x / y” de jos sau e acoperită de bara de navigare? | E `fixed bottom-0 z-20`, sub bara de jos (z 50). |
| 2 | `/comenzi`, apăsați „+” | Fundalul întunecat acoperă și bara de jos? Butonul de închidere stă peste FAB sau sub el? | Speed dial-ul e în stratul `z-10` al paginii. |
| 3 | Telefon pe temă luminoasă, aplicația pe „întunecat” (Setări) → `/parcele` | Apar panouri albe cu text deschis? | `bg-white` + `dark:` care ascultă de telefon. |
| 4 | Telefon pe temă întunecată, aplicația pe „luminos” → `/parcele`, `/login`, `/start` | Apar zone închise la culoare pe o pagină luminoasă? | Același motiv, invers. |
| 5 | Aplicația pe „întunecat” → `/comenzi`, `/livrari`, `/recoltari` | Rămân luminoase? Dialogul de confirmare a livrării are alte culori decât pagina? | Tema coral nu are variantă de noapte și nu ajunge în ferestrele din portal. |
| 6 | „Mai mult” din bara de jos | Apare ca fereastră la mijloc sau ca foaie de jos? | `AppDrawer` e de fapt un dialog centrat. |
| 7 | `/cheltuieli` → adăugare → categoria „Altele” și data | Se deschid selectorul și calendarul? | Sunt controale ascunse, deschise prin cod. |
| 8 | iPhone, orice formular vechi → atingeți un câmp de căutare dintr-un selector | Se mărește pagina la focus? | Câmpuri cu text sub 16 px. |
| 9 | `/vanzari-butasi` → foaia de sortare, apoi „înapoi” pe Android | Se închide foaia sau se schimbă pagina? | Foaia nu e legată de mecanismul de istoric al dialogurilor. |
| 10 | Orice pagină | Există vreun buton care deschide chat-ul AI? | Nu am găsit niciun apel care să-l deschidă. |
| 11 | `/clienti-magazin` și `/analytics-magazin` pe telefon (adresă scrisă de mână) | Au antet? Tabelul se derulează lateral? | Nu folosesc `AppShell`; nu sunt în meniul de mobil. |
| 12 | `/recoltari` → adăugare, pe un telefon mic | Butonul „Salvează” rămâne vizibil cu tastatura deschisă? | Dialog centrat cu înălțime maximă 88 % din ecran. |
