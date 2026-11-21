# Raport — promptul 17, deciziile după rularea de noapte

Branch: `redesign/decizii-noapte`, pornit din `48fc0f2`. Împins, fără merge. Migrările sunt scrise, **neaplicate**.
Din baza de producție am făcut doar `select` (definiții de funcții, triggere, indexuri, chei, politici și două numărători agregate, fără date personale).

## 1. Ce am schimbat, pe puncte

| # | Ce | Commit |
|---|---|---|
| 1 | **Editarea recoltării păstrează tariful salvat.** `update_recoltare_with_stock`: același culegător → plata = kg noi × `pret_lei_pe_kg_snapshot`; alt culegător → tariful lui curent; rând vechi fără tarif salvat → tariful curent. Formularul arată „De plată” cu aceeași regulă (`tarifPentruPlata`, `lib/recoltari/day-view.ts`). Test: `lib/recoltari/__tests__/tarif-editare.test.ts`. | `1bc97c9` |
| 2 | **Gardă în bază pentru comenzi.** Trigger `comenzi_guard_livrata_si_stoc` (before update): o comandă livrată nu-și mai schimbă cantitatea, prețul, clientul sau produsul (mesaj în română, `detail = COMANDA_LIVRATA_BLOCATA`); o comandă în livrare editată la mai multe kg trece prin verificarea de stoc (`STOC_INSUFICIENT`, `necesar=…;disponibil=…`, ca la `set_comanda_in_delivery`). `merge_clienti_duplicates` pune o setare locală ca unirea clienților să treacă. Aplicația: `mesajEroareComanda` (`lib/comenzi/day-view.ts`) în formularul comenzii. Test: `lib/comenzi/__tests__/garda-livrata.test.ts`. | `95ba91e` |
| 3 | **Plățile parțiale se adună.** RPC `adauga_plata_vanzare` (atomic, sub blocajul rândului; refuză peste rest; la total → încasată la ziua plății, venit integral prin `ziuaVenitului`). Vânzări: „Cât a dat acum” + „A dat până acum: X lei · rest Y lei”; Livrări: suma primită la livrare trece prin același RPC. `setVanzarePlataPartiala` (care suprascria) a dispărut. Test: `lib/vanzari/__tests__/plati-adunate.test.ts` (100 + 150 din 350, apoi restul). | `fbaf06b` |
| 4 | **„Livrează și copiază”** are Cash / Transfer / Nu a plătit + suma, ca livrarea normală. Încasat tot → `deliver_and_clone_comanda` (neschimbat); avans / neîncasat → RPC nou `livreaza_si_copiaza_comanda`. Plata la livrare într-un singur loc: `lib/livrari/plata.ts`. Teste: `lib/livrari/__tests__/plata.test.ts`, `lib/supabase/queries/__tests__/livreaza-si-copiaza.test.ts`. | `0935b5b` |
| 5 | **`client_sync_id` pe comenzi, clienți, culegători, investiții.** Coloană nulă + index unic parțial `(tenant_id, client_sync_id)`. Formularele de creare trimit cheia (Comandă, Client, Culegător, Investiție, „Client nou” din comandă, „Culegător nou” din recoltare); rândul deja salvat cu aceeași cheie e rezultatul, `23505` pe cheie = reușită. Cheia pleacă doar când coloana există (`schema-features`, grupul `cheiIdempotenta`). Helper: `lib/supabase/idempotency.ts`. Test: `lib/supabase/queries/__tests__/client-sync-id.test.ts`. | `f1c1b91` |
| 6 | **Investițiile în Rapoarte**, secțiune proprie „Investiții” cu totalul perioadei și pe categorii; nu intră la cheltuieli și nu scad din profit. Acasă neschimbat. Test: `lib/rapoarte/__tests__/investitii.test.ts`. | `0a8fd29` |
| 7 | **Stocul cal. 1 pe produs.** `get_sellable_cal1_stock_summary` numără doar recoltările de zmeură când ferma are zmeură (cultura prin `resolve_recoltare_stock_identity`); fără zmeură deloc, ca înainte. Regula în oglindă și testată: `lib/stoc-pe-produs.ts` + `lib/__tests__/stoc-pe-produs.test.ts` (două culturi, o cultură). | `35930eb` |
| 8 | „Azi” de pe ceasul telefonului: neschimbat, cum s-a cerut. | — |
| 9 | **O singură regulă de sezon:** `lib/sezon.ts` (`inceputSezon`, `inceputSezonAn`, `zileRecoltareDinAn`): prima recoltare din anul curent, altfel 1 ianuarie. Folosită în Acasă pe telefon (perioada și „Sezonul, pe scurt”), Acasă pe desktop (în loc de 1 martie, și pentru comparația cu anul trecut), Culegători și Rapoarte › Sezon (în loc de 1 martie). Test: `lib/__tests__/sezon.test.ts`. | `fd96951` |
| 10 | **Cod mort:** `lib/offline/db.ts`, `syncEngine.ts`, `syncables.ts`, `e2e/offline.spec.ts`, `queries/crops.ts`, `queries/crop-varieties.ts` și cheile de query `crops` / `cropVarieties` (verificat cu `git grep`: niciun import). `generateClientId.ts` rămâne. `CLAUDE.md` („Idempotency (fără coadă offline)”), `AGENTS.md`, `docs/CODE_STRUCTURE.md`, `docs/STRUCTURE.md` actualizate. | `7bb9b91` |
| 11 | **Dependențe nedeclarate**, cu versiunea deja instalată: `@radix-ui/react-alert-dialog` 1.1.15, `@radix-ui/react-collapsible` 1.1.12, `@radix-ui/react-select` 2.2.6, `@radix-ui/react-tooltip` 1.2.8, `react-resizable` 3.1.3, `sharp` 0.34.5; dev: `postcss` 8.5.8, `vite` 8.0.8. În lock: doar lista de la rădăcină și flagurile `optional` ale lui `sharp` și ale dependențelor lui. | `c09467a` |

## 2. Migrările și ordinea lor

Toate în `supabase/migrations/`, **neaplicate**, aditive (fără `drop` pe tabele sau coloane, fără `update` / `delete` pe date). Funcțiile noi `SECURITY DEFINER` au `revoke … from public, anon`. Definițiile pe care le înlocuiesc sunt copiate din producție (`pg_get_functiondef`, 21.11), nu din fișierele vechi.

| Ordine | Fișier | Ce face | Depinde de |
|---|---|---|---|
| 1 | `20261121100000_recoltare_editare_tarif_salvat.sql` | `create or replace update_recoltare_with_stock` (tariful salvat) | — |
| 2 | `20261121110000_comenzi_garda_livrata.sql` | funcție + trigger `comenzi_guard_livrata_si_stoc`; `create or replace merge_clienti_duplicates` (+1 linie) | — |
| 3 | `20261121120000_vanzari_plati_adunate.sql` | coloana `vanzari.plati_aplicate uuid[] default '{}'`; RPC `adauga_plata_vanzare` | coloanele de plată parțială (20261120090000, deja aplicată) |
| 4 | `20261121130000_livreaza_si_copiaza_plata.sql` | RPC nou `livreaza_si_copiaza_comanda` | 3 (folosește `adauga_plata_vanzare`) |
| 5 | `20261121140000_client_sync_id_comenzi_clienti_culegatori_investitii.sql` | 4 coloane `client_sync_id uuid null` + 4 indexuri unice parțiale | — |
| 6 | `20261121150000_stoc_cal1_pe_produs.sql` | `cultura_recoltare_stoc` (nouă) + `create or replace get_sellable_cal1_stock_summary` | — |

Singura dependență tare: 4 după 3. Restul se pot aplica în orice ordine; ordinea de mai sus e cea recomandată. SQL-ul complet e în anexa de la final.

**Codul merge și fără migrări** (verificat în demo): plata pe bucăți și „Livrează și copiază” cu avans / neîncasat spun „…se activează după actualizarea bazei de date” și nu scriu nimic; „încasat tot” la copiere merge pe drumul vechi; cheia `client_sync_id` nu se trimite cât coloana lipsește; restul (tariful la editare, garda comenzilor, stocul pe produs) pornește pe server odată cu migrarea.

**De știut la punctul 5:** promptul cerea „coloană nulă + index parțial pe `(tenant_id, client_sync_id)`, ca la tabelele care o au deja”. În producție, tabelele care au deja cheia (`recoltari`, `vanzari`, `cheltuieli_diverse`, `activitati_agricole`) o au altfel: `not null default gen_random_uuid()` + index unic pe `(client_sync_id)` singur. Am urmat forma cerută explicit (nulă, parțială, pe tenant), ca rândurile existente să rămână `null` fără `update` și fără rescrierea tabelului.

## 3. Actualizările legitime ale unei comenzi livrate (punctul 2)

Căutate în `src/`, `scripts/` și în funcțiile din producție (`pg_proc` cu `update public.comenzi`, plus cheile străine către `comenzi`). Toate trec de gardă:

| Actualizare | Unde | Ce schimbă | De ce trece |
|---|---|---|---|
| Încasarea | `mark_comanda_incasata`, `adauga_plata_vanzare` | doar `vanzari` | nu atinge comanda |
| Redeschiderea | `reopen_comanda_atomic` | `status`, `linked_vanzare_id`, `observatii` | câmpuri nepăzite |
| Sincronizarea cu magazinul | trigger `sync_shop_order_status_from_comanda` (AFTER) | `shop_orders.status` | scrie în alt tabel |
| Magazinul → comanda | `sync_shop_order_bridge_status`, `resync_shop_order_bridge_qty` | — | refuză deja singure comenzile livrate |
| „Salvează în Clienți” | `useComandaActions.saveClientForComanda` | `client_id` din NULL în clientul nou | permis explicit: comanda avea doar nume scris de mână |
| Ștergerea unui client / produs | `ON DELETE SET NULL` pe `client_id` / `produs_id` | → NULL | permis explicit (schimbarea spre NULL) |
| Unirea clienților duplicați | `merge_clienti_duplicates` (din `scripts/dedupe-clienti-merge.ts`) | `client_id` → clientul principal | setarea locală `zmeurel.permite_schimbare_client_livrata` pusă de funcție |
| Ștergerea vânzării legate | `ON DELETE SET NULL` pe `linked_vanzare_id` | `linked_vanzare_id` | câmp nepăzit |
| Note și altele | formulare, Livrări | `observatii`, `note_interne`, `data_livrare`, `telefon`, `locatie_livrare`, `last_call_status`, `ordine_livrare`, `prioritara`, `updated_*` | câmpuri nepăzite |
| Asociația | `PATCH /api/association/orders`, `mark_association_order_delivered_atomic` | `status`, `note_interne`, `stock_deducted` | nepăzite / pornesc din `in_livrare` |
| Anularea | — | — | o comandă livrată nu se poate anula oricum (`validate_comanda_status_transition`) |

Păzite: `cantitate_kg`, `pret_per_kg`, `client_id` (în afara cazurilor de mai sus), `client_nume_manual`, `produs_id` (în afara trecerii spre NULL). `total` nu e păzit separat: îl recalculează `set_comenzi_tenant_and_audit` din cantitate × preț. Garda contează starea **veche**: și o „redeschidere” de mână cu altă cantitate în același UPDATE e oprită.

Verificarea de stoc pentru „în livrare” sare: comenzile magazinului asociației, apelurile fără utilizator și fără `service_role` (editorul SQL) și tenantul care nu e cel curent.

## 4. Idempotența plăților (punctul 3)

- Formularul „Cât a dat acum” generează o **cheie a plății** (uuid) la prima trimitere și o păstrează la reîncercare și la dublu-click; după o plată reușită, următoarea plată primește altă cheie. La livrare (Livrări), cheia e una pe deschiderea foii opririi.
- RPC-ul `adauga_plata_vanzare` blochează rândul vânzării (`select … for update`). Dacă cheia e deja în `vanzari.plati_aplicate`, întoarce vânzarea neschimbată. Altfel adună suma, adaugă cheia în listă și, la total, trece vânzarea pe `platit` cu `data_incasare` = ziua plății. Totul într-o tranzacție.
- Două cereri simultane cu aceeași cheie se așază una după alta pe blocajul rândului; a doua vede cheia scrisă de prima și nu mai adună.
- De ce o coloană `uuid[]` și nu un tabel nou de plăți: rămâne în rândul vânzării (aceleași politici RLS, aceeași ștergere la resetarea fermei, GDPR și curățarea demo-urilor), iar o vânzare are câteva plăți. Dezavantaj: nu există istoric pe plăți (sumă și dată pe fiecare), doar totalul și ziua ultimei plăți.

## 5. Ce n-am putut testa

- **Tot ce ține de migrări, pe server**: tariful salvat la editare (cu un tarif schimbat între timp), garda comenzii livrate și mesajul ei, stocul la editarea unei comenzi în livrare, plățile adunate (100 + 150 din 350, apoi restul), „Livrează și copiază” cu avans, cheia `client_sync_id` în bază, stocul pe produs. Migrările nu sunt aplicate, iar baza locală e producția. Logica e acoperită de teste unitare (pe regula din aplicație), iar SQL-ul e verificat doar prin citire (structura și definițiile din producție); pentru stocul pe produs am rulat un `select` agregat cu aceeași regulă: fermele cu o singură cultură ies identice (7 ferme doar cu zmeură, 1 doar cu mur; plus 9 ferme fără zmeură, cu legume sau cereale, care rămân pe toate recoltările), cele 84 cu zmeură + mure (demo-urile „Fructe de pădure”) scad cu murele.
- **Vânzarea rapidă** și **„Comandă din mesaj”** nu trimit încă `client_sync_id` (vânzarea rapidă are propriul mecanism de reîncercare, cu ștergere la eșec; „Din mesaj” și chatul AI nu le-am atins). Formularele din modulele puse deoparte (butași, chat) la fel.
- **Parcele** își socotesc sezonul agronomic separat (`lib/utils/sezon.ts`, anul calendaristic); modulul e pus deoparte, nu l-am atins.
- **`server-only`**: e importat, dar nu e în `package-lock.json` (îl dă Next intern). Nu l-am adăugat, ca să nu instalez nimic nou.
- `npm install` pe npm 11.6.2 adaugă oricum, și fără schimbările mele, 6 intrări pentru `@tailwindcss/oxide-wasm32-wasi`; am păstrat lock-ul fără ele (doar rădăcina și flagurile lui `sharp`).
- `public/sw.js` a fost regenerat de `npm run build` (era deja modificat înainte de sesiune); **nu e comis**.

## 6. Verificare

- `npm run lint`: 0 erori, 10 avertizări vechi (niciuna în fișierele atinse).
- `npm run typecheck`: trece.
- `npm run check:kit`: trece (150 de fișiere).
- `npm run test:critical:unit`: **597 din 597** (79 de fișiere; 8 fișiere de test noi).
- `npm run build`: trece.
- **În demo nou** („Fructe de pădure”, prin `/start`), 390×844, `next dev --webpack`:
  - recoltare 5 kg (Elena, 2,50 lei/kg) → 12,50 lei; editată la 8 kg → „De plată (2,50 lei/kg) 20,00 lei”, salvată 20,00 lei (tariful neschimbat; cazul cu tarif schimbat cere migrarea);
  - același început de sezon: Acasă „Sezonul 2026, până azi: 540 kg”, Culegători „Sezon 540 kg”, Rapoarte › Sezon „Producție 540 kg”;
  - Rapoarte: secțiunea „Investiții” (Lună: 4.860 RON, 2 investiții; Sezon: 13.860 RON, 7), separată; profitul = venituri − cheltuieli;
  - Vânzări: „Cât a dat acum?”, „A dat până acum: 0 lei · rest 283,50 lei”, „După plată: rest 183,50 lei”; 300 lei → „Plata depășește restul de plată (rest 283,50 lei).”; trimiterea fără migrare → „Plățile pe bucăți se activează după actualizarea bazei de date.”;
  - Livrări › „Copiază pentru livrarea următoare”: Cash / Transfer / Nu a plătit + suma; avans 100 lei fără migrare → mesajul clar, comanda nu s-a livrat și nimic nu s-a marcat încasat.
  - Date demo atinse: o recoltare nouă (editată), o vânzare trecută pe neîncasat, o comandă pusă în livrare.

## 7. Commit-uri

```
1bc97c9 fix(recoltari): editarea păstrează tariful salvat; migrare neaplicată
95ba91e feat(comenzi): gardă în bază pentru comanda livrată și stocul la editarea în livrare; migrare neaplicată
fbaf06b feat(vanzari): plățile parțiale se adună atomic, cu cheie pe plată; migrare neaplicată
0935b5b feat(livrari): „Livrează și copiază” cu încasat tot / avans / neîncasat; migrare neaplicată
f1c1b91 feat(idempotenta): client_sync_id pe comenzi, clienți, culegători, investiții; migrare neaplicată
0a8fd29 feat(rapoarte): investițiile într-o secțiune proprie, cu totalul perioadei
35930eb feat(stoc): stocul cal. 1 derivat numără doar zmeura când ferma are zmeură; migrare neaplicată
fd96951 feat(sezon): o singură regulă — sezonul începe la prima recoltare din an
7bb9b91 chore(cod-mort): motorul offline (db, syncEngine, syncables, e2e/offline) și crops / crop-varieties
c09467a chore(deps): dependențele folosite, dar nedeclarate, cu versiunea deja instalată
```
(+ commit-ul cu acest raport)

## Anexă — SQL complet al migrărilor (în ordinea aplicării)

### `supabase/migrations/20261121100000_recoltare_editare_tarif_salvat.sql`

```sql
-- Recoltări: editarea păstrează tariful din momentul înregistrării.
--
-- NEAPLICATĂ: o rulează Andrei, după merge.
--
-- Înainte: `update_recoltare_with_stock` citea mereu `culegatori.tarif_lei_kg` (tariful de azi) și
-- recalcula plata cu el. Dacă tariful culegătorului se schimbase între timp, editarea kilogramelor
-- unei recoltări vechi îi schimba și tariful.
--
-- Acum:
--   * același culegător  → plata = kg noi × `pret_lei_pe_kg_snapshot` (tariful salvat în rând);
--   * alt culegător       → tariful curent al noului culegător (ca la creare);
--   * rând vechi fără tarif salvat (`pret_lei_pe_kg_snapshot is null`) → tariful curent, ca înainte.
--
-- Corpul e cel din producție pe 21.11.2026 (`pg_get_functiondef`), cu o singură schimbare:
-- blocul care alege tariful. Semnătura, drepturile (EXECUTE pentru authenticated și service_role),
-- verificările de tenant / scriere, blocajul `stock-mutation` și garda anti-negativ rămân neschimbate.
-- `create or replace` păstrează drepturile existente.
--
-- Anulare: se rulează din nou definiția din producție de dinainte (blocul de tarif fără ramura
-- „același culegător”).

create or replace function public.update_recoltare_with_stock(
  p_recoltare_id uuid,
  p_data date,
  p_parcela_id uuid,
  p_culegator_id uuid,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null::text
)
returns public.recoltari
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
  v_current_recoltare public.recoltari;
  v_delta_cal1 numeric;
  v_summary record;
  v_available numeric;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_current_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  -- Tariful: cel salvat în rând, cât culegătorul rămâne același; altfel tariful curent.
  if p_culegator_id is not distinct from v_current_recoltare.culegator_id
     and v_current_recoltare.pret_lei_pe_kg_snapshot is not null then
    v_tarif := v_current_recoltare.pret_lei_pe_kg_snapshot;
  else
    select c.tarif_lei_kg
    into v_tarif
    from public.culegatori c
    where c.id = p_culegator_id
      and c.tenant_id = v_tenant_id;

    if v_tarif is null then
      raise exception 'Culegatorul nu are tarif setat in profil';
    end if;
  end if;

  -- Gardă anti-negativ pe sursa derivată: reducerea kg_cal1 nu poate coborî
  -- disponibilul sub 0 (echivalentul verificării vechi pe miscari_stoc).
  v_delta_cal1 := round((v_kg_cal1 - coalesce(v_current_recoltare.kg_cal1, 0))::numeric, 2);

  if v_delta_cal1 < 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta_cal1 < 0 then
      raise exception 'insufficient_stock_after_edit'
        using hint = 'Stocul ar deveni negativ după editare. Există comenzi care depind de această recoltare.';
    end if;
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  update public.recoltari
  set data = p_data,
      parcela_id = p_parcela_id,
      culegator_id = p_culegator_id,
      kg_cal1 = v_kg_cal1,
      kg_cal2 = v_kg_cal2,
      pret_lei_pe_kg_snapshot = round(v_tarif::numeric, 2),
      valoare_munca_lei = v_valoare_munca,
      observatii = nullif(btrim(coalesce(p_observatii, '')), ''),
      updated_at = now()
  where id = p_recoltare_id
    and tenant_id = v_tenant_id
  returning *
  into v_recoltare;

  return v_recoltare;
end;
$function$;

revoke execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) to authenticated, service_role;
```

### `supabase/migrations/20261121110000_comenzi_garda_livrata.sql`

```sql
-- Comenzi: gardă în bază pentru comenzile livrate și pentru cele în livrare.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se aplică după 20261121100000.
--
-- 1. O comandă LIVRATĂ (status vechi `livrata`) nu-și mai schimbă cantitatea, prețul, clientul sau
--    produsul. Contează starea veche, nu cea nouă: și o „redeschidere” făcută de mână, cu altă
--    cantitate în același UPDATE, e oprită. Mesajul e în română, cu `detail = COMANDA_LIVRATA_BLOCATA`
--    (aplicația îl recunoaște după detail).
--
--    Actualizările legitime ale unei comenzi livrate, găsite pe 21.11.2026 în cod (`src/`, `scripts/`)
--    și în funcțiile din producție (`pg_proc` cu `update public.comenzi`), și care trec mai departe:
--      * încasarea: `mark_comanda_incasata` scrie doar în `vanzari`; plățile parțiale la fel;
--      * redeschiderea: `reopen_comanda_atomic` schimbă `status`, `linked_vanzare_id`, `observatii`;
--      * sincronizarea cu magazinul: triggerul `sync_shop_order_status_from_comanda` (AFTER, scrie în
--        `shop_orders`); `sync_shop_order_bridge_status` și `resync_shop_order_bridge_qty` refuză deja
--        singure comenzile livrate;
--      * „Salvează în Clienți” (`useComandaActions.saveClientForComanda`): `client_id` din NULL într-un
--        client nou — permis (comanda avea doar nume scris de mână);
--      * ștergerea unui client / produs: cheile `ON DELETE SET NULL` pun `client_id` / `produs_id` pe
--        NULL — permis (schimbarea spre NULL);
--      * unirea clienților duplicați (`merge_clienti_duplicates`, rulată din
--        `scripts/dedupe-clienti-merge.ts`): mută `client_id` pe clientul principal — permisă prin
--        setarea locală de tranzacție `zmeurel.permite_schimbare_client_livrata = on`, pusă de funcție
--        (mai jos, `create or replace` cu o singură linie în plus);
--      * ștergerea vânzării legate: `ON DELETE SET NULL` pe `linked_vanzare_id` — câmp nepăzit;
--      * notele (`observatii`, `note_interne`), data, telefonul, adresa, `last_call_status`,
--        `ordine_livrare`, `prioritara`, `stock_deducted`, `updated_at` / `updated_by` — câmpuri nepăzite;
--      * asociația: `PATCH /api/association/orders` schimbă doar `status` și `note_interne`;
--        `mark_association_order_delivered_atomic` pornește din `in_livrare`;
--      * anularea unei comenzi livrate e deja oprită de `validate_comanda_status_transition`.
--    `total` nu e păzit separat: îl recalculează oricum `set_comenzi_tenant_and_audit` din
--    cantitate × preț, care sunt păzite.
--
-- 2. O comandă ÎN LIVRARE (rămâne `in_livrare`) editată la mai multe kg trece prin aceeași regulă de
--    stoc ca la intrarea în livrare (`set_comanda_in_delivery`): kilogramele în plus trebuie să încapă în
--    `get_sellable_cal1_stock_summary(...).disponibil_cal1_kg`. Altfel `STOC_INSUFICIENT`, cu
--    `detail = necesar=<kg în plus>;disponibil=<kg>` (aplicația îl citește deja cu `parseStocInsuficient`).
--    Disponibilul socotit în BEFORE UPDATE conține deja cantitatea veche a comenzii ca angajată, deci se
--    compară doar diferența. Blocajul `stock-mutation` e același ca în celelalte funcții de stoc.
--    Nu se aplică: comenzilor magazinului asociației (au fluxul lor), apelurilor fără utilizator și fără
--    `service_role` (editorul SQL), și când tenantul comenzii nu e tenantul curent (funcția de stoc ar
--    refuza oricum) — acolo se lasă ca înainte.
--
-- Numele triggerului (`comenzi_guard_livrata_si_stoc`) îl pune, în ordinea alfabetică a triggerelor
-- BEFORE UPDATE, după gărzile asociației și înainte de `comenzi_set_tenant_and_audit` și
-- `validate_comanda_status`.
--
-- Funcția de trigger e SECURITY INVOKER și nu e RPC: EXECUTE rămâne doar la service_role (execuția
-- unui trigger nu verifică EXECUTE). `get_sellable_cal1_stock_summary` e apelabilă de authenticated.
--
-- Aditivă: o funcție nouă, un trigger nou, `create or replace` pe `merge_clienti_duplicates` (corpul
-- din producție pe 21.11.2026 + o linie). Fără date atinse.
--
-- Anulare:
--   drop trigger if exists comenzi_guard_livrata_si_stoc on public.comenzi;
--   drop function if exists public.guard_comenzi_livrata_si_stoc();
--   (merge_clienti_duplicates poate rămâne: setarea locală nu are efect fără trigger.)

create or replace function public.guard_comenzi_livrata_si_stoc()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_permite_client boolean := coalesce(current_setting('zmeurel.permite_schimbare_client_livrata', true), '') = 'on';
  v_summary record;
  v_available numeric;
  v_delta numeric;
begin
  -- 1. Comanda livrată: cantitatea, prețul, clientul și produsul rămân cum au fost livrate.
  if old.status = 'livrata' then
    if old.cantitate_kg is distinct from new.cantitate_kg
       or old.pret_per_kg is distinct from new.pret_per_kg
       or (old.produs_id is distinct from new.produs_id and new.produs_id is not null)
       or (
         old.client_id is distinct from new.client_id
         and old.client_id is not null
         and new.client_id is not null
         and not v_permite_client
       )
       or (old.client_nume_manual is distinct from new.client_nume_manual and not v_permite_client)
    then
      raise exception 'Comanda e livrată: cantitatea, prețul, clientul și produsul nu se mai pot schimba. Dacă trebuie corectată, redeschide comanda întâi.'
        using
          errcode = 'P0001',
          detail = 'COMANDA_LIVRATA_BLOCATA',
          hint = 'Redeschide comanda din foaia ei, apoi editeaz-o.';
    end if;

    return new;
  end if;

  -- 2. Comanda în livrare editată la mai multe kg: kilogramele în plus trebuie să fie în stoc.
  if old.status = 'in_livrare'
     and new.status = 'in_livrare'
     and round(coalesce(new.cantitate_kg, 0)::numeric, 2) > round(coalesce(old.cantitate_kg, 0)::numeric, 2)
     and coalesce(old.data_origin, '') <> 'magazin_asociatie'
  then
    if auth.uid() is null and v_role <> 'service_role' then
      return new;
    end if;

    if v_role <> 'service_role' and public.current_tenant_id() is distinct from new.tenant_id then
      return new;
    end if;

    perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(new.tenant_id::text));

    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(new.tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);
    v_delta := round((coalesce(new.cantitate_kg, 0) - coalesce(old.cantitate_kg, 0))::numeric, 2);

    if v_delta > v_available then
      raise exception 'STOC_INSUFICIENT'
        using
          errcode = 'P0001',
          detail = format('necesar=%s;disponibil=%s', v_delta, v_available),
          hint = 'Nu ajunge stocul pentru kilogramele în plus. Scoate comanda din livrare sau notează recoltarea.';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.guard_comenzi_livrata_si_stoc() from public, anon, authenticated;
grant execute on function public.guard_comenzi_livrata_si_stoc() to service_role;

drop trigger if exists comenzi_guard_livrata_si_stoc on public.comenzi;
create trigger comenzi_guard_livrata_si_stoc
  before update on public.comenzi
  for each row
  execute function public.guard_comenzi_livrata_si_stoc();

-- Unirea clienților duplicați mută și comenzile livrate pe clientul principal: e singura schimbare de
-- client permisă pe o comandă livrată, prin setarea locală (ține doar până la sfârșitul tranzacției).
-- Corpul din producție pe 21.11.2026, cu o singură linie în plus (`set_config`). SECURITY INVOKER, ca înainte.
create or replace function public.merge_clienti_duplicates(
  p_tenant_id uuid,
  p_principal_id uuid,
  p_orphan_ids uuid[],
  p_merged_by text default null::text
)
returns table(orphan_id uuid, comenzi_migrated integer, vanzari_migrated integer, vanzari_butasi_migrated integer)
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_orphan_id uuid;
  v_comenzi_count integer;
  v_vanzari_count integer;
  v_vb_count integer;
  v_principal_telefon text;
  v_orphan_telefon text;
  v_orphan_nume text;
begin
  if not exists (
    select 1 from public.clienti
    where id = p_principal_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Principal % nu aparține tenantului % (sau nu există)', p_principal_id, p_tenant_id;
  end if;

  perform set_config('zmeurel.permite_schimbare_client_livrata', 'on', true);

  select telefon into v_principal_telefon
  from public.clienti
  where id = p_principal_id;

  foreach v_orphan_id in array p_orphan_ids loop
    if v_orphan_id = p_principal_id then
      continue;
    end if;

    select telefon, nume_client into v_orphan_telefon, v_orphan_nume
    from public.clienti
    where id = v_orphan_id and tenant_id = p_tenant_id;

    if not found then
      raise exception 'Orfanul % nu aparține tenantului % (sau nu mai există)', v_orphan_id, p_tenant_id;
    end if;

    update public.comenzi
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_comenzi_count = row_count;

    update public.vanzari
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_vanzari_count = row_count;

    update public.vanzari_butasi
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_vb_count = row_count;

    delete from public.clienti
      where id = v_orphan_id and tenant_id = p_tenant_id;

    insert into public.clienti_merge_audit (
      tenant_id, principal_client_id, orphan_client_id,
      principal_telefon, orphan_telefon, orphan_nume_client,
      comenzi_migrated, vanzari_migrated, vanzari_butasi_migrated,
      merged_by
    ) values (
      p_tenant_id, p_principal_id, v_orphan_id,
      v_principal_telefon, v_orphan_telefon, v_orphan_nume,
      v_comenzi_count, v_vanzari_count, v_vb_count,
      p_merged_by
    );

    orphan_id := v_orphan_id;
    comenzi_migrated := v_comenzi_count;
    vanzari_migrated := v_vanzari_count;
    vanzari_butasi_migrated := v_vb_count;
    return next;
  end loop;
end;
$function$;
```

### `supabase/migrations/20261121120000_vanzari_plati_adunate.sql`

```sql
-- Vânzări: plățile parțiale se adună, atomic, fără să se dubleze la reîncercare.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se aplică după 20261121110000.
-- Cere coloanele `suma_incasata_partial_lei` / `data_incasare_partiala` (20261120090000, aplicată).
--
-- Înainte: aplicația scria direct `suma_incasata_partial_lei = <suma nouă>`, deci a doua plată o
-- suprascria pe prima (50 + 30 → 30).
--
-- Acum: RPC-ul `adauga_plata_vanzare` adună plata la ce s-a încasat deja, sub blocajul rândului
-- (`select … for update`), într-o singură tranzacție:
--   * plata trebuie să fie > 0 și să nu depășească restul de plată (altfel eroare, detail `PLATA_PESTE_REST`);
--   * o vânzare deja încasată nu mai primește plăți (detail `VANZARE_DEJA_INCASATA`);
--   * când suma încasată ajunge la total, vânzarea devine `platit`, cu `data_incasare` = ziua plății
--     care a completat-o. Venitul intră atunci, integral, la acea zi (regula `ziuaVenitului` din
--     `src/lib/vanzari/incasari.ts`, neschimbată).
--
-- Idempotența: fiecare plată are o cheie (`p_plata_id`, uuid generat de formular la deschiderea lui și
-- păstrat la reîncercare / dublu-click). Cheile plăților aplicate se țin în coloana nouă
-- `vanzari.plati_aplicate uuid[]`. O cheie care e deja acolo întoarce vânzarea neschimbată, fără să mai
-- adune nimic. Două cereri simultane cu aceeași cheie se așază una după alta pe blocajul rândului; a doua
-- vede cheia scrisă de prima (READ COMMITTED: fiecare instrucțiune vede ce s-a confirmat înainte).
-- De ce o coloană și nu un tabel nou de plăți: rămâne în rândul vânzării (aceleași politici RLS, aceeași
-- ștergere la resetarea fermei / GDPR / curățarea demo-urilor), iar o vânzare are câteva plăți, nu sute.
--
-- Drepturi: proprietarul fermei sau un operator cu scriere pe `comenzi` / `livrari` (ca la
-- `mark_comanda_incasata`). SECURITY DEFINER, cu filtrul pe `current_tenant_id()`.
--
-- Aditivă: o coloană nouă (rândurile existente primesc `{}`; nu se atinge nicio valoare existentă),
-- o funcție nouă.
--
-- Anulare:
--   drop function if exists public.adauga_plata_vanzare(uuid, numeric, date, uuid);
--   (coloana `plati_aplicate` poate rămâne.)

alter table public.vanzari
  add column if not exists plati_aplicate uuid[] not null default '{}'::uuid[];

comment on column public.vanzari.plati_aplicate is
  'Cheile de idempotență ale plăților parțiale deja adunate (adauga_plata_vanzare).';

create or replace function public.adauga_plata_vanzare(
  p_vanzare_id uuid,
  p_suma_lei numeric,
  p_data date,
  p_plata_id uuid
)
returns public.vanzari
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_sale public.vanzari;
  v_suma numeric;
  v_total numeric;
  v_primit numeric;
  v_rest numeric;
  v_nou numeric;
  v_data date;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (
    public.is_tenant_owner(v_tenant_id)
    or public.operator_can_write('comenzi')
    or public.operator_can_write('livrari')
  ) then
    raise exception 'forbidden_read_only';
  end if;

  if p_plata_id is null then
    raise exception 'Plata nu are cheie. Reîncarcă pagina și încearcă din nou.';
  end if;

  select *
  into v_sale
  from public.vanzari
  where id = p_vanzare_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Vânzarea nu a fost găsită.';
  end if;

  -- Aceeași plată trimisă a doua oară (reîncercare, dublu-click): nimic nou.
  if p_plata_id = any(coalesce(v_sale.plati_aplicate, '{}'::uuid[])) then
    return v_sale;
  end if;

  if lower(btrim(coalesce(v_sale.status_plata, ''))) in ('platit', 'platita', 'incasat', 'incasata', 'achitat', 'achitata') then
    raise exception 'Vânzarea e deja încasată.'
      using errcode = 'P0001', detail = 'VANZARE_DEJA_INCASATA';
  end if;

  v_suma := round(coalesce(p_suma_lei, 0)::numeric, 2);
  if v_suma <= 0 then
    raise exception 'Suma primită trebuie să fie mai mare decât 0.';
  end if;

  v_data := coalesce(p_data, public.bucharest_today());
  v_total := round((coalesce(v_sale.cantitate_kg, 0) * coalesce(v_sale.pret_lei_kg, 0))::numeric, 2);
  v_primit := least(greatest(round(coalesce(v_sale.suma_incasata_partial_lei, 0)::numeric, 2), 0), v_total);
  v_rest := round((v_total - v_primit)::numeric, 2);

  if v_suma > v_rest then
    raise exception 'Plata depășește restul de plată (rest %s lei).', trim(to_char(v_rest, 'FM999999990.00'))
      using errcode = 'P0001', detail = format('PLATA_PESTE_REST;rest=%s', v_rest);
  end if;

  v_nou := round((v_primit + v_suma)::numeric, 2);

  if v_nou >= v_total then
    update public.vanzari
    set suma_incasata_partial_lei = v_nou,
        data_incasare_partiala = v_data,
        status_plata = 'platit',
        data_incasare = v_data,
        plati_aplicate = array_append(coalesce(plati_aplicate, '{}'::uuid[]), p_plata_id),
        updated_at = now(),
        updated_by = v_user_id
    where id = v_sale.id
      and tenant_id = v_tenant_id
    returning *
    into v_sale;
  else
    update public.vanzari
    set suma_incasata_partial_lei = v_nou,
        data_incasare_partiala = v_data,
        plati_aplicate = array_append(coalesce(plati_aplicate, '{}'::uuid[]), p_plata_id),
        updated_at = now(),
        updated_by = v_user_id
    where id = v_sale.id
      and tenant_id = v_tenant_id
    returning *
    into v_sale;
  end if;

  return v_sale;
end;
$function$;

revoke execute on function public.adauga_plata_vanzare(uuid, numeric, date, uuid) from public, anon;
grant execute on function public.adauga_plata_vanzare(uuid, numeric, date, uuid) to authenticated, service_role;
```

### `supabase/migrations/20261121130000_livreaza_si_copiaza_plata.sql`

```sql
-- Livrări: „Livrează și copiază” cu aceleași opțiuni de plată ca livrarea normală.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se aplică după 20261121120000 (folosește
-- `adauga_plata_vanzare`).
--
-- Înainte: `deliver_and_clone_comanda` chema `set_comanda_delivered(..., 'platit')`, deci vânzarea
-- comenzii livrate ieșea mereu încasată, chiar dacă clientul n-a plătit sau a dat doar un avans.
--
-- Acum: funcția NOUĂ `livreaza_si_copiaza_comanda` primește plata, ca livrarea normală:
--   * `p_status_plata = 'platit'`  → încasat tot (ca înainte);
--   * `p_status_plata = 'neplatit'` și `p_suma_primita_lei > 0` → avans: vânzarea rămâne neîncasată,
--     iar suma se adună prin `adauga_plata_vanzare` (aceeași regulă și aceeași cheie de idempotență);
--     dacă avansul acoperă tot, vânzarea devine încasată;
--   * `p_status_plata = 'neplatit'` fără sumă → neîncasat.
-- Restul e identic cu `deliver_and_clone_comanda` (corpul din producție pe 21.11.2026): doar comenzile
-- `in_livrare`, livrare integrală, comanda nouă `programata` pe ziua aleasă, cu același preț.
-- Totul într-o singură tranzacție: dacă avansul e refuzat, nu rămâne nici livrarea, nici copia.
--
-- De ce o funcție nouă și nu un parametru în plus la `deliver_and_clone_comanda`: cu valori implicite,
-- apelul cu 3 argumente al aplicației din producție ar potrivi două supraîncărcări (PGRST203). Funcția
-- veche rămâne neschimbată; aplicația o folosește în continuare pentru „încasat tot”.
--
-- Aditivă: o funcție nouă.
--
-- Anulare: drop function if exists public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid);

create or replace function public.livreaza_si_copiaza_comanda(
  p_comanda_id uuid,
  p_new_cantitate_kg numeric,
  p_new_data_livrare date,
  p_status_plata text,
  p_suma_primita_lei numeric default null,
  p_plata_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_delivery_result jsonb;
  v_delivered_order jsonb;
  v_sale_id uuid;
  v_sale public.vanzari;
  v_new_order public.comenzi;
  v_suma numeric := round(coalesce(p_suma_primita_lei, 0)::numeric, 2);
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  if p_status_plata is null or p_status_plata not in ('platit', 'neplatit') then
    raise exception 'Status plată invalid.';
  end if;

  if v_suma < 0 then
    raise exception 'Suma primită nu poate fi negativă.';
  end if;

  if p_new_cantitate_kg is null or p_new_cantitate_kg <= 0 then
    raise exception 'Cantitatea comenzii noi trebuie să fie mai mare decât 0.';
  end if;

  if p_new_data_livrare is null then
    raise exception 'Data de livrare a comenzii noi este obligatorie.';
  end if;

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalidă pentru tenantul curent.';
  end if;

  if v_order.status <> 'in_livrare' then
    raise exception 'Doar comenzile aflate în livrare pot fi livrate cu clonare pentru livrarea următoare.';
  end if;

  v_delivery_result := public.set_comanda_delivered(p_comanda_id, null, p_status_plata);
  v_delivered_order := v_delivery_result -> 'delivered_order';
  v_sale_id := nullif(v_delivery_result -> 'vanzare' ->> 'id', '')::uuid;

  -- Avansul: se adună la vânzarea abia creată, prin aceeași funcție ca orice plată parțială.
  if p_status_plata = 'neplatit' and v_suma > 0 and v_sale_id is not null then
    v_sale := public.adauga_plata_vanzare(v_sale_id, v_suma, public.bucharest_today(), coalesce(p_plata_id, gen_random_uuid()));
  else
    select * into v_sale from public.vanzari where id = v_sale_id and tenant_id = v_tenant_id;
  end if;

  insert into public.comenzi (
    tenant_id,
    client_id,
    client_nume_manual,
    telefon,
    locatie_livrare,
    data_comanda,
    data_livrare,
    cantitate_kg,
    pret_per_kg,
    total,
    order_kind,
    status,
    parent_comanda_id,
    produs_id
  )
  values (
    v_tenant_id,
    nullif(v_delivered_order ->> 'client_id', '')::uuid,
    v_delivered_order ->> 'client_nume_manual',
    v_delivered_order ->> 'telefon',
    v_delivered_order ->> 'locatie_livrare',
    public.bucharest_today(),
    p_new_data_livrare,
    round(p_new_cantitate_kg::numeric, 2),
    round(coalesce((v_delivered_order ->> 'pret_per_kg')::numeric, 0), 2),
    round((p_new_cantitate_kg * coalesce((v_delivered_order ->> 'pret_per_kg')::numeric, 0))::numeric, 2),
    'manual',
    'programata',
    p_comanda_id,
    nullif(v_delivered_order ->> 'produs_id', '')::uuid
  )
  returning *
  into v_new_order;

  return jsonb_build_object(
    'delivered_order', v_delivered_order,
    'vanzare', to_jsonb(v_sale),
    'new_order', to_jsonb(v_new_order)
  );
end;
$function$;

revoke execute on function public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid) from public, anon;
grant execute on function public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid) to authenticated, service_role;
```

### `supabase/migrations/20261121140000_client_sync_id_comenzi_clienti_culegatori_investitii.sql`

```sql
-- Cheia de idempotență (`client_sync_id`) pentru comenzi, clienți, culegători și investiții.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
--
-- De ce: formularele de creare trimit o cheie (aceeași cât e deschis formularul, și la reîncercare după
-- eroare). Fără coloană în bază, o cerere repetată (rețea slabă, dublu-click) putea crea a doua comandă /
-- al doilea client. Cu indexul unic, a doua inserare pică cu 23505, iar aplicația o tratează ca reușită
-- și recitește rândul după cheie.
--
-- Forma, cum a cerut promptul 17: `client_sync_id uuid null` + index unic PARȚIAL pe
-- `(tenant_id, client_sync_id) where client_sync_id is not null`.
-- De știut: tabelele care au deja cheia în producție (recoltari, vanzari, cheltuieli_diverse,
-- activitati_agricole; citite pe 21.11.2026 din information_schema și pg_indexes) o au altfel:
-- `uuid not null default gen_random_uuid()` + index unic pe `(client_sync_id)` singur. Aici coloana e
-- nulă și fără valoare implicită, ca rândurile existente să rămână neatinse (`null`, fără update și fără
-- rescrierea tabelului), iar indexul e pe tenant, ca o cheie să nu poată „ciocni” între ferme.
--
-- Aditivă: patru coloane noi (nule) și patru indexuri. Fără date atinse. Se poate rula de două ori.
--
-- Anulare:
--   drop index if exists public.comenzi_tenant_client_sync_id_uq;
--   drop index if exists public.clienti_tenant_client_sync_id_uq;
--   drop index if exists public.culegatori_tenant_client_sync_id_uq;
--   drop index if exists public.investitii_tenant_client_sync_id_uq;
--   (coloanele pot rămâne.)

alter table public.comenzi add column if not exists client_sync_id uuid null;
alter table public.clienti add column if not exists client_sync_id uuid null;
alter table public.culegatori add column if not exists client_sync_id uuid null;
alter table public.investitii add column if not exists client_sync_id uuid null;

create unique index if not exists comenzi_tenant_client_sync_id_uq
  on public.comenzi (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists clienti_tenant_client_sync_id_uq
  on public.clienti (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists culegatori_tenant_client_sync_id_uq
  on public.culegatori (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists investitii_tenant_client_sync_id_uq
  on public.investitii (tenant_id, client_sync_id)
  where client_sync_id is not null;
```

### `supabase/migrations/20261121150000_stoc_cal1_pe_produs.sql`

```sql
-- Stocul cal. 1 derivat, socotit pe produsul vândut (zmeura), nu pe toate culturile.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11; după
-- 20261121110000 (garda comenzilor) doar ca ordine recomandată, fiindcă și garda citește stocul.
--
-- Înainte: `get_sellable_cal1_stock_summary` aduna `kg_cal1` din TOATE recoltările fermei. O fermă cu
-- zmeură și mure (de exemplu ferma demo „Fructe de pădure”) vedea murele în stocul de zmeură pe care îl
-- vinde prin Comenzi / Livrări / Vânzare rapidă.
--
-- Acum: recoltările se filtrează pe cultura lor, prin legătura recoltare → produs care există deja,
-- `resolve_recoltare_stock_identity(parcela_id, observatii, tenant_id)` (alegerea culturii din recoltare,
-- `[zmeurel:harvest-crop]`, apoi prima cultură a parcelei, apoi `parcele.cultura` / `tip_fruct`):
--   * dacă ferma are cel puțin o recoltare de zmeură (cultura, fără diacritice și majuscule, începe cu
--     „zmeur”: „Zmeură”, „zmeura”, „Zmeure Delniwa”…), stocul numără doar recoltările de zmeură;
--   * altfel (ferma nu are deloc zmeură: solarii, cereale), stocul rămâne ca înainte, din toate recoltările.
-- O fermă cu o singură cultură are același rezultat ca înainte: fie toate recoltările sunt de zmeură, fie
-- niciuna. Ferma lui Andrei are azi o singură cultură (zmeură; verificat pe 21.11.2026 cu select).
-- Comenzile (livrate / în livrare), comenzile magazinului și ajustările nu se filtrează: ele sunt deja
-- ale produsului vândut.
--
-- `cultura_recoltare_stoc` (nouă): învelește `resolve_recoltare_stock_identity` și întoarce cultura
-- normalizată; o parcelă lipsă sau o etichetă stricată dau `null` (recoltarea nu e numărată ca zmeură),
-- nu opresc tot calculul stocului. SECURITY DEFINER, EXECUTE doar pentru service_role: o cheamă doar
-- `get_sellable_cal1_stock_summary` (care rulează ca proprietarul funcției).
--
-- `get_sellable_cal1_stock_summary`: corpul din producție pe 21.11.2026 (`pg_get_functiondef`), cu o
-- singură schimbare: blocul care socotește `v_recoltat`. Semnătura, coloanele întoarse și drepturile
-- rămân aceleași.
--
-- Anulare: se rulează din nou definiția din producție de dinainte (`v_recoltat` = suma tuturor recoltărilor);
--   drop function if exists public.cultura_recoltare_stoc(text, uuid, uuid);

create or replace function public.cultura_recoltare_stoc(
  p_observatii text,
  p_parcela_id uuid,
  p_tenant_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_identity jsonb;
begin
  if p_parcela_id is null or p_tenant_id is null then
    return null;
  end if;

  begin
    v_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, p_tenant_id);
  exception
    when others then
      return null;
  end;

  return nullif(
    translate(lower(btrim(coalesce(v_identity ->> 'cultura', ''))), 'ăâîșşțţ', 'aaissttt'),
    ''
  );
end;
$function$;

revoke execute on function public.cultura_recoltare_stoc(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cultura_recoltare_stoc(text, uuid, uuid) to service_role;

create or replace function public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null::uuid)
returns table(
  recoltat_cal1_kg numeric,
  consumat_definitiv_cal1_kg numeric,
  rezervat_activ_cal1_kg numeric,
  legacy_in_livrare_fara_rezervare_kg numeric,
  stoc_cal1_ledger_kg numeric,
  disponibil_cal1_kg numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_recoltat numeric := 0;
  v_recoltat_toate numeric := 0;
  v_recoltat_zmeura numeric := 0;
  v_are_zmeura boolean := false;
  v_livrat_comenzi numeric := 0;
  v_livrat_shop_nepromovat numeric := 0;
  v_in_livrare_comenzi numeric := 0;
  v_in_livrare_shop_nepromovat numeric := 0;
  v_ajustari numeric := 0;
  v_consumat numeric := 0;
  v_angajat numeric := 0;
  v_ledger numeric := 0;
  v_disponibil numeric := 0;
begin
  if auth.uid() is null and v_role <> 'service_role' then
    raise exception 'UNAUTHORIZED';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  v_tenant_id := coalesce(p_tenant_id, v_current_tenant_id);

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if v_role <> 'service_role'
     and (v_current_tenant_id is null or v_current_tenant_id <> v_tenant_id) then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  -- Recoltat, pe produsul vândut: doar zmeura, dacă ferma are zmeură; altfel toate recoltările.
  with rc as (
    select r.kg_cal1, public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) as cultura
    from public.recoltari r
    where r.tenant_id = v_tenant_id
  )
  select
    round(coalesce(sum(rc.kg_cal1), 0)::numeric, 2),
    round(coalesce(sum(rc.kg_cal1) filter (where rc.cultura like 'zmeur%'), 0)::numeric, 2),
    coalesce(bool_or(rc.cultura like 'zmeur%'), false)
  into v_recoltat_toate, v_recoltat_zmeura, v_are_zmeura
  from rc;

  v_recoltat := case when v_are_zmeura then v_recoltat_zmeura else v_recoltat_toate end;

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_livrat_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'livrata';

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_in_livrare_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'in_livrare';

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_livrat_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'livrata'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_in_livrare_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'in_livrare'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id;

  v_consumat := round((v_livrat_comenzi + v_livrat_shop_nepromovat)::numeric, 2);
  v_angajat := round((v_in_livrare_comenzi + v_in_livrare_shop_nepromovat)::numeric, 2);
  v_ledger := round((v_recoltat - v_consumat + v_ajustari)::numeric, 2);
  v_disponibil := round((v_ledger - v_angajat)::numeric, 2);

  return query
  select
    v_recoltat,
    v_consumat,
    v_angajat,
    0::numeric,
    v_ledger,
    v_disponibil;
end;
$function$;

revoke execute on function public.get_sellable_cal1_stock_summary(uuid) from public, anon;
grant execute on function public.get_sellable_cal1_stock_summary(uuid) to authenticated, service_role;
```

