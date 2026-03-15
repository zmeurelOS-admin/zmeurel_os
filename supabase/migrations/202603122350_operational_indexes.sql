create index if not exists recoltari_parcela_id_idx
on public.recoltari (parcela_id);

create index if not exists vanzari_client_id_idx
on public.vanzari (client_id);

create index if not exists activitati_agricole_tenant_created_at_idx
on public.activitati_agricole (tenant_id, created_at desc);

create index if not exists cheltuieli_diverse_tenant_created_at_idx
on public.cheltuieli_diverse (tenant_id, created_at desc);

create index if not exists clienti_tenant_created_at_idx
on public.clienti (tenant_id, created_at desc);

create index if not exists comenzi_tenant_created_at_idx
on public.comenzi (tenant_id, created_at desc);

create index if not exists culegatori_tenant_created_at_idx
on public.culegatori (tenant_id, created_at desc);

create index if not exists miscari_stoc_tenant_created_at_idx
on public.miscari_stoc (tenant_id, created_at desc);

create index if not exists parcele_tenant_created_at_idx
on public.parcele (tenant_id, created_at desc);

create index if not exists recoltari_tenant_created_at_idx
on public.recoltari (tenant_id, created_at desc);

create index if not exists vanzari_tenant_created_at_idx
on public.vanzari (tenant_id, created_at desc);

notify pgrst, 'reload schema';
