alter table if exists public.analytics_events
  add column if not exists event_type text;

alter table if exists public.analytics_events
  add column if not exists module text;

update public.analytics_events
set
  event_type = coalesce(event_type, event_name, 'unknown'),
  module = coalesce(module, 'general')
where event_type is null or module is null;

alter table public.analytics_events
  alter column event_type set default 'unknown',
  alter column event_type set not null,
  alter column module set default 'general',
  alter column module set not null;

create index if not exists analytics_events_event_type_idx
  on public.analytics_events (event_type);

create index if not exists analytics_events_module_idx
  on public.analytics_events (module);
