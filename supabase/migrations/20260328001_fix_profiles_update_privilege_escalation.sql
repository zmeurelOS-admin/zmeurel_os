-- Security hardening: authenticated users may update their own profile,
-- but must not be able to self-escalate privileges or tamper with tenant
-- binding and AI usage counters through the profiles_update_own policy.
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and is_superadmin = (
    select p.is_superadmin
    from public.profiles p
    where p.id = auth.uid()
  )
  and tenant_id is not distinct from (
    select p.tenant_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and ai_messages_count is not distinct from (
    select p.ai_messages_count
    from public.profiles p
    where p.id = auth.uid()
  )
  and last_ai_usage_date is not distinct from (
    select p.last_ai_usage_date
    from public.profiles p
    where p.id = auth.uid()
  )
);

notify pgrst, 'reload schema';
