-- Cheia de idempotență (`client_sync_id`) pentru comenzi, clienți, culegători și investiții.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
--
-- De ce: formularele de creare trimit o cheie (aceeași cât e deschis formularul, și la reîncercare după
-- eroare). Fără coloană în bază, o cerere repetată (rețea slabă, dublu-click) putea crea a doua comandă /
-- al doilea client. Cu indexul unic, a doua inserare pică cu 23505, iar aplicația o tratează ca reușită
-- și recitește rândul după cheie.
--
-- Forma, cum a cerut promptul 17: `client_sync_id uuid null` + index unic PARȚIAL pe
-- `(tenant_id, client_sync_id) where client_sync_id is not null`.
-- De știut: tabelele care au deja cheia în producție (recoltari, vanzari, cheltuieli_diverse,
-- activitati_agricole; citite pe 21.11.2026 din information_schema și pg_indexes) o au altfel:
-- `uuid not null default gen_random_uuid()` + index unic pe `(client_sync_id)` singur. Aici coloana e
-- nulă și fără valoare implicită, ca rândurile existente să rămână neatinse (`null`, fără update și fără
-- rescrierea tabelului), iar indexul e pe tenant, ca o cheie să nu poată „ciocni” între ferme.
--
-- Aditivă: patru coloane noi (nule) și patru indexuri. Fără date atinse. Se poate rula de două ori.
--
-- Anulare:
--   drop index if exists public.comenzi_tenant_client_sync_id_uq;
--   drop index if exists public.clienti_tenant_client_sync_id_uq;
--   drop index if exists public.culegatori_tenant_client_sync_id_uq;
--   drop index if exists public.investitii_tenant_client_sync_id_uq;
--   (coloanele pot rămâne.)

alter table public.comenzi add column if not exists client_sync_id uuid null;
alter table public.clienti add column if not exists client_sync_id uuid null;
alter table public.culegatori add column if not exists client_sync_id uuid null;
alter table public.investitii add column if not exists client_sync_id uuid null;

create unique index if not exists comenzi_tenant_client_sync_id_uq
  on public.comenzi (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists clienti_tenant_client_sync_id_uq
  on public.clienti (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists culegatori_tenant_client_sync_id_uq
  on public.culegatori (tenant_id, client_sync_id)
  where client_sync_id is not null;

create unique index if not exists investitii_tenant_client_sync_id_uq
  on public.investitii (tenant_id, client_sync_id)
  where client_sync_id is not null;
