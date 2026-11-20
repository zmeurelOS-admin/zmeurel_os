# Raport — „+ Poză bon” la Cheltuieli și Investiții (prompt 12)

Branch: `redesign/poza-bon`, pornit din `main` (`b8d0f06`). Migrarea e scrisă, **neaplicată**. Fără merge.

## Ce s-a schimbat

| Fișier | Ce |
|---|---|
| `supabase/migrations/20261120120000_bonuri_storage.sql` | nou: bucket privat `bonuri` + 4 politici pe `storage.objects` |
| `src/lib/bonuri/index.ts` | nou: `prepareBonImage`, `uploadBon`, `removeBon`, `signedBonUrl`, plus `resolveBonLink` / `bonStoragePath` / `fitWithin` |
| `src/lib/__tests__/bonuri.test.ts` | nou: dimensiunile din `prepareBonImage`, poza necitibilă, URL direct față de cale |
| `src/components/cheltuieli/CheltuialaStepForm.tsx` | rândul „+ Poză bon” în pasul 2, urcarea înaintea rândului, eroarea de urcare, ramura fără internet, editarea (adaugă / schimbă / scoate), `closeGuard`, `has_bon` |
| `src/app/(dashboard)/cheltuieli/CheltuieliPageClient.tsx` | foaia rândului: „Vezi bonul” prin URL semnat, cu miniatură; după ștergerea rândului se șterge și fișierul |
| `src/lib/supabase/queries/investitii.ts` | `document_url` în tip, în normalizare, la creare și la editare |
| `src/lib/supabase/queries/cheltuieli.ts` | `UpdateCheltuialaInput.document_url` acceptă `null` (scoaterea bonului) |
| `src/lib/query-keys.ts` | `queryKeys.bonUrl(documentUrl)` |
| `scripts/kit-rules.mjs` | `src/lib/bonuri` intră pe lista verificată de `check:kit` |
| `CLAUDE.md` | regula nouă din „Database Migrations” despre `SECURITY DEFINER` |

## Migrarea (neaplicată)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bonuri', 'bonuri', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Bonuri: tenantul isi citeste bonurile" on storage.objects;
create policy "Bonuri: tenantul isi citeste bonurile"
on storage.objects for select to authenticated
using (bucket_id = 'bonuri' and auth.uid() is not null
       and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists "Bonuri: tenantul isi urca bonurile" on storage.objects;
create policy "Bonuri: tenantul isi urca bonurile"
on storage.objects for insert to authenticated
with check (bucket_id = 'bonuri' and auth.uid() is not null
            and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists "Bonuri: tenantul isi inlocuieste bonurile" on storage.objects;
create policy "Bonuri: tenantul isi inlocuieste bonurile"
on storage.objects for update to authenticated
using (bucket_id = 'bonuri' and auth.uid() is not null
       and (storage.foldername(name))[1] = public.current_tenant_id()::text)
with check (bucket_id = 'bonuri' and auth.uid() is not null
            and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists "Bonuri: tenantul isi sterge bonurile" on storage.objects;
create policy "Bonuri: tenantul isi sterge bonurile"
on storage.objects for delete to authenticated
using (bucket_id = 'bonuri' and auth.uid() is not null
       and (storage.foldername(name))[1] = public.current_tenant_id()::text);
```

Fișierul din repo are aceleași instrucțiuni, cu comentarii. Fără coloane noi: `document_url` exista deja pe ambele tabele.

## Cum funcționează

- **Calea:** `{tenant_id}/{cheltuieli|investitii}/{client_sync_id}.jpg`. În `document_url` se salvează calea, nu un URL. Când se afișează: o valoare care începe cu `http` se deschide direct; altfel se cere `createSignedUrl` pe 1 oră, din client (`getSupabase()`).
- **Poza:** pe canvas, latura mare la cel mult 1600 px, JPEG 0,8, fundal alb. Decodarea încearcă întâi `createImageBitmap`, apoi `<img>` (Safari arată HEIC într-un `<img>`). Dacă nu se poate decoda: „Poza nu s-a putut citi. Încearcă alta.”
- **Salvarea:** întâi se urcă poza (`upsert: true`, pe aceeași cale), apoi se creează rândul cu `document_url`. Dacă rândul pică după ce poza a urcat, reîncercarea nu o mai urcă o dată (aceeași poză, aceeași cheie).
- **Investițiile** nu au `client_sync_id` în bază: la creare, calea folosește cheia formularului. La editare se scrie peste calea deja salvată pe rând; dacă rândul nu are bon din bucket, calea se face din `id`.
- **Editarea:** „Schimbă” suprascrie fișierul rândului. „Scoate” + salvare pune `document_url = null`, apoi șterge fișierul (best effort: rândul se salvează oricum).
- **Ștergerea rândului:** după ștergere se încearcă și ștergerea fișierului acelui rând (best effort, fără să blocheze). Un URL vechi (`http…`) nu se atinge.
- **Fără internet:** cu o poză aleasă, pasul 2 arată „Poza bonului se poate adăuga doar cu internet.” La „Salvează”, poza nu pleacă și nu intră în nicio coadă. Rândul merge pe calea obișnuită: dacă trece, ecranul de final spune „fără bon. Poza o adaugi din «Editează», cu internet.” Dacă pică din lipsă de rețea, poza rămâne în formular și pleacă la următorul „Salvează”, cu internet.
- **Recoltări:** cheltuielile automate nu au „Editează”, deci nici bon.
- **Analytics:** `create_success` are acum `metadata.has_bon: true/false`. Niciun eveniment nou.

## Cum arată pasul 2 cu poza (390 × 800)

De sus în jos: „Cât ai dat?”, pastilele Categoria / Data, câmpul Sumă, rândul „Furnizor / ce ai cumpărat”, apoi rândul bonului, deasupra tastaturii. Totul încape pe ecran fără derulare.

- **Fără poză:** un rând discret „+ Poză bon”, cu iconița de cameră, pe toată lățimea, înalt de 48 px.
- **Cu poză:** miniatura bonului (48 × 48, colțuri rotunjite), apoi „Schimbă” (buton cu contur) și „Scoate” (buton discret), fiecare de 48 px, text de 17 px.
- **Urcarea a picat:** sus, sub titlu, o bandă roșie „Bonul nu s-a putut încărca.”, cu „Încearcă din nou” și „Salvează fără bon” unul sub altul. Suma rămâne. La 390 px banda împinge suma parțial sub tastatură; pasul se derulează.
- **Fără internet:** o bandă galbenă „Poza bonului se poate adăuga doar cu internet. Cheltuiala se salvează fără bon.”

Foaia rândului: „Vezi bonul” e un buton cu miniatura bonului în stânga. Se deschide într-o pagină nouă. Cât se cere URL-ul semnat, butonul arată „Se deschide bonul…”. Dacă nu vine niciun URL, apare „Bonul nu se poate deschide acum”.

## Ce am testat în demo (390 px, cont nou prin `/start`)

- Am ales o poză de 4000 × 3000. Miniatura apare și poza pregătită are 1600 × 1200.
- „Salvează” fără bucket: cererea merge la `storage/v1/object/bonuri/{tenant}/cheltuieli/{cheie}.jpg` și primește „Bucket not found”. Apare banda de eroare și suma rămâne. „Încearcă din nou” face aceeași cerere. „Salvează fără bon” salvează rândul.
- Offline simulat (`navigator.onLine = false`) cu o poză aleasă: apare banda galbenă. La salvare nu pleacă nicio cerere spre stocare, iar rândul se salvează „fără bon”.
- Editarea unui rând cu o poză nouă, apoi Esc: apare „Renunți la modificări?”.
- Un fișier care nu e imagine: „Poza nu s-a putut citi. Încearcă alta.”
- Foaia unui rând fără bon arată ca înainte.

## Ce n-am putut testa

- **Urcarea reușită, „Vezi bonul” cu URL semnat, „Schimbă” și „Scoate” la editare, ștergerea fișierului.** Toate cer bucketul, adică migrarea aplicată.
- O poză HEIC reală de pe iPhone și camera reală (`capture="environment"`). În browserul din aplicație am simulat alegerea fișierului.
- Un rând vechi cu `document_url` care începe cu `http`. În producție nu există niciunul (0 din 1431). Ramura e acoperită de testul unitar.

### Pași de test după aplicarea migrării (cont demo, 390 px)

1. `/start` → „Continuă fără cont” → o fermă demo → Cheltuieli → „Adaugă cheltuială”.
2. Alege o categorie → „+ Poză bon” → fă sau alege o poză. Apare miniatura. Scrie suma → „Salvează”.
3. Deschide rândul → „Vezi bonul”. Bonul se deschide într-o filă nouă.
4. „Editează” → „Schimbă” → altă poză → „Salvează modificările”. „Vezi bonul” arată poza nouă (aceeași cale în `bonuri`).
5. „Editează” → „Scoate” → „Salvează modificările”. „Vezi bonul” dispare, iar fișierul nu mai e în `bonuri/{tenant}/cheltuieli/`.
6. Adaugă din nou o cheltuială cu bon → deschide rândul → „Șterge”. Fișierul dispare din bucket.
7. Repetă 2–3 pe fila Investiții (calea `…/investitii/…`).

## De știut

- **Demo:** cron-ul de curățenie a demo-urilor nu e atins. Fișierele din `bonuri/{tenant_demo}/` rămân după ștergerea tenantului; le curățăm separat.
- **Fișiere rămase fără rând:** dacă poza urcă, dar rândul nu se salvează, iar formularul se închide, fișierul rămâne în bucket fără rând. Aceeași curățenie separată le poate prinde: obiecte din `bonuri` fără niciun `document_url` care să le indice.
- Bucketul acceptă doar `image/jpeg` și `image/webp`. Clientul trimite mereu JPEG.

## Verificări

- `npm run lint`: doar cele 2 erori vechi (`analytics-magazin/page.tsx`, `ui/app-date-picker.tsx`).
- `npm run typecheck`: OK.
- `npm run check:kit`: OK, 105 fișiere, fără abateri.
- `npm run test:critical:unit`: 407 din 409 trec. Cele 2 picate sunt `integrations/google` (callback, connect), din timeout de 5 s când rulează toată suita. **Pică identic pe `main`** (verificat cu modificările puse deoparte) și trec rulate separat (19/19). Testele noi din `bonuri.test.ts` trec (8/8).
- `npm run build`: OK.
