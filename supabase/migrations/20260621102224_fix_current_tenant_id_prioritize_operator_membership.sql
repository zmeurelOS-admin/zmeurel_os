CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select fm.tenant_id from public.farm_members fm
      where fm.user_id = auth.uid()
        and fm.is_active = true
        and fm.role = 'operator'
      order by fm.created_at asc limit 1
    ),
    (
      select t.id from public.tenants t
      where t.owner_user_id = auth.uid()
      order by t.created_at asc limit 1
    )
  )
$function$;;
