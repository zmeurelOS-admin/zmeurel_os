-- Remove hardcoded personal-email guards and rely on role/config based rules.
-- Scope:
-- 1) integrations_google_contacts RLS (previously depended on a specific user_email)
-- 2) association_members bootstrap (previously seeded from one hardcoded auth email)

do $$
begin
  if to_regclass('public.integrations_google_contacts') is not null then
    drop policy if exists integrations_google_contacts_admin_select on public.integrations_google_contacts;
    create policy integrations_google_contacts_admin_select
      on public.integrations_google_contacts
      for select
      using (
        auth.uid() = user_id
        and public.is_superadmin()
      );

    drop policy if exists integrations_google_contacts_admin_insert on public.integrations_google_contacts;
    create policy integrations_google_contacts_admin_insert
      on public.integrations_google_contacts
      for insert
      with check (
        auth.uid() = user_id
        and public.is_superadmin()
        and tenant_id = (
          select id
          from public.tenants
          where owner_user_id = auth.uid()
          limit 1
        )
      );

    drop policy if exists integrations_google_contacts_admin_update on public.integrations_google_contacts;
    create policy integrations_google_contacts_admin_update
      on public.integrations_google_contacts
      for update
      using (
        auth.uid() = user_id
        and public.is_superadmin()
      )
      with check (
        auth.uid() = user_id
        and public.is_superadmin()
        and tenant_id = (
          select id
          from public.tenants
          where owner_user_id = auth.uid()
          limit 1
        )
      );

    drop policy if exists integrations_google_contacts_admin_delete on public.integrations_google_contacts;
    create policy integrations_google_contacts_admin_delete
      on public.integrations_google_contacts
      for delete
      using (
        auth.uid() = user_id
        and public.is_superadmin()
      );
  end if;
end
$$;

do $$
begin
  if to_regclass('public.association_members') is not null
    and to_regclass('public.profiles') is not null then
    insert into public.association_members (user_id, role)
    select p.id, 'admin'
    from public.profiles p
    where coalesce(p.is_superadmin, false) = true
    on conflict (user_id) do update
      set role = 'admin'
      where public.association_members.role is distinct from 'admin';
  end if;
end
$$;

notify pgrst, 'reload schema';
