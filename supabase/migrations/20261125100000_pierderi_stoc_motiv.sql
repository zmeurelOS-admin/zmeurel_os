-- Pierderile din stoc cu motiv (promptul 33).
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Doar aditivă: o coloană nouă cu valoare implicită (Postgres o pune
-- pe rândurile vechi fără să le rescrie; niciun `update`), o constrângere nouă și o funcție nouă. Fără `drop`.
-- Cere migrarea 20261124100000 (`ajustari_stoc.cultura`, aplicată în producție: verificat pe 24.11.2026).
--
-- Ce face:
--   1. `ajustari_stoc.categorie_pierdere`: motivul unei pierderi — `stricat`, `consum_propriu`, `donat`, `altul`.
--      Rândurile vechi (și ajustările care nu sunt pierderi) primesc `nespecificat`.
--   2. `create_pierdere_stoc(...)`: scrie o pierdere (o scădere din stocul culturii). Aceleași drepturi ca
--      `create_ajustare_stoc`: proprietarul sau operatorul cu „Scrie” pe Comenzi. Aceeași gardă de stoc, dar o
--      pierdere care duce stocul sub zero trece dacă omul a confirmat (`p_sub_zero_confirmat`). Ferma vine din
--      sesiune (`current_tenant_id()`), nu din parametri. Deduplică pe cheia formularului (`client_sync_id`).
--      `consum_propriu` se scrie cu tipul `consum_propriu`; celelalte cu tipul `pierdere`. Nu e venit, nu e cheltuială.
--
-- Fără migrare: butonul „Pierdere” nu apare în Stocuri, iar „Ajustează stocul” păstrează plăcile Pierdere și
-- Consum propriu, ca înainte.
--
-- Anulare (doar dacă e nevoie):
--   drop function if exists public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean);
--   alter table public.ajustari_stoc drop constraint if exists ajustari_stoc_categorie_pierdere_check;
--   alter table public.ajustari_stoc drop column if exists categorie_pierdere;

-- 1. Motivul pierderii ------------------------------------------------------------------------------------------------

alter table public.ajustari_stoc
  add column if not exists categorie_pierdere text not null default 'nespecificat';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ajustari_stoc_categorie_pierdere_check'
       and conrelid = 'public.ajustari_stoc'::regclass
  ) then
    alter table public.ajustari_stoc
      add constraint ajustari_stoc_categorie_pierdere_check
      check (categorie_pierdere in ('nespecificat', 'stricat', 'consum_propriu', 'donat', 'altul'));
  end if;
end;
$$;

comment on column public.ajustari_stoc.categorie_pierdere is
  'Motivul unei pierderi (stricat, consum_propriu, donat, altul). nespecificat = rând vechi sau ajustare care nu e pierdere.';

-- 2. Scrierea unei pierderi ------------------------------------------------------------------------------------------

create or replace function public.create_pierdere_stoc(
  p_kg numeric,
  p_categorie text,
  p_detaliu text default null,
  p_data date default null,
  p_cultura text default null,
  p_client_sync_id uuid default null,
  p_sub_zero_confirmat boolean default false
)
returns public.ajustari_stoc
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_kg numeric := round(coalesce(p_kg, 0)::numeric, 2);
  v_categorie text := lower(btrim(coalesce(p_categorie, '')));
  v_detaliu text := nullif(btrim(coalesce(p_detaliu, '')), '');
  v_cultura text := nullif(btrim(coalesce(p_cultura, '')), '');
  v_tip text;
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
begin
  if v_user_id is null then
    raise exception 'Neautorizat' using errcode = '42501';
  end if;

  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  -- Aceleași drepturi ca `create_ajustare_stoc`.
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only' using errcode = '42501';
  end if;

  if v_categorie not in ('stricat', 'consum_propriu', 'donat', 'altul') then
    raise exception 'Motivul pierderii nu e valid.' using errcode = '22023';
  end if;

  if v_categorie = 'altul' and v_detaliu is null then
    raise exception 'Scrie ce s-a întâmplat.' using errcode = '22023';
  end if;

  if v_kg <= 0 then
    raise exception 'Cantitatea pierderii trebuie să fie mai mare decât 0.' using errcode = '22023';
  end if;

  if p_data is not null and p_data > public.bucharest_today() then
    raise exception 'Ziua pierderii nu poate fi în viitor.' using errcode = '22023';
  end if;

  v_tip := case when v_categorie = 'consum_propriu' then 'consum_propriu' else 'pierdere' end;

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

  -- Garda de stoc a `create_ajustare_stoc` (fără cultură, cultura zmeurei sau fermă fără zmeură), sărită doar când
  -- omul a confirmat că stocul trece sub zero.
  if not coalesce(p_sub_zero_confirmat, false)
     and (
       v_cultura is null
       or translate(lower(v_cultura), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
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

    if v_available - v_kg < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', v_kg, v_available),
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
    cultura,
    categorie_pierdere
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    -v_kg,
    v_tip,
    v_detaliu,
    v_user_id,
    p_client_sync_id,
    v_cultura,
    v_categorie
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) from public, anon;
grant execute on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) to authenticated, service_role;

comment on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) is
  'Pierdere din stoc cu motiv (promptul 33). Proprietarul sau operatorul cu Scrie pe Comenzi; ferma din sesiune.';
