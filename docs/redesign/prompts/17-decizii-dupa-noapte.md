# Prompt 17 — Deciziile lui Andrei după rularea de noapte

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/decizii-noapte` (pornit din `48fc0f2`, vârful lui `redesign/noapte-curatenie`; dacă `main` a ajuns deja la `48fc0f2`, e același commit) · Rezultat: branch verde, cu push, fără merge

## Context

- Promptul 16 (rularea de noapte) a pus 11 întrebări. Andrei a acceptat **toate recomandările** pe 21.11. Acest prompt le implementează.
- Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari, notezi în raport și continui.
- Commit-uri mici, câte unul pe punct, cu push după fiecare. Fiecare schimbare de logică vine cu test unitar care pică înainte și trece după.
- Migrările le scrii, **nu le aplici**. Pot fi mai multe fișiere, câte unul pe subiect, toate aditive: coloane noi, indexuri, `create or replace function`, triggere noi. Fără `drop` pe tabele sau coloane, fără `update`/`delete` pe date. Orice funcție nouă `SECURITY DEFINER` respectă regula din `CLAUDE.md` (`revoke ... from public, anon`). Înainte de a scrie o migrare, citești cu `select` definiția actuală din producție (`pg_get_functiondef`, `pg_indexes`, `information_schema`), nu din fișierele vechi de migrare.

## Ce faci

1. **Editarea unei recoltări păstrează tariful salvat.** În `update_recoltare_with_stock`, plata culegătorului se recalculează azi la tariful curent. Regula nouă: la editare se păstrează tariful din momentul înregistrării (din rândul existent). Tariful curent se ia doar dacă se schimbă culegătorul; dacă se schimbă doar kg, plata = kg noi × tariful salvat. Migrare cu `create or replace function` și test pe logica din aplicație (dacă există o parte în TS).

2. **Gardă în bază pentru comenzi.**
   - O comandă **livrată** nu mai poate fi modificată la câmpurile care schimbă cantitatea, prețul, clientul sau produsul: trigger `before update` care ridică eroare cu mesaj în română.
   - Înainte de trigger, cauți în cod și în funcțiile din bază **toate** actualizările legitime ale unei comenzi livrate (încasare, sincronizarea cu magazinul `sync_shop_order_status_from_comanda`, anulare, note etc.) și le lași să treacă.
   - O comandă **în livrare** editată la mai multe kg trece printr-o verificare de stoc (aceeași regulă ca la crearea livrării); refuz cu mesaj clar dacă stocul nu ajunge.
   - Aplicația afișează mesajul de eroare frumos, nu tehnic.

3. **Plățile parțiale se adună.** Azi, a doua plată parțială o suprascrie pe prima (50 + 30 → 30). Regula nouă: fiecare plată se adaugă la ce s-a încasat deja; plata nu poate depăși restul de plată. În interfață, câmpul se numește „Cât a dat acum”, iar sub el apare „A dat până acum: X lei · rest Y lei”. Când suma ajunge la total, vânzarea devine încasată și venitul intră integral la data încasării restului (regula din `lib/vanzari/incasari.ts`, `ziuaVenitului`). Adunarea trebuie să fie atomică în bază (RPC sau `update ... set x = x + ...` cu verificare), nu citire și scriere separate în client. Ai grijă la reîncercarea offline/dublu-click: aceeași plată nu se adaugă de două ori (cheie de idempotență pe plată sau altă soluție, explicată în raport).

4. **„Livrează și copiază”** oferă aceleași opțiuni de plată ca livrarea normală (încasat tot / avans / neîncasat), nu mai marchează vânzarea mereu încasată.

5. **Cheia de idempotență în bază** pentru `comenzi`, `clienti`, `culegatori`, `investitii`:
   - migrare cu coloana `client_sync_id uuid null` și index unic parțial `(tenant_id, client_sync_id) where client_sync_id is not null`, ca la tabelele care o au deja (copiezi modelul lor exact);
   - formularele de creare trimit cheia, iar 409 / `23505` pe acest index se tratează ca succes;
   - rândurile existente rămân cu `null` (fără `update`).

6. **Investițiile, separat în Rapoarte.** Apar într-o secțiune proprie, „Investiții”, cu totalul perioadei. Nu intră la costuri și nu scad din profit. Acasă rămâne neschimbat.

7. **Stocul cal. 1 derivat, filtrat pe produs.** Azi adună recoltările din toate culturile. Regula nouă: stocul se socotește pe produsul vândut (zmeura, la ferma lui Andrei), folosind legătura recoltare → produs care există deja (`resolve_recoltare_stock_identity` sau echivalent). Pentru o fermă cu o singură cultură, rezultatul trebuie să rămână identic. Test cu două culturi.

8. **„Azi” de pe ceasul telefonului** (`useTodayIso`) rămâne cum e. Nu schimbi nimic aici.

9. **O singură regulă de sezon.** Culegători numără de la 1 ianuarie, iar Acasă pe desktop de la 1 martie. Regula unică e cea pe care Andrei a hotărât-o pentru Acasă: **sezonul începe la prima recoltare din anul curent** (dacă nu există nicio recoltare anul acesta, de la 1 ianuarie). Faci un singur helper (de ex. `inceputSezon`), cu test, și îl folosești în Acasă pe telefon și pe desktop, în Culegători și oriunde altundeva se socotește „sezonul”. Dacă Acasă pe telefon are deja logica, o muți în helper în loc să faci una nouă.

10. **Codul mort rămas:**
    - motorul offline (`src/lib/offline/db.ts`, `syncEngine.ts`, `syncables.ts`) împreună cu `e2e/offline.spec.ts`, după ce reverifici cu `grep` că nimic din aplicație nu-l importă. `generateClientId.ts` rămâne dacă e folosit. Actualizezi secțiunea „Offline-first / Idempotency” din `CLAUDE.md` după realitate;
    - `src/lib/supabase/queries/crops.ts` și `crop-varieties.ts`, dacă nu le importă nimic.

11. **Dependențele folosite, dar nedeclarate** (`sharp`, `@radix-ui/react-select`, `postcss` și celelalte găsite de tine): le adaugi explicit în `package.json`, **cu versiunea care e deja instalată** în `package-lock.json` (fără upgrade-uri). `npm install` nu trebuie să schimbe versiunile rezolvate.

## Ce NU faci

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale se fac **doar într-un cont demo**.
- Nu aplici migrările, nu apelezi cronuri, nu schimbi variabile de mediu, nu deployezi Edge Functions.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- Nu atingi modulele puse deoparte (Asociația, chatul AI, Material săditor / butași, Parcele + Activități, magazinul), în afară de ce cere strict punctul 2 (sincronizarea cu magazinul trebuie să meargă mai departe).

## Verificare în demo (la final)

Într-un demo nou, la 390×844:
- recoltare, apoi editarea ei la alte kg: plata rămâne la tariful de atunci;
- comandă livrată: încerci s-o editezi și primești mesajul clar;
- două plăți parțiale (100 + 150 dintr-o vânzare de 350), apoi restul: totalurile și venitul ies corect;
- „Livrează și copiază” cu avans;
- Rapoarte: investițiile apar separat;
- Culegători și Acasă: același început de sezon.

## Raportul

- ce ai schimbat, pe puncte (1–11), cu commit;
- migrările, cu SQL complet, și ordinea în care trebuie aplicate;
- lista actualizărilor legitime ale unei comenzi livrate, găsite la punctul 2;
- cum ai rezolvat idempotența plăților la punctul 3;
- ce n-ai putut testa;
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
