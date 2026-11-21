-- Cheia de idempotență (`client_sync_id`) pentru ajustările de stoc.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări.
--
-- De ce: „Ajustează stocul” se ferea de dublură doar în memoria formularului. Dacă răspunsul se pierdea pe
-- drum (rețea slabă) și omul apăsa din nou „Salvează” după o reîncărcare, ajustarea se scria a doua oară.
-- Cu cheia: a doua cerere cu aceeași cheie primește rândul deja scris, fără altă ajustare.
--
-- Ce face:
--   1. `ajustari_stoc.client_sync_id uuid null` (rândurile existente rămân `null`, fără update);
--   2. index unic PARȚIAL pe `(tenant_id, client_sync_id) where client_sync_id is not null`
--      (aceeași formă ca la comenzi / clienți / culegători / investiții, migrarea 20261121140000);
--   3. `create_ajustare_stoc` primește `p_client_sync_id uuid default null`. Corpul e cel din producție
--      (citit cu `pg_get_functiondef` pe 21.11.2026), cu două adaosuri: căutarea după cheie, imediat după
--      lacătul de stoc, și coloana nouă la inserare. Verificările rămân: sesiune, tenant, drepturi
--      (proprietar sau operator cu scriere pe `comenzi`), tipul, semnul, „nu sub 0”.
--      Funcția nu scrie în `miscari_stoc` (nici înainte, nici acum): disponibilul e derivat din
--      `ajustari_stoc`, deci „o singură ajustare” înseamnă un singur rând aici.
--
-- Semnătura se schimbă (4 → 5 parametri), deci varianta veche se șterge aici, ca să nu rămână două
-- overload-uri (PostgREST n-ar ști pe care s-o aleagă). Aplicația veche, care trimite 4 parametri cu nume,
-- merge mai departe pe varianta nouă: al cincilea are valoare implicită.
--
-- Aditivă pentru date: o coloană nulă și un index. Se poate rula de două ori.
--
-- Anulare:
--   drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid);
--   (se recreează varianta cu 4 parametri din 20260711100000_unified_order_stock_phase2.sql, cu grant-urile ei)
--   drop index if exists public.ajustari_stoc_tenant_client_sync_id_uq;
--   (coloana poate rămâne.)

alter table public.ajustari_stoc add column if not exists client_sync_id uuid null;

create unique index if not exists ajustari_stoc_tenant_client_sync_id_uq
  on public.ajustari_stoc (tenant_id, client_sync_id)
  where client_sync_id is not null;

comment on column public.ajustari_stoc.client_sync_id is
  'Cheia de idempotență a formularului (aceeași la reîncercare). create_ajustare_stoc întoarce rândul existent pentru o cheie deja scrisă.';

drop function if exists public.create_ajustare_stoc(text, numeric, text, date);

create or replace function public.create_ajustare_stoc(
  p_tip text,
  p_delta_kg numeric,
  p_motiv text default null,
  p_data date default null,
  p_client_sync_id uuid default null
)
returns public.ajustari_stoc
language plpgsql
security definer
set search_path = public
as $$
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

  -- Reîncercarea aceleiași salvări: ajustarea există deja, o întoarcem pe ea. Căutarea e după lacăt (două
  -- cereri simultane cu aceeași cheie se așază la rând) și înainte de „nu sub 0” (prima a scăzut deja stocul).
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

  if v_delta < 0 then
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
    client_sync_id
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    v_delta,
    p_tip,
    nullif(btrim(coalesce(p_motiv, '')), ''),
    v_user_id,
    p_client_sync_id
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_ajustare_stoc(text, numeric, text, date, uuid) from public;
revoke all on function public.create_ajustare_stoc(text, numeric, text, date, uuid) from anon;
grant execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
