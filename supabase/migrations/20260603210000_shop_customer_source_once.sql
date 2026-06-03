-- Set acquisition source once for public shop customers.
-- Controlled RPC: only fills NULL acquisition_source and never overwrites an existing source.

create or replace function public.set_shop_customer_acquisition_source_once(
  p_tenant_id uuid,
  p_phone text,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean := false;
begin
  update public.shop_customers
  set acquisition_source = nullif(btrim(p_source), ''),
      updated_at = now()
  where tenant_id = p_tenant_id
    and phone = p_phone
    and acquisition_source is null
    and nullif(btrim(p_source), '') is not null;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.set_shop_customer_acquisition_source_once(uuid, text, text) from public;
grant execute on function public.set_shop_customer_acquisition_source_once(uuid, text, text) to service_role;
