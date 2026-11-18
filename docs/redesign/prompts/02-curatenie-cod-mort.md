# Prompt 02 — Curățenie: fișiere nefolosite (înainte de Faza 1)

Model: Opus 5.5 · Effort: medium · Mod: plan · Branch: `redesign/cleanup` (din `redesign/audit`) · Rezultat: commit-uri pe branch + link de preview Vercel

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier, `docs/redesign/audit.md` (Anexa E, secțiunile 1.3, 3.3, 6) și `CLAUDE.md`. Reverifici fiecare fișier din Anexa E (metoda de mai jos) și trimiți:
   - tabelul: fișier → confirmat nefolosit / păstrat (cu motivul) → testele care îl ating și ce faci cu ele;
   - lista exactă de fișiere șterse și modificate;
   - comenzile de verificare pe care le rulezi.
   **STOP. Aștepți aprobarea.**
2. **EXECUȚIE** — doar după „aprobat”. Exact planul aprobat; la orice abatere te oprești și întrebi.
3. **RAPORT** — push pe `redesign/cleanup`, rezumat de max. 10 rânduri, linkul de preview Vercel (dacă îl vezi) și lista de pagini de deschis pe telefon. **STOP. Nu faci merge în main.**

## Ce faci

1. **Branch** — `git checkout -b redesign/cleanup origin/redesign/audit`.
2. **Corectezi auditul** (commit separat, doar docs): secțiunile 1.3 și 3.3 din `audit.md` încă tratează tema coral ca decizie deschisă. O aliniezi la blocul „Decizii (18.11.2026)”: tema coral dispare, un singur set de tokeni.
3. **Reverifici fiecare fișier din Anexa E** înainte să-l ștergi. Un fișier e nefolosit doar dacă numele lui (fără extensie) și exportul lui nu apar nicăieri în:
   - `src/` (inclusiv importuri dinamice `import(...)`, `next/dynamic`, `React.lazy`, fișiere `index.ts` care re-exportă);
   - `e2e/`, `tests/`, `tests-e2e/`, `scripts/`, fișierele de configurare din rădăcină.
   Dacă un fișier e folosit doar de un test care testează exclusiv acel fișier, se șterge și testul (îl listezi). Dacă ai orice dubiu, fișierul rămâne și scrii motivul.
4. **Adaugi** la listă, cu aceeași verificare: `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx` (marcat ca mort în `CLAUDE.md`) și `ParcelaForm`, dacă rămâne fără importuri după ștergerea lui `AddParcelaDialog`. Dacă ștergi `ActivitatiAgricolePageClient.tsx`, actualizezi rândul din `CLAUDE.md` care îl pomenește.
5. **Ștergi** cu `git rm`, într-un commit separat de cel de docs.
6. **Verificare**: `npm run lint`, `npm run typecheck`, `npm run build`. Rulezi și `npm run test:critical:unit`; dacă pică din motive de mediu (variabile, rețea), consemnezi și nu repari. Orice eroare cauzată de ștergere: refaci fișierul și îl treci la „păstrat”.
7. **Push** pe `redesign/cleanup`. Vercel face preview pentru branch.
8. **`docs/redesign/progres.md`** — ce s-a șters (număr de fișiere și linii), ce a rămas și de ce, ce trebuie deschis pe telefon pe preview.

## Reguli

- Doar ștergeri de fișiere nefolosite + docs. Nicio modificare de logică, stil sau refactor în fișierele rămase. Singura excepție: importuri rămase orfane în fișierele care importau ceva șters, dacă build-ul o cere — le listezi.
- Nu atingi chat-ul AI (`AiPanel`, `AiBottomSheet`, `AiPanelContext`), chiar dacă par nefolosite: decizia e să rămână în cod.
- Nu atingi zona Asociație și nici desktopul, în afara fișierelor confirmate nefolosite.
- Nu faci merge în `main`, nu deschizi PR.
- Nimic în baza de date.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
