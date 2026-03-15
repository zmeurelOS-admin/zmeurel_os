-- Add status and session_id columns to analytics_events
alter table public.analytics_events
  add column if not exists status text check (status in ('success', 'failed', 'abandoned', 'started')),
  add column if not exists session_id text;

create index if not exists analytics_events_status_idx
  on public.analytics_events (status);

-- Ensure superadmin can read all events (drop+recreate to be idempotent)
drop policy if exists "Superadmin can read all" on public.analytics_events;
create policy "Superadmin can read all"
  on public.analytics_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_superadmin = true
    )
  );
