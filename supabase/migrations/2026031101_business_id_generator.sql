create sequence if not exists public.business_id_seq;

create or replace function public.generate_business_id(prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val bigint;
begin
  if prefix is null or btrim(prefix) = '' then
    raise exception 'Prefix is required for generate_business_id(prefix).';
  end if;

  select nextval('public.business_id_seq') into next_val;

  return btrim(prefix) || lpad(next_val::text, 3, '0');
end;
$$;

notify pgrst, 'reload schema';
