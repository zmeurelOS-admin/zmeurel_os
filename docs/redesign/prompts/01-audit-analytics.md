# Prompt 01 — Faza 0b: completarea auditului cu analytics (DOAR CITIRE)

Model: Opus 5.5 · Effort: medium · Mod: plan · Branch: `redesign/audit` · Rezultat: actualizare `docs/redesign/audit.md` + `docs/redesign/progres.md`

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier și `docs/redesign/audit.md` (secțiunile Rezumat, 4, 6 și Anexa G). Trimite: interogările SQL exacte pe care le vei rula, cum mapezi căile pe module, ce secțiuni din audit modifici, lista de fișiere atinse. **STOP. Aștepți aprobarea.**
2. **EXECUȚIE** — doar după „aprobat”. Exact planul aprobat; la orice abatere te oprești și întrebi.
3. **RAPORT** — commit + push pe `redesign/audit` (NU main, NU PR, NU merge). Rezumat de max. 10 rânduri: top module după folosire, dacă ordinea propusă se schimbă și de ce. **STOP. Aștepți răspunsul nostru.**

## Context

Auditul UI (commit `8ef2418`) e gata, dar ordinea modulelor e argumentată doar din cod: interogarea din Anexa G nu a rulat, fiindcă conectorul Supabase nu avea acces la proiect. Conectorul a fost reautorizat; proiectul de producție este `ilybohhdeplwcrbpblqw` (`zmeurelOS-LIVE-comanda-zmeurel-ro`). Verifică întâi că îl vezi (`list_projects`). Dacă tot nu ai acces, te oprești și raportezi — nu cauți alte căi.

## Ce faci

1. **Interogarea A** — cea din Anexa G (`view_module`, 90 de zile, tenanți anonimizați T1, T2 …, `has_demo_event`).
2. **Interogarea B (aprobată acum)** — `event_name = 'page_view'`, ultimele 90 de zile, grupat pe tenant anonimizat și pe rută normalizată din `event_data->>'page'`:
   - normalizezi căile: scoți query string-ul și înlocuiești segmentele de tip id (uuid, numere) cu `[id]`, ca `/comenzi/123` și `/comenzi/456` să cadă împreună;
   - întorci: tenant anonimizat, `has_demo_event`, rută normalizată, număr de vizualizări, număr de zile distincte cu vizualizări (arată folosirea constantă, nu doar volumul);
   - fără `user_id`, e-mail, alte câmpuri din `event_data`, fără id-uri reale de tenant.
3. **Maparea pe module** — fiecare rută → modulul din Anexa A. Rutele publice (magazin, comanda, livrator, landing, auth, start) separat, pe scurt.
4. **Actualizezi `audit.md`**:
   - Anexa G: devine „rulată”, cu ambele interogări exacte, data rulării și rezultatele (tabele agregate; tenanții demo separați de cei reali);
   - Secțiunea 4: frecvența reală pe module (vizualizări + zile active, pentru tenanții reali), apoi ordinea revizuită cu argument. Spui clar dacă Recoltări rămâne pilot sau trece Comenzi + Livrări;
   - Rezumat: ordinea propusă actualizată, dacă s-a schimbat;
   - Secțiunea 6: întrebarea 5 marcată rezolvată.
5. **`progres.md`** — adaugi ce s-a făcut în pasul ăsta.

## Reguli

- Doar `SELECT` pe `public.analytics_events`. Nicio altă tabelă, niciun `INSERT`/`UPDATE`/`DELETE`/DDL, nicio migrare, nicio funcție RPC.
- Rezultatele brute nu intră în repo dacă conțin altceva decât agregate anonimizate.
- Nu atingi nimic din `src/`. Fișiere atinse: doar `docs/redesign/audit.md` și `docs/redesign/progres.md`.
- Nu începi Faza 1.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
