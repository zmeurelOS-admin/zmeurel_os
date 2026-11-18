# Prompt 00 — Faza 0: Audit UI (DOAR CITIRE)

Model: Fable 5.2 · Branch: `redesign/audit` · Rezultat: `docs/redesign/audit.md`

## Protocol de lucru (obligatoriu)

Lucrăm în pași cu aprobare. Nu treci la pasul următor fără răspunsul nostru explicit.

1. **PLAN** — citește acest fișier, `CLAUDE.md` și explorează repo-ul cât îți trebuie ca să faci planul. Apoi trimite:
   - planul de audit: ce verifici, în ce ordine, cu ce metodă (grep-uri, fișiere citite, cum numeri aparițiile);
   - lista exactă de fișiere pe care le vei crea/modifica (așteptat: doar `docs/redesign/audit.md` și, la final, `docs/redesign/progres.md`);
   - întrebările deschise, dacă ai.
   Apoi **STOP. Aștepți aprobarea.**
2. **EXECUȚIE** — doar după „aprobat”. Execuți exact planul aprobat. Dacă apare ceva care cere abatere de la plan, te oprești și întrebi.
3. **RAPORT** — scrii `docs/redesign/audit.md`, faci commit pe `redesign/audit`, push pe branch (NU pe main, NU PR, NU merge). Ne dai un rezumat de max. 15 rânduri: top 5 probleme, ordinea propusă pentru module, întrebări pentru noi. Apoi **STOP. Aștepți răspunsul nostru.** Nu începi Faza 1.

## Context

Pornim revamp-ul UI pentru Zmeurel OS, în 4 faze: 0 audit → 1 kit de design → 2 mockupuri pe module → 3 implementare modul cu modul. Aplicația e în producție și o folosește deja asociația Gustă din Bucovina. Faza asta e strict citire și raport.

Referința de stil este modulul **Material săditor** (vânzări butăși), deja refăcut:
- `src/components/vanzari-butasi/ComandaButasiWizard.tsx` — formular pe pași, plăci mari de alegere, calendar în foaie, număr cu săgeți și ±5/±10, footer cu buton mare
- `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx` — cifre sus (StatTile), segmente, filtre pastilă, carduri cu acțiune principală, foi de jos în portal
- `src/components/vanzari-butasi/*` — restul componentelor modulului

Documente existente de citit ca context (pot fi depășite — verifici în cod, nu le copiezi): `docs/ui/mobile-ui-system.md`, `docs/ui/desktop-workspace.md`, `docs/COMPONENTS.md`, `docs/PATTERNS.md`, `docs/MODULES.md`, `MODULE_AUDIT.md`.

## Ce trebuie să conțină `docs/redesign/audit.md`

1. **Inventarul modulelor** din `src/app/(dashboard)` (și `src/app/admin` separat): ruta, fișierele (page / PageClient / componente din `src/components/<modul>`), formularele (dialog vs. pagină vs. pași, număr de câmpuri), componentele UI folosite, mobil vs. desktop. Tabel.
2. **Problemele care țin de toată aplicația**, fiecare cu: descriere, cauză, număr de locuri afectate (fișiere + apariții), 3–5 exemple cu cale:linie, gravitate (blocant / mare / mic). Include sigur:
   - clasele `dark:` din Tailwind 4 care urmează tema telefonului (prefers-color-scheme), nu tema aplicației, fiindcă `src/app/globals.css` nu definește `@custom-variant dark`; verifică și cum setează `next-themes` clasa;
   - ferestrele/dialogurile/sheet-urile randate în pagină care ies sub `BottomTabBar` și sub butoanele plutitoare (FAB, AI) — care nu folosesc portal sau au z-index greșit;
   - cele trei familii de tokeni în paralel: `--agri-*`, `--surface-*`/`--text-*`, `--soft-*` — unde e definită fiecare, câte utilizări are, suprapuneri;
   - culori puse direct în cod (hex, `bg-green-600` etc.) în loc de tokeni;
   - formularele vechi în fereastră mică, cu toate câmpurile odată;
   - ținte de atingere sub 48 px pe mobil, text sub 13 px;
   - orice altă problemă transversală găsită.
3. **Componente duplicate** — mai multe implementări pentru același lucru (card, formular, filtru, foaie de jos, stare goală, pastilă de status, KPI): unde sunt, care e cea mai bună, ce s-ar consolida.
4. **Propunerea de kit** pentru Faza 1:
   - tokeni: un singur set pe roluri (principal, suprafață, text, contur, stări info/reușit/atenție/pericol), zi + noapte, dark doar pe clasa `.dark`; scara de text 26/22/19/17/15/13 px; spațiere în pași de 4; colțuri 12/16/22/28; două niveluri de umbră; atingere min. 48 px, butoane principale 56 px — confirmi sau propui ajustări cu argument;
   - lista componentelor de extras din Material săditor (buton mare principal/secundar, Tile, filtre pastilă + segmente, StatTile, BottomSheet în portal, formular pe pași cu antet de progres + footer, calendar în foaie, număr cu săgeți, card cu acțiune principală, pastilă de status, stare goală) — pentru fiecare: fișierul sursă, ce trebuie generalizat, unde ar trăi (`src/components/kit/` sau altă propunere);
   - strategia de migrare a tokenilor vechi fără să strice modulele nerefăcute.
5. **Ordinea propusă pentru module**, cu argument (frecvență de folosire estimată din cod/analytics dacă poți, complexitate, risc). Ipoteza noastră de pornire: Comenzi + Livrări → Recoltări → Clienți → Dashboard → Vânzări + Cheltuieli → Parcele + Activități → Stocuri + Produse + Magazin → Rapoarte + Setări. Corecteaz-o.
6. **Riscuri** pentru revamp (zone fragile, offline/sync, e2e care s-ar rupe).

## Reguli

- DOAR CITIRE asupra codului: nu modifici niciun fișier în afară de `docs/redesign/audit.md` și `docs/redesign/progres.md`.
- Nu rulezi nimic care scrie în baza de date. Fără migrări, fără `supabase db`, fără scripturi de seed.
- Poți rula `npm run lint` / `npm run typecheck` dacă te ajută, fără să repari nimic.
- Lucrezi pe branch-ul `redesign/audit`; nu atingi `main`.
- Raportul e în română, concis, cu tabele unde ajută. Cifrele (număr de locuri) se obțin prin comenzi reale, nu estimate — scrii în raport comanda folosită.
- La final actualizezi `docs/redesign/progres.md`: ce s-a făcut, ce a rămas, ce trebuie verificat pe telefon.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
