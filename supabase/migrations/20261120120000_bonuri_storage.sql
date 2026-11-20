-- Poza bonului la Cheltuieli și Investiții.
--
-- Bucket privat `bonuri`. Calea unui fișier: `{tenant_id}/{cheltuieli|investitii}/{client_sync_id}.jpg`.
-- În `cheltuieli_diverse.document_url` / `investitii.document_url` se salvează calea din bucket, nu un URL;
-- aplicația cere un URL semnat (1 oră) când arată bonul.
--
-- Politicile urmează regula tabelelor: doar tenantul (`current_tenant_id()`), fără `operator_can_write`.
-- Aditivă: fără coloane noi, fără schimbări pe alte tabele.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bonuri',
  'bonuri',
  false,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Bonuri: tenantul isi citeste bonurile" on storage.objects;
create policy "Bonuri: tenantul isi citeste bonurile"
on storage.objects for select
to authenticated
using (
  bucket_id = 'bonuri'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists "Bonuri: tenantul isi urca bonurile" on storage.objects;
create policy "Bonuri: tenantul isi urca bonurile"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bonuri'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists "Bonuri: tenantul isi inlocuieste bonurile" on storage.objects;
create policy "Bonuri: tenantul isi inlocuieste bonurile"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bonuri'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
)
with check (
  bucket_id = 'bonuri'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists "Bonuri: tenantul isi sterge bonurile" on storage.objects;
create policy "Bonuri: tenantul isi sterge bonurile"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'bonuri'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
