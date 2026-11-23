# Raport — promptul 31: prima pagină, /start, Login, fermă nouă, cultura din parcele

Branch: `redesign/start-31`, pornit din `origin/main` la `870995c` (promptul 30 era deja în main). Fără merge.
`public/sw.js` nu e în niciun commit.

## 1. Ce am schimbat, pe secțiuni

### 1. Prima pagină (`src/app/page.tsx`, `src/components/landing/`)
- Titlul „Ferma ta, pe telefon. Fără hârtii.”, subtitlul din prototip, `metadata` (title, description, openGraph, twitter) noi.
- Ordinea din prototip: titlul cu „Încearcă fără cont” (`/start?demo=1`, deschide direct tipul de demo) și „Am deja cont” (`/login`) → capturi reale → 6 plăci „Ce ții în Zmeurel” → povestea lui Andrei (textul din prototip, două poze de la fermă) → „Gratuit cât e în beta” + rândul „Pentru asociații: în curând” → întrebări (`details`, fără JavaScript) → contact (WhatsApp, email) → subsol.
- Scoase: testimonialele, „Beta deschis — locuri limitate”, problemele / soluția / cum funcționează / tipurile de ferme / secțiunea mare a magazinului / instalarea PWA (fișierele lor șterse), plus imaginile vechi nefolosite (`screenshot-*.jpg`, `*.svg` din `public/landing`).
- Totul pe tokenii canonici (merge zi și noapte), fără biblioteci noi; prima captură cu `priority`, restul `loading="lazy"`. `src/components/landing` e acum în `KIT_RULE_DIRS`. Antetul e simplu (sigla + „Intră”), subsolul (folosit și de Ajutor / Termeni / Confidențialitate) e refăcut pe tokeni.
- Întrebarea „Trebuie internet?” spune adevărul: nu există coadă offline (prototipul scria „se sincronizează singur”, n-am pus asta).

### 2. `/start` (`src/app/(onboarding)/start/`)
- „Cum vrei să începi?”: placa „Încearcă o fermă demo” sus, apoi „SAU”, „Îmi fac cont cu Google”, „Îmi fac cont cu email” (`/login?mode=register`), „Am deja cont · Intră”.
- Tipurile de demo: **doar Fructe de pădure și Solarii** (și în Setări › Mod demo). Am verificat `demo-seed-service.ts`: doar `berries` pune tratamente, magazie, stadii, analize, capcane și plan; livada și cultura mare (și Solarii) au doar parcele, culegători, recoltări, comenzi, vânzări, cheltuieli, investiții, lucrări vechi. Livada și cultura mare **nu sunt complete** (nici comenzile nu au produs, nici modulele refăcute nu au date). Ruta `/api/demo/seed` le acceptă încă (n-am atins-o).
- **Ecranul de așteptare (nou)**: pașii „Contul demo”, „Datele fermei”, „Parcele”, „Recoltări”, „Comenzi”, bifați pe rând, cu bară de progres. Primii doi se bifează când cererile se întorc; ultimii trei din numărătoarea reală (`parcele`, `recoltari`, `comenzi` ale fermei, prin RLS), repetată până trec pragurile seed-ului (6/15/12 la Fructe de pădure, 5/12/12 la Solarii), cu limită de 20 s (`asteaptaDemoGata`, `src/lib/demo/demo-gata.ts`, testată). La eroare sau la limită: mesaj clar și „Încearcă din nou” (continuă de unde a rămas; după o limită depășită pune datele din nou).
- Intrarea în Acasă se face cu `window.location.assign('/dashboard')`: pagină nouă, deci memoria aplicației (React Query, tenantul ținut minte) pornește goală. `/start` e în `KIT_RULE_DIRS`.

### 3. Login și paginile de parolă (`src/app/(auth)/`)
- Cadru comun cu `/start` (`src/components/auth/AuthFrame.tsx`; sigla Google în `GoogleMark.tsx`, în afara kitului, fiindcă are culorile ei).
- Login: Google, email și parolă, „Ai uitat parola?”, `Notice` „Ești operator? Intră din linkul primit pe WhatsApp.”, „Nu ai cont? Încearcă demo-ul” (`/start`). `?mode=register` = contul nou cu email (email + parolă, fără numele fermei: îl cere ecranul de după cont). Id-urile câmpurilor (`login-email`, `login-password`, `register-*`) și `data-testid="login-register-submit"` au rămas, pentru testele e2e vechi.
- `reset-password-request`, `reset-password`, `update-password`: același aspect; logica neschimbată (aceleași apeluri Supabase, aceleași reguli de lungime: 6 la pagina veche, 8 la cea nouă).
- Layout-ul `(auth)` nu mai forțează tema de zi. `src/app/(auth)` e în `KIT_RULE_DIRS`.

### 4. Ferma nouă: fără cultură implicită, prima parcelă decide
- **4a. Înscrierea**: vezi secțiunea 2 a raportului. După contul nou: `/start/ferma`, o singură întrebare — numele fermei (se salvează prin `PATCH /api/gdpr/farm`, în `tenants.nume_ferma`) și localitatea (în `tenants.localitate`, care există deja; fără migrare). Fără „Ce cultivi?”, fără parcelă / produs / cultură creată.
- **4b. „Primii pași”** (`src/components/acasa/PrimiiPasi.tsx`, logica în `src/lib/dashboard/primii-pasi.ts`, testată): în Acasă, doar pentru proprietarul unei ferme reale (nu demo, nu operator), în locul cardului vechi `WelcomeCard` (șters). Pașii: numele fermei (`/settings/ferma`), „Adaugă prima parcelă” (`/parcele?nou=1`, deschide formularul existent), „Adaugă culegătorii” (`/culegatori?nou=1`), „Pune prețul la <cultura>” (`/settings/pret-standard`; inactiv până la prima parcelă, apăsat spune „Întâi adaugă prima parcelă”; cu literă mică după parcelă: „Pune prețul la afine”). Se bifează din date (parcele, culegători, prețul standard). „Ascunde” = `localStorage` pe utilizator; „Arată ghidul din nou” din Setări › Cont îl golește.
- **4c. Etichetele și stocul din cultura parcelelor**: vezi secțiunea 4 a raportului (lista locurilor) și migrarea.

### 5. Ce ascundem cât e beta
- „Clienți magazin” și „Analytics magazin” ies din `Sidebar.tsx` (Mai mult nu le avea). Paginile și datele rămân.
- „Planul tău” (`/planuri`, pe kit): `StatHero` „Gratuit în beta” / „toate modulele, fără limită de date”, promisiunea cu luna de preaviz, „Exportă tot în Excel” (duce la Setări › Cont, unde e exportul existent pe module, în CSV care se deschide în Excel) și „Scrie-mi ce lipsește” (WhatsApp, `SUPPORT_WHATSAPP_URL`). Fără prețuri, fără plată. Rândul „Planul tău · Gratuit în beta” e acum și în Mai mult; meniul profilului spune „Planul tău”. `src/app/(dashboard)/planuri` în `KIT_RULE_DIRS`.

### 5b. Numele aplicației
- `src/lib/brand.ts`: `APP_NAME = 'Zmeurel OS'`, `APP_SHORT_NAME = 'Zmeurel'`. Textele noi (prima pagină, `/start`, Login, „Primii pași”, „Planul tău”) îl folosesc. N-am redenumit nimic.

## 2. Cum se creează tenantul la cont nou și ce am atins

- **Trigger în bază** (citit din producție): `on_auth_user_created` pe `auth.users` → `handle_auth_user_created()` face profilul și ferma (`tenants.nume_ferma` = `farm_name` din metadate, altfel „<full_name>'s Farm”, altfel „Ferma mea”) și pune `profiles.tenant_id`. Al doilea trigger (`handle_new_auth_user_profile`) face doar profilul. Niciunul nu creează parcele, produse sau culturi; nici aplicația nu o făcea.
- **Email**: `POST /api/auth/beta-signup` (`admin.createUser` + `ensureTenantForUser`, care găsește ferma făcută de trigger). Formularul nu mai trimite numele fermei (`farmName: ''`); după intrare merge pe `/start/ferma`.
- **Google**: `src/app/auth/callback/route.ts` → `ensureTenantForUser`. Am adăugat doar: dacă ferma e creată de cel mult 15 minute și n-are localitate (`esteFermaNoua`, `src/lib/auth/cont-nou.ts`, testată), redirecționarea e spre `/start/ferma` în loc de `/dashboard`. Invitațiile de operator nu trec pe aici (au ramura lor, neatinsă).
- `/start/ferma` (server): fără utilizator → `/login`; cont demo → `/dashboard`; fără fermă → `/start`; nu e proprietarul fermei (operator) → `/dashboard`.

## 3. De ce apăreau paginile goale în demo și cum am reparat

Ce am verificat:
- **Seed-ul nu continuă după răspuns**: `seedDemoDataForTenant` așteaptă toate inserările (inclusiv magazie, tratamente, stadii, analize, capcane, plan) înainte să răspundă.
- **React Query**: clientul e creat în layout-ul `(dashboard)`, deci intrarea din `/start` pornea oricum cu memoria goală. Dar odată citite, listele goale rămân 60 s fără reîncărcare la montare (`refetchOnMount` doar pentru interogările invalidate).

Cauza găsită: **reîncărcarea paginii de către service worker la prima vizită**. `next.config` are `skipWaiting` + `clientsClaim`, iar `ServiceWorkerRegister` făcea `window.location.reload()` la orice `controllerchange`. La prima vizită (cazul tipic al unui demo: om nou) service workerul preia pagina după ce termină instalarea (precache-ul durează câteva secunde) și pagina se reîncarcă singură. Dacă asta cădea în timp ce `/start` aștepta seed-ul: sesiunea demo exista deja, `/start` reîncărcată trimitea direct în `/dashboard` (efectul „utilizator deja intrat”), seed-ul încă rula pe server, iar paginile citeau liste goale și le țineau minte. Am văzut reîncărcarea cu ochii mei în testul Playwright (al doilea `navigate` după ce ajunsese pe `/dashboard`, „Execution context was destroyed”). În plus, codul vechi intra în `/dashboard` și când seed-ul dădea eroare (`pendingAction` revenea la `null` cu sesiunea deja pusă).

Reparat:
1. `ServiceWorkerRegister`: reîncarcă doar la o versiune nouă (exista deja un controller), nu la prima preluare.
2. `/start` intră în Acasă doar după verificarea reală „demo gata” (numărătoarea din bază), cu limită de timp și „Încearcă din nou”; la eroare rămâne pe ecranul de așteptare.
3. Intrarea e cu pagină nouă (`window.location.assign`), după `resetTenantIdCache()`: nicio memorie veche.
4. Dacă pagina se reîncarcă totuși în mijlocul pregătirii, `/start` reia așteptarea (tipul demo-ului ținut în `sessionStorage`, `zmeurel_demo_in_lucru`), nu intră pe pagini goale.

## 4. Locurile cu „zmeură” scrisă fix și ce am făcut

| Loc | Ce era | Ce am făcut |
|---|---|---|
| `src/app/(dashboard)/dashboard/page.tsx` | `produs: 'Zmeură cal. I'` | eticheta din culturile parcelelor (`etichetaStocFerma`) |
| `src/components/acasa/AcasaMobile.tsx` | „Sezon · zmeură”, „În stoc, calitatea 1” | „Sezon · <culturile fermei>” (sau doar „Sezon”); stocul cu eticheta culturii; fără parcele „Adaugă întâi o parcelă” → `/parcele?nou=1` |
| `src/app/(dashboard)/stocuri/StocuriPageClient.tsx` | „Zmeură cal. I disponibilă” | eticheta culturii; fără parcele „Adaugă întâi o parcelă”; mai multe culturi = o filă pe cultură (`Segments`), cu descompunerea, Cal. II și ajustările culturii (cu migrarea) |
| `src/components/stocuri/AjustareStocForm.tsx` | „Zmeură cal. I disponibilă acum” | eticheta primită; trimite cultura ajustării pe stocul pe cultură |
| `src/lib/stocuri/stoc.ts` | „Nu ai zmeură cal. I disponibilă” | „Nu ai nimic disponibil la cal. I”; `cal2InSezon` primește cultura |
| `src/lib/stoc-pe-produs.ts`, `esteZmeura` în `stoc.ts` | „numărăm doar zmeura” | **rămase**: sunt oglinda testată a regulii din `get_sellable_cal1_stock_summary` (sumarul de azi, folosit la o singură cultură și la Acasă / Comenzi) |
| `src/lib/supabase/queries/comenzi.ts` | `resolveZmeuraProdusId` (`ilike 'zmeur%'`) | `resolveProdusComanda`: produsul culturii comenzii (aleasă în formular, altfel cultura principală din parcele), asigurat de `asiguraProdusCultura` |
| `src/app/(dashboard)/comenzi/ComenziPageClient.tsx` | „În stoc, calitatea 1” | eticheta culturii / „Adaugă întâi o parcelă” |
| `src/components/comenzi/ComandaStepForm.tsx` + `ComandaDetaliiStep.tsx` | — | „Ce cultură?” doar când ferma are mai multe culturi |
| `src/components/parcele/ParcelaStepForm.tsx` | — | la salvarea unei parcele se asigură produsul „<Cultură> proaspătă/proaspete” |
| Funcțiile din bază (citite din producție) | `get_sellable_cal1_stock_summary` (zmeura dacă există), `resolve_zmeura_produs_id` (promovarea comenzilor din magazin) | sumarul: în migrare (vezi mai jos); `resolve_zmeura_produs_id` **neatins** (magazinul public e al zmeurei lui Andrei) |
| `src/components/ai/AiBottomSheet.tsx` | „5 kg zmeură azi”, „butași zmeur” | „5 kg azi”, „butași” |
| `src/app/(dashboard)/produse/ProdusePageClient.tsx`, `ProdusForm.tsx` | „zmeură, mure, gem”, „ex. Zmeură proaspătă” | „fructe, legume, gem”, „ex. Gem de casă” |
| `src/lib/clienti/import.ts` | anunțul WhatsApp „livrările de zmeură proaspătă” | „Am început livrările.” |
| Tratamente (`TratamentStepForm.tsx` `esteZmeura`, `AlegeProdus.tsx` „pentru zmeur”), Plan (`src/lib/plan/model.ts`: `numePlanPropus` implicit „Zmeură”, `culturaPlan` necunoscut = `zmeur`) | | **neatinse** (promptul 30). Verificările de zmeură din Tratamente se aplică deja doar parcelelor de zmeură. În Plan, o cultură necunoscută cade pe zmeură: de reparat în promptul care atinge Planul |
| Chatul AI (`chat-post-handler.ts`, `extractors.ts`) | exemple de zmeură în promptul sistemului | neatinse (nu se văd în aplicație) |
| Rămase cu sens | demo „Fructe de pădure” („zmeură, mure, afine”), povestea lui Andrei, opțiunile de cultură din formularul de parcelă, magazinul public al lui Andrei | rămân |

Regula nouă e într-o singură funcție pură, testată: `culturileFermei` (`src/lib/parcele/culturi-ferma.ts`) — culturile distincte din parcelele active, normalizate („Zmeure Delniwa” = „Zmeură” = `zmeur`, „Meri” = mere), cu acordul („Zmeură … disponibilă”, „Afine … disponibile”, „Ardei … disponibili”). Stocul pe cultură e `stocPeCultura` (`src/lib/stocuri/pe-cultura.ts`), ecranele îl iau prin `useStocFerma`.

Ferma lui Andrei (verificat cu select pe 23.11): parcele de zmeură (plus două fără cultură, care nu contează), produsele „Zmeură proaspătă”, „Mure”, „Mere”, comenzile cu „Zmeură proaspătă” sau fără produs. O singură cultură → aceeași cifră ca azi (sumarul), eticheta „Zmeură cal. I disponibilă”, comenzile noi primesc tot „Zmeură proaspătă”.

## 5. Migrarea (NEAPLICATĂ)

O singură migrare, doar aditivă la date: `supabase/migrations/20261124100000_stoc_pe_cultura.sql`. Ordinea: după toate cele din main (cere `cultura_recoltare_stoc` din `20261121150000`, aplicată în producție — verificat). Fără ea, aplicația merge ca înainte (o cifră din sumarul de azi, cu eticheta din cultura parcelelor); cu ea, Stocuri arată o filă pe cultură la fermele cu mai multe culturi. Nicio funcție din producție nu cheamă `create_ajustare_stoc` (verificat), deci schimbarea semnăturii nu rupe nimic din bază.

SQL complet:

```sql
-- Stocul cal. 1 pe cultură (promptul 31): „cultura vine din parcele”.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Doar aditivă. Cere migrarea 20261121150000 (`cultura_recoltare_stoc`,
-- aplicată în producție: verificat pe 23.11.2026 cu select în `pg_proc`).
--
-- De ce: o fermă cu mai multe culturi (demo „Fructe de pădure”: zmeură + mure + afine) vedea un singur stoc,
-- al zmeurei. Acum aplicația arată stocul pe fiecare cultură (o filă pe cultură în Stocuri), iar comanda scade din
-- cultura ei (prin `comenzi.produs_id`, care există deja: produsul „<Cultură> proaspătă/proaspete”).
--
-- Ce face:
--   1. `ajustari_stoc.cultura` (text, null): cultura ajustării (cheia normalizată din aplicație: „zmeur”, „afin”…).
--      Rândurile vechi rămân `null` și aplicația le dă culturii principale (zmeura dacă ferma are zmeură).
--   2. `stoc_cal1_pe_cultura(p_tenant_id)`: rândurile din care aplicația socotește stocul pe cultură
--      (`src/lib/stocuri/pe-cultura.ts`, cu teste): recoltările pe cultura lor (`cultura_recoltare_stoc`),
--      comenzile livrate / în livrare pe numele produsului lor, comenzile magazinului nepromovate (fără cultură)
--      și ajustările pe cultura lor. Aceleași surse și aceleași filtre ca `get_sellable_cal1_stock_summary`.
--      Normalizarea („Zmeure Delniwa” = „Zmeură”) se face în aplicație, într-o singură funcție testată.
--   3. `create_ajustare_stoc` primește `p_cultura text default null` și o scrie în rând. Garda de stoc rămâne cea
--      de azi (`get_sellable_cal1_stock_summary`) pentru o ajustare fără cultură, de zmeură sau într-o fermă fără
--      zmeură; o ajustare pe altă cultură într-o fermă cu zmeură se verifică în formular, pe cultura ei.
--   4. `get_sellable_cal1_stock_summary`: când ferma are zmeură, comenzile cu produsul altei culturi și ajustările
--      altei culturi nu mai scad din stocul zmeurei. Ferma lui Andrei: același rezultat (verificat cu select pe
--      23.11.2026: comenzile au produsul „Zmeură proaspătă” sau niciunul; ajustările nu au cultură).
--
-- Fără migrare: aplicația merge ca azi (o singură cifră, din `get_sellable_cal1_stock_summary`), cu eticheta luată
-- din cultura parcelelor. O fermă cu o singură cultură (ferma lui Andrei) folosește oricum sumarul de azi.
--
-- Anulare:
--   drop function if exists public.stoc_cal1_pe_cultura(uuid);
--   drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid, text);
--   -- și se rulează din nou definiția de azi a `create_ajustare_stoc` (5 parametri, din 20261121190000);
--   -- și definiția `get_sellable_cal1_stock_summary` din 20261121150000;
--   alter table public.ajustari_stoc drop column if exists cultura;

-- 1. Cultura ajustării ---------------------------------------------------------------------------------------------

alter table public.ajustari_stoc add column if not exists cultura text;

comment on column public.ajustari_stoc.cultura is
  'Cultura ajustării (cheia normalizată din aplicație, ex. zmeur, afin). Null = rând vechi: cultura principală a fermei.';

-- 2. Rândurile stocului pe cultură -----------------------------------------------------------------------------------

create or replace function public.stoc_cal1_pe_cultura(p_tenant_id uuid default null::uuid)
returns table(sursa text, cultura text, kg numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_current_tenant_id uuid;
  v_tenant_id uuid;
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

  return query
  -- Recoltat cal. 1, pe cultura recoltării (alegerea din recoltare, apoi cultura parcelei).
  select 'recoltat'::text,
         rc.cultura,
         round(coalesce(sum(rc.kg_cal1), 0)::numeric, 2)
  from (
    select r.kg_cal1, public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) as cultura
    from public.recoltari r
    where r.tenant_id = v_tenant_id
  ) rc
  group by rc.cultura

  union all
  -- Comenzile livrate și cele în livrare, pe numele produsului (null = comandă fără produs).
  select case when c.status = 'livrata' then 'livrat' else 'in_livrare' end,
         p.nume,
         round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  from public.comenzi c
  left join public.produse p on p.id = c.produs_id and p.tenant_id = v_tenant_id
  where c.tenant_id = v_tenant_id
    and c.status in ('livrata', 'in_livrare')
  group by 1, p.nume

  union all
  -- Comenzile magazinului încă nepromovate în `comenzi` (fără cultură: merg la cultura principală).
  select case when s.status = 'livrata' then 'livrat' else 'in_livrare' end,
         null::text,
         round(coalesce(sum(public.resolve_shop_order_total_kg_loose(s.items)), 0)::numeric, 2)
  from public.shop_orders s
  where s.tenant_id = v_tenant_id
    and s.status in ('livrata', 'in_livrare')
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = s.id
    )
  group by 1

  union all
  -- Ajustările, pe cultura lor (null = rând vechi).
  select 'ajustare'::text,
         a.cultura,
         round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id
  group by a.cultura;
end;
$function$;

revoke execute on function public.stoc_cal1_pe_cultura(uuid) from public, anon;
grant execute on function public.stoc_cal1_pe_cultura(uuid) to authenticated, service_role;

-- 3. Ajustarea cu cultura ---------------------------------------------------------------------------------------------
-- Corpul din producție pe 23.11.2026 (`pg_get_functiondef`), cu o singură schimbare: parametrul `p_cultura`, scris
-- în rând. Semnătura veche se șterge, ca PostgREST să nu aibă două funcții cu același nume: apelurile fără
-- `p_cultura` merg mai departe (parametrul are valoare implicită).

drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid);

create or replace function public.create_ajustare_stoc(
  p_tip text,
  p_delta_kg numeric,
  p_motiv text default null::text,
  p_data date default null::date,
  p_client_sync_id uuid default null::uuid,
  p_cultura text default null::text
)
returns ajustari_stoc
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_delta numeric := round(coalesce(p_delta_kg, 0)::numeric, 2);
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
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

  if p_tip is null or p_tip not in ('congelat', 'procesat', 'pierdere', 'consum_propriu', 'corectie_plus', 'corectie_minus', 'altul') then
    raise exception 'Tip ajustare invalid.';
  end if;

  if v_delta = 0 then
    raise exception 'Cantitatea ajustării trebuie să fie diferită de 0.';
  end if;

  if p_tip = 'corectie_plus' and v_delta <= 0 then
    raise exception 'Ajustarea de tip corectie_plus trebuie să aibă cantitate pozitivă.';
  end if;

  if p_tip <> 'corectie_plus' and v_delta >= 0 then
    raise exception 'Ajustarea de tip % este o scădere: cantitatea trebuie să fie negativă.', p_tip;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  if p_client_sync_id is not null then
    select *
    into v_row
    from public.ajustari_stoc
    where tenant_id = v_tenant_id
      and client_sync_id = p_client_sync_id;

    if found then
      return v_row;
    end if;
  end if;

  -- Garda pe sumarul de azi, când el e stocul culturii ajustate: ajustare fără cultură, ajustare de zmeură, sau o
  -- fermă fără zmeură (sumarul numără atunci toate culturile). O ajustare pe altă cultură, într-o fermă cu zmeură,
  -- nu se compară cu stocul zmeurei: formularul o verifică pe cultura ei.
  if v_delta < 0
     and (
       p_cultura is null
       or btrim(p_cultura) = ''
       or translate(lower(btrim(p_cultura)), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
       or not exists (
         select 1
         from public.recoltari r
         where r.tenant_id = v_tenant_id
           and public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) like 'zmeur%'
       )
     ) then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', abs(v_delta), v_available),
          errcode = 'P0001';
    end if;
  end if;

  insert into public.ajustari_stoc (
    tenant_id,
    data,
    delta_kg,
    tip,
    motiv,
    created_by,
    client_sync_id,
    cultura
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    v_delta,
    p_tip,
    nullif(btrim(coalesce(p_motiv, '')), ''),
    v_user_id,
    p_client_sync_id,
    nullif(btrim(coalesce(p_cultura, '')), '')
  )
  returning *
  into v_row;

  return v_row;
end;
$function$;

revoke execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid, text) from public, anon;
grant execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid, text) to authenticated, service_role;

-- 4. Sumarul de azi, aliniat cu stocul pe cultură ---------------------------------------------------------------------
-- Corpul din producție pe 23.11.2026 (cel din 20261121150000; verificat cu `pg_get_functiondef`), cu o singură
-- schimbare: când ferma are zmeură (deci sumarul e stocul zmeurei), comenzile și ajustările altor culturi nu mai
-- scad din el. O comandă fără produs sau cu un produs de zmeură, o ajustare fără cultură sau de zmeură, și comenzile
-- magazinului se numără ca până acum. Ferma lui Andrei (o cultură, comenzile fără produs sau cu „Zmeură proaspătă”,
-- ajustările fără cultură) are exact același rezultat. O fermă fără zmeură numără tot, ca până acum.
-- Semnătura, coloanele întoarse și drepturile rămân aceleași.

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

  -- Comenzile: la o fermă cu zmeură, doar cele fără produs sau cu un produs de zmeură.
  select
    round(coalesce(sum(c.cantitate_kg) filter (where c.status = 'livrata'), 0)::numeric, 2),
    round(coalesce(sum(c.cantitate_kg) filter (where c.status = 'in_livrare'), 0)::numeric, 2)
  into v_livrat_comenzi, v_in_livrare_comenzi
  from public.comenzi c
  left join public.produse p on p.id = c.produs_id and p.tenant_id = v_tenant_id
  where c.tenant_id = v_tenant_id
    and c.status in ('livrata', 'in_livrare')
    and (
      not v_are_zmeura
      or p.id is null
      or translate(lower(btrim(coalesce(p.nume, ''))), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
    );

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

  -- Ajustările: la o fermă cu zmeură, doar cele fără cultură sau de zmeură.
  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id
    and (
      not v_are_zmeura
      or a.cultura is null
      or translate(lower(btrim(a.cultura)), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
    );

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

## 6. Capturile din `public/landing/`

Făcute cu `scripts/landing-capturi.mjs` (Playwright, demo nou „Fructe de pădure” creat din `/start`, 390 × 780 px, 2×, zi, service workerul blocat), convertite în `.webp` cu `sharp` (deja în proiect):
`captura-acasa.webp`, `captura-recoltari.webp`, `captura-comenzi.webp`, `captura-tratamente.webp`, `captura-stocuri.webp`, `captura-parcele.webp`. Doar date demo (nume inventate), nimic personal. Bannerul „Ești în modul demo” se vede sus (e aplicația reală). La Recoltări ziua de azi e goală („Nimic notat azi”), fiindcă seed-ul pune recoltări în zilele trecute.

## 7. Ce n-am putut testa

- **Ferma reală nouă** (email, Google, `/start/ferma`, „Primii pași”, prima parcelă care creează produsul, „Pune prețul la …”): fără cont real, nu l-am creat. Acoperite prin teste unitare (`cont-nou`, `primii-pasi`, `produse-cultura`, `culturi-ferma`) și prin randarea cardului cu o fermă fără parcele (`PrimiiPasiCard.test.tsx`).
- **Stocul pe cultură cu migrarea aplicată** (filele din Stocuri, ajustarea pe cultură, comanda care scade din cultura ei pe server): migrarea nu e aplicată, deci în demo Stocuri arată o singură cifră. Logica de grupare e testată (`pe-cultura.test.ts`); ecranul în modul „pe cultură” nu l-am văzut în browser.
- **Alegerea culturii în formularul de comandă**: apare doar la mai multe culturi; demo-ul Fructe de pădure are 4 culturi (Zmeură, Afine, Mix fructe, Mure), dar n-am deschis formularul de mână. Smoke-ul (comandă → livrare → stocul scade) trece cu cultura implicită (zmeura).
- **Reîncărcarea service workerului în mijlocul demo-ului** n-am reprodus-o cu panoul de browser (acolo service workerul era deja instalat); am văzut-o în Playwright cu context nou. Reparația (reîncărcare doar la versiune nouă + reluarea așteptării) e verificată doar prin lint / typecheck / build și prin drumul normal.
- Testele e2e vechi din afara smoke-ului (`e2e/onboarding-flows.spec.ts`, `e2e/demo-to-real-conversion.spec.ts`) caută încă „Continuă fără cont”, placa „Fructe de pădure” ca buton, titlul „Intră în aplicație” și câmpul `#register-farm`: nu le-am rescris (nu rulează în CI). Butonul „Autentifica-te” l-am schimbat în „Intră” în toate.

## 8. Testat în browser (390 px)

- Prima pagină, zi și noapte: fără derulare orizontală, fără textele scoase; capturile se încarcă.
- `/start` → Fructe de pădure → ecranul de așteptare (pașii bifați pe rând) → Acasă cu date („Sezon · zmeură, afine, mix fructe …”, „Zmeură cal. I disponibilă”).
- Demo Solarii nou: nicio „zmeur” în Acasă, Stocuri, Comenzi, Recoltări, Parcele, Tratamente, Produse, Mai mult; stocul „Cal. I disponibil, toate culturile” (fără migrare, sumarul numără toate culturile).
- Login (intrare și cont nou), „Ai uitat parola?”, „Parolă nouă”, zi și noapte. Mai mult fără intrările de magazin; „Planul tău”.

## 9. Verificările

Pe codul final (commit `cf751bc`), rulate în ordine:

| Comanda | Rezultat |
|---|---|
| `npm run lint` | trece: 0 erori, 4 avertizări vechi (`src/app/api/chat/chat-post-handler.ts`, `src/app/livrator/livrari/LivratorLivrariClient.tsx`, neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece: 345 fișiere, fără abateri (cu folderele noi: landing, `/start`, `(auth)`, `planuri`) |
| `npm run test:critical:unit` | trece: 134 fișiere, 1149 teste. Noi: `culturi-ferma`, `pe-cultura`, `stoc` (Cal. II pe cultură), `demo-gata`, `cont-nou`, `primii-pasi`, `produse-cultura`, `PrimiiPasiCard`. (La o rulare intermediară, `ComenziDinMesajSheet` a dat o dată timeout de 5 s sub încărcare; singur și la rularea finală trece.) |
| `npm run build` | trece |
| `npm run test:e2e:smoke` (pe build, `next start`) | 12 din 12 trec, cu demo nou din `/start` (inclusiv pașii noi 11 și 12). După reparația paginilor goale am rulat din nou drumul prin `/start` (`beforeAll`) + pașii 11 și 12: trec. |

## 10. Commit-urile

- `fea5ab3` feat(culturi): culturile fermei din parcele (normalizare, acord, eticheta stocului, stocul pe cultură) + APP_NAME într-un singur loc
- `abcc01c` feat(landing): prima pagină nouă — „Ferma ta, pe telefon. Fără hârtii.”, capturi, 6 plăci, povestea, beta, întrebări, contact; fără testimoniale și „locuri limitate”; pe tokenii canonici
- `f5d1c51` feat(start): /start pe kit — demo întâi (Fructe de pădure, Solarii), cont nou a doua opțiune; ecranul de așteptare cu pașii bifați și verificarea reală „demo gata” (limită de timp, „Încearcă din nou”), intrare cu pagină nouă
- `5035e65` feat(auth): Login și paginile de parolă pe aspectul din /start — nota pentru operatori, „Încearcă demo-ul”; contul nou cu email fără numele fermei (îl cere ecranul de după cont); folderele noi în KIT_RULE_DIRS
- `e8973d1` feat(planuri): „Planul tău” — Gratuit în beta, fără prețuri; „Clienți magazin” și „Analytics magazin” ies din meniu (paginile rămân)
- `d4edf60` feat(start): după contul nou o singură întrebare — numele fermei și localitatea (/start/ferma); fără „Ce cultivi?”, fără parcelă, produs sau cultură implicită; Google nou ajunge tot acolo
- `ab5d50e` feat(stocuri): stocul din cultura parcelelor — „Adaugă întâi o parcelă” fără parcele, eticheta culturii („Afine cal. I disponibile”), o filă pe cultură la mai multe culturi; migrarea 20261124100000 (neaplicată): ajustari_stoc.cultura, stoc_cal1_pe_cultura, create_ajustare_stoc cu p_cultura, sumarul fără alte culturi la ferma cu zmeură
- `65b2d5c` feat(comenzi): produsul comenzii din cultura ei — „<Cultură> proaspătă” asigurat la prima parcelă (cel existent rămâne), comanda întreabă cultura doar la mai multe culturi; stocul din Comenzi cu eticheta culturii
- `076f205` feat(acasa): „Primii pași” pentru ferma reală (nume, prima parcelă, culegători, prețul la cultura ei), în locul cardului vechi; stocul și „Sezon · …” din culturile parcelelor; /parcele?nou=1 și /culegatori?nou=1
- `6004878` chore: fără „zmeură” fix în exemple și mesaje (chatul AI, Produse, anunțul WhatsApp); CLAUDE.md — cultura din parcele, Primii pași, ecranul de așteptare din demo
- `14ef56c` feat(landing): capturile reale din demo (Acasă, Recoltări, Comenzi, Tratamente, Stocuri, Parcele, 390 px) + scriptul care le reface; smoke — drumul nou prin /start cu ecranul de așteptare, prima pagină, Login, Mai mult, Planul tău
- `d3cb1a7` test(acasa): „Primii pași” randat pentru o fermă reală fără parcele (fără cultură scrisă, prețul cere parcela, „Ascunde”); prima pagină — capturile nu mai sar peste marginea de 16 px
- `cf751bc` fix(demo): paginile goale după pornirea demo-ului — service workerul nu mai reîncarcă pagina la prima preluare (doar la o versiune nouă); /start reia așteptarea dacă pagina se reîncarcă în timpul pregătirii, iar la limita de timp „Încearcă din nou” pune datele din nou
- (raportul: commitul care adaugă acest fișier)

## 11. `git diff origin/main --stat`

Înainte de commitul raportului:

```
CLAUDE.md                                          |   8 +-
 e2e/admin-access.spec.ts                           |   2 +-
 e2e/asociatie/produse-extended.spec.ts             |   2 +-
 e2e/asociatie/produse.spec.ts                      |   2 +-
 e2e/demo-to-real-conversion.spec.ts                |   2 +-
 e2e/onboarding-flows.spec.ts                       |   2 +-
 e2e/smoke/demo.ts                                  |   9 +-
 e2e/smoke/pasi-principali.spec.ts                  |  41 +-
 public/landing/captura-acasa.webp                  | Bin 0 -> 62676 bytes
 public/landing/captura-comenzi.webp                | Bin 0 -> 53198 bytes
 public/landing/captura-parcele.webp                | Bin 0 -> 56800 bytes
 public/landing/captura-recoltari.webp              | Bin 0 -> 34716 bytes
 public/landing/captura-stocuri.webp                | Bin 0 -> 45702 bytes
 public/landing/captura-tratamente.webp             | Bin 0 -> 58014 bytes
 public/landing/farmer-hero.svg                     |  30 --
 public/landing/mobile-mockup.svg                   |  21 -
 public/landing/screenshot-dashboard.jpg            | Bin 195490 -> 0 bytes
 public/landing/screenshot-recoltari.jpg            | Bin 216159 -> 0 bytes
 public/landing/screenshot-solar-detail.jpg         | Bin 300411 -> 0 bytes
 public/landing/story-farm.svg                      |  29 --
 scripts/kit-rules.mjs                              |   6 +
 scripts/landing-capturi.mjs                        |  63 +++
 src/app/(auth)/layout.tsx                          |   6 +-
 src/app/(auth)/login/LoginPageClient.tsx           | 555 +++++----------------
 src/app/(auth)/reset-password-request/page.tsx     |  92 ++--
 src/app/(auth)/reset-password/page.tsx             | 148 +++---
 src/app/(auth)/update-password/page.tsx            | 101 ++--
 src/app/(dashboard)/comenzi/ComenziPageClient.tsx  |  14 +-
 .../(dashboard)/culegatori/CulegatorPageClient.tsx |  13 +-
 src/app/(dashboard)/dashboard/page.tsx             |  39 +-
 src/app/(dashboard)/mai-mult/MaiMultPageClient.tsx |   1 +
 src/app/(dashboard)/parcele/ParceleListClient.tsx  |   8 +-
 src/app/(dashboard)/planuri/page.tsx               |  40 +-
 src/app/(dashboard)/produse/ProdusePageClient.tsx  |   2 +-
 .../(dashboard)/settings/cont/ContPageClient.tsx   |  11 +-
 src/app/(dashboard)/settings/demo/page.tsx         |   8 +-
 src/app/(dashboard)/stocuri/StocuriPageClient.tsx  |  95 +++-
 src/app/(onboarding)/start/StartPageClient.tsx     | 347 +++++++++++++
 .../(onboarding)/start/ferma/FermaNouaClient.tsx   |  91 ++++
 src/app/(onboarding)/start/ferma/page.tsx          |  29 ++
 src/app/(onboarding)/start/page.tsx                | 495 +-----------------
 src/app/auth/callback/route.ts                     |  13 +
 src/app/page.tsx                                   |  86 ++--
 src/components/acasa/AcasaMobile.tsx               |  32 +-
 src/components/acasa/PrimiiPasi.tsx                | 145 ++++++
 .../acasa/__tests__/PrimiiPasiCard.test.tsx        |  39 ++
 src/components/ai/AiBottomSheet.tsx                |   4 +-
 src/components/app/ServiceWorkerRegister.tsx       |   8 +
 src/components/app/UserProfileMenu.tsx             |   2 +-
 src/components/auth/AuthFrame.tsx                  |  68 +++
 src/components/auth/GoogleMark.tsx                 |  16 +
 src/components/comenzi/ComandaDetaliiStep.tsx      |  24 +
 src/components/comenzi/ComandaStepForm.tsx         |  16 +-
 src/components/dashboard/WelcomeCard.tsx           |  53 --
 src/components/landing/FarmPill.tsx                |  13 -
 src/components/landing/FarmSection.tsx             |  40 --
 src/components/landing/association-marketplace.tsx |  61 ---
 src/components/landing/beta.tsx                    |  18 +
 src/components/landing/capturi-date.ts             |  23 +
 src/components/landing/capturi.tsx                 |  38 ++
 src/components/landing/ce-tii.tsx                  |  36 ++
 src/components/landing/contact.tsx                 |  30 ++
 src/components/landing/demo-cta.tsx                |  41 --
 src/components/landing/faq.tsx                     |  69 ++-
 src/components/landing/farm-types.tsx              |  37 --
 src/components/landing/hero.tsx                    |  91 ++--
 src/components/landing/how-it-works.tsx            |  39 --
 src/components/landing/landing-footer.tsx          |  71 +--
 src/components/landing/landing-header.tsx          | 117 +----
 src/components/landing/landing-shared.tsx          |  69 +--
 src/components/landing/problems.tsx                |  50 --
 src/components/landing/pwa-install.tsx             |  38 --
 src/components/landing/solution.tsx                |  45 --
 src/components/landing/story.tsx                   | 110 ++--
 src/components/landing/testimonials.tsx            |  36 --
 src/components/landing/value-props.tsx             |  39 --
 src/components/layout/Sidebar.tsx                  |   2 -
 src/components/parcele/ParcelaStepForm.tsx         |   5 +
 src/components/produse/ProdusForm.tsx              |   2 +-
 src/components/stocuri/AjustareStocForm.tsx        |  10 +-
 src/lib/auth/__tests__/cont-nou.test.ts            |  27 +
 src/lib/auth/cont-nou.ts                           |  36 ++
 src/lib/brand.ts                                   |   8 +
 src/lib/clienti/import.ts                          |   3 +-
 src/lib/dashboard/__tests__/primii-pasi.test.ts    |  39 ++
 src/lib/dashboard/primii-pasi.ts                   |  96 ++++
 src/lib/demo/__tests__/demo-gata.test.ts           |  99 ++++
 src/lib/demo/demo-gata.ts                          | 101 ++++
 src/lib/parcele/__tests__/culturi-ferma.test.ts    | 120 +++++
 src/lib/parcele/culturi-ferma.ts                   | 254 ++++++++++
 src/lib/query-keys.ts                              |   3 +
 src/lib/stocuri/__tests__/pe-cultura.test.ts       |  66 +++
 src/lib/stocuri/__tests__/stoc.test.ts             |  17 +
 src/lib/stocuri/pe-cultura.ts                      |  98 ++++
 src/lib/stocuri/stoc.ts                            |  21 +-
 src/lib/stocuri/useStocFerma.ts                    |  52 ++
 .../queries/__tests__/produse-cultura.test.ts      |  37 ++
 src/lib/supabase/queries/ajustari-stoc.ts          |  29 ++
 src/lib/supabase/queries/comenzi.ts                |  35 +-
 src/lib/supabase/queries/produse-cultura.ts        |  77 +++
 src/lib/supabase/queries/stoc-pe-cultura.ts        |  37 ++
 .../migrations/20261124100000_stoc_pe_cultura.sql  | 398 +++++++++++++++
 vitest.critical.config.ts                          |   5 +
 103 files changed, 3352 insertions(+), 2254 deletions(-)
```

`public/sw.js` nu apare în diff (modificarea lui locală nu e comisă).
