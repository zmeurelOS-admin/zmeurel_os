# Decision Log

## 2026-03-26 — AI audit baseline

- Decision: nu urcăm modelul AI acum.
  Reason: blocajul dominant este de pipeline, în special mismatch-ul backend -> UI pe `open_form`.

- Decision: prioritatea imediată este paritatea completă a handoff-ului pentru formularele deja suportate.
  Scope: `recoltare`, `activitate`, `comanda`, `client`.

- Decision: al doilea front este extinderea entity resolution pe date reale tenant.
  Scope: `nume_parcela`, `soi`, `cultura`, clienți existenți, produse recente, clarificare cu confidence.

- Decision: păstrăm abordarea actuală de produs.
  Scope: AI-ul propune, pregătește și clarifică; userul confirmă în UI.

- Nu facem încă:
  - upgrade de model ca soluție principală
  - autonomie AI cu scriere directă în DB
  - funcții noi fancy înainte de hardening pe fluxurile zilnice
  - refactor mare al arhitecturii AI chat

## 2026-03-26 — Sticky-flow interruption + clean clarification text

- Decision: păstrăm continuation pentru follow-up-uri scurte compatibile, dar întrerupem sticky flow-ul când mesajul nou are intenție clară pe alt flow.
  Reason: evităm blocarea pe clarificarea anterioară (`recoltare`) când userul trece explicit la `activitate` sau `comandă`.

- Decision: nu mai interpolăm text brut neverificat în clarificări de entitate nerezolvată.
  Reason: prevenim răspunsuri cu text murdar/typo în întrebări de clarificare și menținem formulări neutre când nu există match canonic sigur.

## 2026-03-26 — AI daily limit override for superadmin

- Decision: limita AI zilnică se bazează pe `profiles.is_superadmin`.
  Scope: user normal păstrează limita standard din `AI_CHAT_DAILY_LIMIT`; user cu `is_superadmin = true` primește 60 mesaje/zi.

## 2026-03-26 — Extraction hygiene unificat pentru leftover/observații

- Decision: introducem un strat unic, conservator, pentru curățarea textului rezidual înainte de mapare la `observatii`/`descriere`.
  Scope: `cheltuiala`, `investitie`, `recoltare`, `activitate`, `comanda`, `client`.
- Ce păstrăm:
  - doar note operaționale clare, utile pentru operator (ex: interval orar, condiție de livrare, calitate menționată explicit).
- Ce eliminăm:
  - text deja consumat de câmpuri canonice,
  - prepoziții/conjuncții/politețuri și fragmente reziduale fără valoare.
- Reason: consistență cross-flow, reducere zgomot în prefill și evitarea duplicării câmpurilor în `observatii`.
