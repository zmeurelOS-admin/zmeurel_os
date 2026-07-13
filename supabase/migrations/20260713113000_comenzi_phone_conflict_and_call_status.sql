-- Semnale operaționale pentru comenzile noi. Nu modificăm istoric sau stoc.
alter table public.comenzi
  add column if not exists dup_phone_warning text,
  add column if not exists last_call_status text;

alter table public.comenzi
  drop constraint if exists comenzi_last_call_status_check;

alter table public.comenzi
  add constraint comenzi_last_call_status_check
  check (last_call_status is null or last_call_status in ('no_answer'));

comment on column public.comenzi.dup_phone_warning is
  'Numele unei comenzi active cu același telefon, detectat la promovarea nouă a unei comenzi Shop.';

comment on column public.comenzi.last_call_status is
  'Starea operațională a ultimului apel din Livrări; momentan doar no_answer.';

-- Echivalent SQL al normalizePhoneNumber din src/lib/utils/normalize-phone.ts.
-- Este folosit doar pentru comparația neblocantă din triggerul de promovare Shop.
create or replace function public.normalize_phone_number_for_match(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_trimmed text := btrim(coalesce(p_value, ''));
  v_digits text;
begin
  if v_trimmed = '' then
    return v_trimmed;
  end if;

  v_digits := regexp_replace(v_trimmed, '\D', '', 'g');
  if v_digits = '' then
    return v_trimmed;
  end if;

  if left(v_trimmed, 1) = '+' then
    return '+' || v_digits;
  end if;

  if v_digits like '0040%' and char_length(v_digits) = 13 then
    return '+40' || substr(v_digits, 5);
  end if;

  if v_digits like '40%' and char_length(v_digits) = 11 then
    return '+' || v_digits;
  end if;

  if v_digits like '0%' and char_length(v_digits) = 10 then
    return '+40' || substr(v_digits, 2);
  end if;

  if char_length(v_digits) = 9 then
    return '+40' || v_digits;
  end if;

  return '+' || v_digits;
end;
$$;

-- Promovarea Shop rămâne neblocantă: păstrăm checkout-ul intact și atașăm
-- doar numele conflictului activ, dacă există. Triggerul rulează exclusiv
-- pentru bridge-uri Shop și checkout-ul public nou, deci nu marchează retroactiv comenzile vechi.
create or replace function public.set_shop_order_dup_phone_warning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_name text;
  v_normalized_phone text;
  v_new_name text := btrim(coalesce(new.client_nume_manual, ''));
begin
  if coalesce(new.data_origin, '') not in ('shop_order_bridge', 'magazin_public') then
    return new;
  end if;

  v_normalized_phone := public.normalize_phone_number_for_match(new.telefon);
  if v_normalized_phone = '' then
    return new;
  end if;

  select coalesce(nullif(btrim(existing_order.client_nume_manual), ''), client.nume_client)
  into v_existing_name
  from public.comenzi existing_order
  left join public.clienti client on client.id = existing_order.client_id
  where existing_order.tenant_id = new.tenant_id
    and existing_order.status in ('noua', 'confirmata', 'programata', 'in_livrare')
    and public.normalize_phone_number_for_match(existing_order.telefon) = v_normalized_phone
    and lower(btrim(coalesce(nullif(btrim(existing_order.client_nume_manual), ''), client.nume_client, '')))
      <> lower(v_new_name)
  order by existing_order.created_at asc
  limit 1;

  new.dup_phone_warning := v_existing_name;
  return new;
end;
$$;

drop trigger if exists set_shop_order_dup_phone_warning on public.comenzi;
create trigger set_shop_order_dup_phone_warning
  before insert on public.comenzi
  for each row
  execute function public.set_shop_order_dup_phone_warning();

notify pgrst, 'reload schema';
