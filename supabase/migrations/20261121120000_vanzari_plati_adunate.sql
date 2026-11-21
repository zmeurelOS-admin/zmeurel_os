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
