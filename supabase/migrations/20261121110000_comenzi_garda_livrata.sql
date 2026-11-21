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
