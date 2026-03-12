create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  page_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_tenant_id on public.feedback(tenant_id);
create index if not exists idx_feedback_user_id on public.feedback(user_id);
create index if not exists idx_feedback_created_at on public.feedback(created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own
on public.feedback
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1
      from public.tenants t
      where t.id = feedback.tenant_id
        and t.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_superadmin = true
    )
  )
);

drop policy if exists feedback_select_superadmin on public.feedback;
create policy feedback_select_superadmin
on public.feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_superadmin = true
  )
);

