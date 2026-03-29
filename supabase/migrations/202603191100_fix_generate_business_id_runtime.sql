create sequence if not exists public.business_id_seq;

create or replace function public.generate_business_id(prefix text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  next_val bigint;
  normalized_prefix text;
begin
  normalized_prefix := upper(btrim(coalesce(prefix, '')));

  if normalized_prefix = '' then
    raise exception 'Prefix is required for generate_business_id(prefix).';
  end if;

  select nextval('public.business_id_seq'::regclass) into next_val;

  return normalized_prefix ||
    case
      when next_val < 1000 then lpad(next_val::text, 3, '0')
      else next_val::text
    end;
end;
$$;

grant execute on function public.generate_business_id(text) to authenticated;
grant execute on function public.generate_business_id(text) to service_role;

notify pgrst, 'reload schema';
