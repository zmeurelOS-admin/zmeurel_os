# Tratamente — Sursa Canonică

- `stadii-canonic.ts` este sursa unică pentru `StadiuCod`, label-urile RO, categoriile de management și profilurile per `GrupBiologic`.
- Persistența, importul și generatorul folosesc coduri canonice snake_case; UI-ul afișează doar label-urile mapate din acest fișier.
- Compatibilitate: `listStadiiInOrdine()` și `getOrdine()` păstrează profilul implicit Rubus; pentru UX contextual și reguli noi se folosesc `listStadiiPentruGrup(...)`, `getOrdineInGrup(...)` și `getStadiuUrmatorInGrup(...)`.
- `configurare-sezon.ts` adaugă stratul sezonier per parcelă: sistem de conducere pentru Rubus, tip de ciclu pentru solanacee și `getLabelStadiuContextual(...)` pentru label-uri UI dependente de sezon.
- Fluxul complet al modulului este: stadii canonice → profiluri biologice → categorii de management → cohorte → configurare sezonieră → generator și RPC atomic.
- Faza 4 a adus Rubus mixt cu cohortele `floricane` și `primocane`. Regula de bază rămâne: dacă parcela nu este Rubus mixt, toate câmpurile de cohortă rămân `NULL`; dacă este mixtă, stadiile pot fi înregistrate pe cohortă, liniile de plan pot avea `cohort_trigger`, iar aplicările pot salva `cohort_la_aplicare`.
- Faza 5 a curățat stratul final: anul curent de sezon vine din `getCurrentSezon()`, iar `allowCohortTrigger` se activează doar când `configurareSezon.sistem_conducere === 'mixt_floricane_primocane'` pentru Rubus.
- Regula de implementare pentru stadii noi: adăugăm codul în helper, mapăm label-ul RO în același fișier, extindem profilul biologic relevant și consumăm doar codul canonic în DB/payload/import.
- În UI, stadiile se afișează fie prin `getLabelRo(...)`, fie prin `getLabelStadiuContextual(...)`; nu se compară string literal de stadiu în logică, ci `StadiuCod`.
