# Raport 30 — Tratamente, partea a doua (3/3): Planul pe stadii

Branch: `redesign/plan-30`, pornit din `main` (`c6aef5c`). Fără merge. O migrare scrisă, **neaplicată**:
`supabase/migrations/20261123120000_plan_stadii.sql`. Din baza de date am citit doar cu `select` (`information_schema`,
`pg_constraint`, `pg_policies`, `pg_proc`, definiția `upsert_plan_tratament_cu_linii`, numărători). Cronurile nu au fost
apelate, variabilele din Vercel nu au fost atinse. Magazia, Capcanele și stocul de fructe nu s-au schimbat (doar citite).
`public/sw.js` nu e în niciun commit.

## Rezumat pentru Andrei

1. **Tratamente are acum patru taburi: Aplicări · Plan · Capcane · Analize.** În Plan: sus „E timpul pentru · După recoltare · Delniwa Nord + Maravilla”, cu intervențiile și verificarea fiecăreia (magazie, pauză); jos „Urmează”, stadiile următoare pe scurt; apoi planurile fermei (și cele vechi). În Aplicări apare rândul „Plan: la … e timpul pentru …” când e ceva de făcut.
2. **Un atins pe o intervenție deschide „Tratament nou” completat** (parcele, produse, doze, metodă), cu „Completat din „Zmeură 2026 · După recoltare””. Se poate schimba orice; „Salvează · făcut” salvează direct, „Altă zi sau planifică” duce la pasul cu ziua. Aplicarea rămâne legată de linia din plan.
3. **„Sar peste”** (motiv opțional) e pe același ecran: linia apare tăiată, nu dispare, și se readuce din „Planul întreg”. Merge **după migrare**.
4. **„Plan nou”**: „Din ce am aplicat în 2026” (tratamentele grupate pe stadiul parcelei din ziua aplicării; dacă lipsește stadiul, îl alegi; aplicările repetate devin „repetă la ~N zile”) sau „De la zero”. Toamna (sept.–dec.) planul se face pentru anul următor. Fără planuri-model.
5. **„Planul întreg”**: pe stadii, fiecare linie cu produs, doză, scop, metodă, repetare și starea pe an (făcut / făcut 2 din 3 / acum / sărit / urmează). „+ Linie”, editarea, mutarea între stadii (ținut apăsat pe telefon, tras pe desktop, sau „Mută în alt stadiu”), parcelele planului cu excepții pe parcelă (după migrare), redenumire, ștergere (doar tu).
6. **„A început înflorirea?”** apare pe fișa parcelei și în tab-ul Plan când se apropie ziua în care parcela a intrat în stadiul următor anul trecut (sau după culesul estimat). „Da, de azi” schimbă stadiul, „Încă nu” tace 3 zile. Nu pleacă pe telefon.
7. **Notificarea de dimineață** (în verificarea existentă, fără cron nou): „E timpul pentru <stadiu> la <parcele> · N intervenții”, o singură dată pe linie, parcelă și repetare, ție și operatorilor cu „Scrie” pe Tratamente. Comutator nou în Ce primești: „Planul de tratamente”, pornit. Pleacă **după migrare**.
8. **Planurile vechi (4 planuri, 13 linii) se deschid și se editează** în noul ecran, fără conversie: produsul lor stă pe linie și e citit de acolo. Editarea nu mai folosește RPC-ul vechi, care ștergea liniile și rupea legătura cu aplicările deja făcute.
9. **Demo nou**: planul „Zmeură <an>” pe Delniwa Nord, Delniwa Sud, Maravilla, cu 6 linii pe 5 stadii; „E timpul pentru · După recoltare” apare imediat, iar Kelpak e „făcut” pe Maravilla. Reîncărcarea demo-ului șterge planul.
10. **Migrarea se poate aplica înainte sau după merge.** Fără ea planul merge (vezi, faci, editezi, „E timpul pentru…”, formularul completat); lipsesc doar „Sar peste”, excepțiile și notificarea.

## 1. Ce am schimbat

| Commit | Ce |
|---|---|
| `284e6b3` | **Migrarea** `20261123120000_plan_stadii.sql` (neaplicată): `planuri_linii_sarite`, `planuri_linii_exceptii`, `planuri_anuntate` cu RLS; citirea celor 4 tabele de plan cere și `operator_can_read('tratamente')`. |
| `cd3d296` | **Logica pură** `src/lib/plan/`: `model.ts` (planuri, linii, produse; liniile vechi cu produsul pe linie), `stadii.ts` (stadiul de acum ca pe fișă, pe cohorte; stadiul la o dată), `urmeaza.ts` (ce urmează, repetarea, sărit, excepții, starea pe an), `din-anul-trecut.ts`, `verificari.ts` (pauză / maxim pe sezon / interval / stoc), `intrebare.ts`, `formular.ts` (formularul completat, rândurile planului nou cu id-uri derivate), `notificare.ts`. `aplicariDeSalvat` primește `planLinieId` (`sursa = 'din_plan'`, `plan_linie_id`, `plan_linie_produs_id`). Tipul de notificare `plan_tratament`. Teste. |
| `fbffffa` | **Datele** `src/lib/supabase/queries/plan.ts` (citire, plan nou idempotent, linie pe loc, parcele pe an, mutare, ștergere, sărit, excepții), hook-ul `usePlan` (aceleași chei de cache ca Parcele pentru stadii), cheile `['tratamente', 'plan', …]`, `plan_linie_id` în citirea aplicărilor. **Ecranele**: tab-ul Plan (`PlanTab`), `PlanNouStepForm`, `LinieEditor`, `IntrebareStadiuCard`; `TratamentStepForm` cu prop-ul `plan` (info, „Salvează · făcut”, „Sar peste”, verificări). |
| `7b39eb4` | **„Planul întreg”** `/tratamente/plan/[planId]` (`PlanIntregClient`, `LinieStepForm`): stadii, stare pe an, + Linie, editare, mutare (ținut apăsat / drag & drop / foaie), parcele + excepții, redenumire, ștergere. `src/components/plan`, `src/lib/plan` în `KIT_RULE_DIRS`. |
| `d3855a4` | **Notificarea** în `notificari-dimineata` (`src/lib/plan/memento-cron.ts`; scrie doar în `planuri_anuntate`), comutatorul `plan` în preferințe, config, legătura spre `/tratamente?tab=plan`. Întrebarea „A început…?” pe fișa parcelei (`IntrebareStadiuParcela`). |
| `5f2a77b` | **Demo** `src/lib/demo/demo-plan.ts` + legarea în seed și în reîncărcare; test. |
| `6e7e735` | `CLAUDE.md` (secțiunea Planul pe stadii, cronul, kitul); **smoke**: pasul 9 „Plan”. |
| `8ab5cbc` | Corecturi după testul în browser: „făcut 2 din 3” (nu „urmează” când o parcelă n-are stadiu), titlul liniei = produsele (scopul sub el, nu se mai taie pe telefon), starea pe parcele doar pentru planul anului curent. |
| `cd8ef23` | Smoke, pasul Capcanelor: locatorul „Peste prag la Delniwa Sud” cu `exact: true` (migrarea capcanelor e aplicată acum în producție; pasul nu mai era sărit și prindea două texte). Doar testul; logica Capcanelor neatinsă. |
| `7388173` | „Plan nou”: nicio placă aleasă dinainte (`TileGroup` nu răspunde la placa deja aleasă), ca la „Tratament nou”. |

## 2. Cum am refolosit tabelele vechi

Citite din producție pe 23.11.2026: `planuri_tratament` 4, `planuri_tratament_linii` 13, `planuri_tratament_linie_produse` **0**, `parcele_planuri` 2, 5 aplicări cu `plan_linie_id`; `stadiu_trigger` folosește deja codurile canonice (`inflorit`, `parga` …); `regula_repetare` doar `fara_repetare`; `metoda_aplicare` gol.

- **Mai multe produse pe linie existau deja** (`planuri_tratament_linie_produse`, din V2), dar cele 13 linii vechi n-au rânduri acolo: produsul lor e pe linie. `produseLinie` citește rândurile copil, altfel produsul de pe linie. La salvare, primul produs se scrie și pe linie (constrângerea `produs_xor_check`).
- **Repetarea, scopul, metoda, cohorta** sunt coloanele existente (`regula_repetare = 'interval'` + `interval_repetare_zile` + `numar_repetari_max`; „de M ori” = M aplicări în total).
- **Legătura cu aplicările**: `aplicari_tratament.plan_linie_id` + `sursa = 'din_plan'` (constrângerea `sursa_plan_linie_check` le cere pe amândouă) și `aplicari_tratament_produse.plan_linie_produs_id`.
- **`parcele_planuri`**: planul pe parcelă și an; o parcelă are un singur plan activ pe an (aceeași regulă ca RPC-ul vechi; asocierea veche se oprește cu `activ = false`, nu se șterge).
- **RPC-ul `upsert_plan_tratament_cu_linii` nu se mai folosește la editare**: face `delete` pe toate liniile planului și le reinserează, deci `aplicari_tratament.plan_linie_id` (FK `ON DELETE SET NULL`) s-ar pierde. Liniile se modifică pe loc; planul nou se scrie cu id-uri derivate din cheia formularului (`idDerivat`), cu `ignoreDuplicates`: reîncercarea nu dublează, fără migrare.
- **Stadiile**: lista reală a aplicației (`stadii-canonic.ts`; zmeura: repausul tufei, pornire în vegetație, inflorescențe vizibile, boboci florali, înflorit, sfârșit de înflorit, legare fruct, fructe verzi, început de coacere, recoltare, după recoltare), cu etichetele de zmeură. Stadiul de acum = ultima înregistrare de pe fișă (`stadii_fenologice_parcela`), pe cohorte la zmeura remontantă.

## 3. Migrarea (SQL complet)

Ordinea: o singură migrare, `20261123120000_plan_stadii.sql`, după `20261122110000_analize_fructe.sql` (folosește `operator_can_read`, aplicată deja). Nu depinde de Magazie sau Capcane. **Se poate aplica înainte sau după merge**; aplicația merge fără ea (fără „Sar peste”, excepții și notificare).

```sql
-- Planul pe stadii (promptul 30): „E timpul pentru…”, „Sar peste”, excepțiile pe parcelă și ce s-a anunțat deja.
--
-- Refolosește tabelele de plan care există deja în producție (citite pe 23.11.2026: `planuri_tratament` 4 rânduri,
-- `planuri_tratament_linii` 13, `planuri_tratament_linie_produse` 0, `parcele_planuri` 2; 5 aplicări cu
-- `plan_linie_id`). Nu redenumește și nu șterge nimic, nu atinge rânduri existente. Doar adaugă:
--
--   * `planuri_linii_sarite` (linie, parcelă, an, motiv): „Sar peste” pe o linie, pentru o parcelă, în anul acela.
--     Linia rămâne în plan și apare tăiată. Ștergerea rândului = „Nu mai sar” (proprietarul sau cine are „Scrie”).
--   * `planuri_linii_exceptii` (linie, parcelă): linia nu se aplică pe parcela aceea (în niciun an).
--   * `planuri_anuntate` (linie, parcelă, an, repetare): ce a anunțat deja notificarea de dimineață, ca aceeași
--     intervenție să nu fie anunțată de două ori. O scrie doar cronul (service role); utilizatorii doar citesc.
--   * Citirea pe cele 4 tabele de plan existente cere și `operator_can_read('tratamente')` (până acum doar ferma),
--     ca la Capcane și Analize. Proprietarul trece mereu (`operator_can_read` întoarce `true` pentru el).
--     Inserarea / modificarea (proprietarul sau `operator_can_write('tratamente')`) și ștergerea (proprietarul)
--     există deja și rămân.
--
-- Ce exista deja și se folosește așa cum e (nu e nevoie de migrare):
--   * mai multe produse pe o linie: `planuri_tratament_linie_produse` (cu doze și `cantitate_text`); liniile vechi
--     țin produsul pe linie (`produs_id` / `produs_nume_manual`) și aplicația îl citește de acolo când linia n-are
--     rânduri de produse;
--   * repetarea: `regula_repetare` ('fara_repetare' / 'interval'), `interval_repetare_zile`, `numar_repetari_max`;
--   * metoda: `metoda_aplicare`; scopul: `scop`; cohorta (zmeură remontantă): `cohort_trigger`;
--   * legătura cu aplicările: `aplicari_tratament.plan_linie_id` (+ `sursa = 'din_plan'`) și
--     `aplicari_tratament_produse.plan_linie_produs_id`.
--
-- NEAPLICATĂ: o rulează Andrei. Se rulează DUPĂ 20261122110000_analize_fructe.sql (folosește `operator_can_read`),
-- aplicată deja în producție; nu depinde de 20261122130000_magazia.sql sau de 20261123100000_capcane.sql.
-- Se poate aplica înainte sau după merge: fără ea, Planul merge (vezi, faci, editezi planuri, „E timpul pentru…”,
-- formularul completat), doar „Sar peste” și excepțiile pe parcelă nu apar, iar notificarea de dimineață a planului
-- nu pleacă (n-are unde să țină minte ce a anunțat).
--
-- Anulare (doar dacă e nevoie; pierde liniile sărite, excepțiile și istoricul anunțurilor):
--   drop table if exists public.planuri_anuntate;
--   drop table if exists public.planuri_linii_exceptii;
--   drop table if exists public.planuri_linii_sarite;
--   (politicile de citire vechi: `using (tenant_id = public.current_tenant_id())` pe cele 4 tabele de plan)

begin;

-- ─── Liniile sărite ──────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.planuri_linii_sarite (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  an integer not null check (an between 2020 and 2100),
  motiv text null check (motiv is null or char_length(motiv) <= 500),
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planuri_linii_sarite_unic unique (plan_linie_id, parcela_id, an)
);

create index if not exists idx_planuri_linii_sarite_tenant_an on public.planuri_linii_sarite (tenant_id, an);
create index if not exists idx_planuri_linii_sarite_parcela on public.planuri_linii_sarite (parcela_id);

alter table public.planuri_linii_sarite enable row level security;

drop policy if exists planuri_linii_sarite_select on public.planuri_linii_sarite;
create policy planuri_linii_sarite_select on public.planuri_linii_sarite for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_linii_sarite_insert on public.planuri_linii_sarite;
create policy planuri_linii_sarite_insert on public.planuri_linii_sarite for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_sarite_update on public.planuri_linii_sarite;
create policy planuri_linii_sarite_update on public.planuri_linii_sarite for update to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')))
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_sarite_delete on public.planuri_linii_sarite;
create policy planuri_linii_sarite_delete on public.planuri_linii_sarite for delete to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')));

-- ─── Excepțiile pe parcelă ───────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.planuri_linii_exceptii (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planuri_linii_exceptii_unic unique (plan_linie_id, parcela_id)
);

create index if not exists idx_planuri_linii_exceptii_tenant on public.planuri_linii_exceptii (tenant_id);
create index if not exists idx_planuri_linii_exceptii_parcela on public.planuri_linii_exceptii (parcela_id);

alter table public.planuri_linii_exceptii enable row level security;

drop policy if exists planuri_linii_exceptii_select on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_select on public.planuri_linii_exceptii for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_linii_exceptii_insert on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_insert on public.planuri_linii_exceptii for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_exceptii_delete on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_delete on public.planuri_linii_exceptii for delete to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')));

-- ─── Ce s-a anunțat deja (notificarea de dimineață) ──────────────────────────────────────────────────────────────

create table if not exists public.planuri_anuntate (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  an integer not null check (an between 2020 and 2100),
  repetare integer not null default 1 check (repetare >= 1),
  anuntat_la timestamptz not null default now(),
  constraint planuri_anuntate_unic unique (plan_linie_id, parcela_id, an, repetare)
);

create index if not exists idx_planuri_anuntate_tenant_an on public.planuri_anuntate (tenant_id, an);

alter table public.planuri_anuntate enable row level security;

-- Doar citire pentru utilizatori; scrie cronul cu service role (care trece peste RLS).
drop policy if exists planuri_anuntate_select on public.planuri_anuntate;
create policy planuri_anuntate_select on public.planuri_anuntate for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

-- ─── Citirea planurilor: și dreptul „Tratamente” (operatorii fără Tratamente nu mai văd planurile) ──────────────

drop policy if exists planuri_tratament_select on public.planuri_tratament;
create policy planuri_tratament_select on public.planuri_tratament for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_tratament_linii_select on public.planuri_tratament_linii;
create policy planuri_tratament_linii_select on public.planuri_tratament_linii for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_tratament_linie_produse_select on public.planuri_tratament_linie_produse;
create policy planuri_tratament_linie_produse_select on public.planuri_tratament_linie_produse for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists parcele_planuri_select on public.parcele_planuri;
create policy parcele_planuri_select on public.parcele_planuri for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

commit;
```

## 4. Testul în browser (demo nou)

Build de producție (`npm run build` + `next start`), panoul de browser la 375 px. Întâi delogarea din demo-ul vechi (formularul `leave-demo` → `/start`), apoi „Continuă fără cont” → „Fructe de pădure”. **Tenantul: `c5f4f36b-4071-4f70-b1a9-056ad27da20f`** (creat 23.11.2026, 10:56 UTC; seed: 1 plan, 6 linii, 6 produse, 3 parcele, 1 aplicare din plan).

- Tab-ul Plan: „E timpul pentru · După recoltare · Delniwa Nord + Maravilla”, Cupru (exemplu) cu „pauză 14 zile · OK”, „Urmează” cu 3 stadii, planurile fermei; nota „Sar peste … după actualizarea bazei de date”.
- Atins → formularul completat („Completat din „Zmeură 2026 · După recoltare””, parcelele, doza 300 ml/100 l, verificarea pauzei) → soluție 120 l → „Salvează · făcut” → „Salvat”. În bază (select): 2 aplicări `sursa = din_plan`, cu `plan_linie_id` și `plan_linie_produs_id`. Eroul a dispărut; „Planul întreg” arată linia făcută.
- „Plan nou · De la zero”: linie Înflorit · Borofol 150 ml/100 l → parcele → „Fă planul „Zmeură 2027”” → salvat cu parcelele pe 2027 → „Mută în alt stadiu” (Fructe verzi) → „Editează linia” (scop + repetare) → „Șterge planul” (planul meu de test, în demo).
- „Plan nou · Din ce am aplicat în 2026”: 7 aplicări grupate pe stadii (după corectura `7388173`; înainte, placa aleasă dinainte nu răspundea).
- Fișa parcelei Delniwa Nord: se încarcă normal (fără întrebare: „După recoltare” e ultimul stadiu).
- La final, ieșirea din demo (`/start`). Smoke-ul creează și el demo-uri noi, separat.

## 5. Ce n-am putut testa

- **„Sar peste”, excepțiile pe parcelă, „Nu mai sar” și notificarea de dimineață**: cer migrarea (neaplicată). Sunt acoperite de teste unitare (logica și „fără migrare nu trimite nimic”), nu în browser și nu prin cron (cronurile nu se apelează).
- **Întrebarea „A început…?” în browser**: demo-ul n-are stadii de anul trecut, iar stadiile de acum sunt la final de sezon; e testată unitar (cu 3 zile înainte, „Încă nu”, culesul estimat).
- **Tragerea pe desktop și ținutul apăsat pe telefon** nu le-am putut face din panoul de browser (clicurile vin ca mouse); mutarea am verificat-o prin „Mută în alt stadiu”, care cheamă aceeași funcție.
- **Un operator** (citire / scriere) nu l-am testat în browser; regulile vin din RLS-ul existent și din migrare.
- **Planurile vechi din producție** nu le-am deschis în aplicație (sunt ale altor ferme); le-am citit structura cu `select`, iar citirea lor e testată unitar (`linieDinRand`, produsul de pe linie).

Limitări știute, alese deliberat:
- „Încă nu” ține minte în `localStorage` (pe telefonul acela).
- Cohorta liniei (floricane / primocane) se păstrează la editare, dar nu se poate alege în editor.
- Operatorul nu poate scoate un produs dintr-o linie și nu poate șterge linii (ștergerea pe aceste tabele e doar a proprietarului, din RLS-ul existent).
- Starea pe an din „Planul întreg” se calculează pe anul curent; un plan făcut toamna pentru anul următor arată liniile fără stare până în ianuarie.
- Fără migrare, tab-ul Plan cere `planuri_linii_sarite` / `planuri_linii_exceptii` și primește 404 (tratat; apare doar în consola browserului).

## 6. Verificările

| Comandă | Rezultat |
|---|---|
| `npm run lint` | trece (0 erori, 4 avertismente vechi, în fișiere neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece (316 fișiere) |
| `npm run test:critical:unit -- --maxWorkers=3` | trece: 127 fișiere, 1105 teste (noi: `src/lib/plan/__tests__/plan.test.ts`, `src/lib/__tests__/demo-plan.test.ts`) |
| `npm run build` | trece (refăcut după ultima corectură, `7388173`) |
| `npm run test:e2e:smoke` | trece: 10 din 10, cu pasul nou 9 „Plan” (rulat înainte de `7388173`, care schimbă doar placa din „Plan nou”); pașii Magazie și Capcane au rulat, migrările lor sunt aplicate în producție |

## 7. Hash-urile commit-urilor

`284e6b3`, `cd3d296`, `fbffffa`, `7b39eb4`, `d3855a4`, `5f2a77b`, `6e7e735`, `8ab5cbc`, `cd8ef23`, `7388173` și commit-ul acestui raport.
