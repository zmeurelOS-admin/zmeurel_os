create index if not exists idx_activitati_agricole_tenant_id
on public.activitati_agricole (tenant_id);

create index if not exists idx_activitati_extra_season_tenant_id
on public.activitati_extra_season (tenant_id);

create index if not exists idx_alert_dismissals_tenant_id
on public.alert_dismissals (tenant_id);

create index if not exists idx_analytics_events_tenant_id
on public.analytics_events (tenant_id);

create index if not exists idx_cheltuieli_diverse_tenant_id
on public.cheltuieli_diverse (tenant_id);

create index if not exists idx_clienti_tenant_id
on public.clienti (tenant_id);

create index if not exists idx_comenzi_tenant_id
on public.comenzi (tenant_id);

create index if not exists idx_crop_varieties_tenant_id
on public.crop_varieties (tenant_id);

create index if not exists idx_crops_tenant_id
on public.crops (tenant_id);

create index if not exists idx_culegatori_tenant_id
on public.culegatori (tenant_id);

create index if not exists idx_culture_stage_logs_tenant_id
on public.culture_stage_logs (tenant_id);

create index if not exists idx_feedback_tenant_id
on public.feedback (tenant_id);

create index if not exists idx_integrations_google_contacts_tenant_id
on public.integrations_google_contacts (tenant_id);

create index if not exists idx_investitii_tenant_id
on public.investitii (tenant_id);

create index if not exists idx_miscari_stoc_tenant_id
on public.miscari_stoc (tenant_id);

create index if not exists idx_nomenclatoare_tenant_id
on public.nomenclatoare (tenant_id);

create index if not exists idx_parcele_tenant_id
on public.parcele (tenant_id);

create index if not exists idx_profiles_tenant_id
on public.profiles (tenant_id);

create index if not exists idx_recoltari_tenant_id
on public.recoltari (tenant_id);

create index if not exists idx_solar_climate_logs_tenant_id
on public.solar_climate_logs (tenant_id);

create index if not exists idx_vanzari_tenant_id
on public.vanzari (tenant_id);

create index if not exists idx_vanzari_butasi_tenant_id
on public.vanzari_butasi (tenant_id);

create index if not exists idx_vanzari_butasi_items_tenant_id
on public.vanzari_butasi_items (tenant_id);

notify pgrst, 'reload schema';
