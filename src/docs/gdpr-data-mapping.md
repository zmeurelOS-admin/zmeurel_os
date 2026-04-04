# GDPR Data Mapping — Magazin Asociație

Document intern pentru dezvoltare și audit. Nu înlocuiește consultanță juridică.

## Date personale colectate (checkout magazin public anonim)

Datele sunt în general stocate în **`comenzi`** (o înregistrare per linie de comandă / produs, conform fluxului API). Câmpuri cu caracter personal tipic:

| Câmp | Tabel | Scop | Operator economic (în relația cu clientul) | Retenție |
|------|-------|------|------------------------------------------|----------|
| Nume client | `comenzi.client_nume_manual` | Livrare, identificare | Asociația (comerciant) | Nedefinit în aplicație |
| Telefon | `comenzi.telefon` | Contact livrare | Asociația | Nedefinit în aplicație |
| Adresă / locație livrare | `comenzi.locatie_livrare` | Livrare | Asociația | Nedefinit în aplicație |
| Observații | `comenzi.observatii` | Preferințe livrare / note | Asociația | Nedefinit în aplicație |
| Legătură opțională client ERP | `comenzi.client_id` | Dacă se mapează la un client existent în tenant | Fermier / tenant | Nedefinit |

**Notă:** `tenant_id` pe comandă identifică **fermierul** căruia îi revine linia; în magazinul asociației pot exista mai multe `tenant_id` pentru același checkout (coș multi-fermier).

## Tabel `clienti` (ERP fermier)

Clienții înregistrați în ERP (nume, telefon, email, adresă, observații etc.) sunt date personale prelucrate de **tenant-ul fermier** în baza relației comerciale proprii. Nu sunt impuse automat de checkout-ul anonim al magazinului public, dar `client_id` pe `comenzi` poate lega o comandă de un rând `clienti` dacă există această logică în produs.

## Notificări in-app (`notifications`)

- Destinatar: utilizatori autentificați ai aplicației (`user_id`), nu clientul magazinului anonim.
- Câmpuri: `title`, `body`, `data` (JSON), `entity_type`, `entity_id` — pot include **metadate** despre comenzi (ex. ID-uri), nu profil complet client final în mod obligatoriu. Conținutul efectiv al `data` depinde de tipul evenimentului emis server-side.

## Roluri GDPR (înțeles produs)

- **Operator** pentru datele comenzii plasate de clientul final către asociație: **Asociația** (comerciantul identificat în setări publice / termeni).
- **Furnizor tehnic / împuternicit** (în funcție de contractul încheiat în viața reală): **Zmeurel OS** (zmeurel.ro) — găzduire aplicație, transmitere și stocare tehnică a comenzilor în baza de date.
- **Fermierul (tenant)**: operator pentru datele proprii din ERP; vede comenzile aferente `tenant_id`-ului său, conform RLS.
- **Admin asociație** (workspace `/asociatie`): acces la comenzile relevante magazinului asociației (conform politicii RLS implementate).
- **Superadmin**: acces administrativ de platformă (trebuie restricționat procedural în organizație).
- **Client magazin anonim**: nu are cont; exercitarea drepturilor GDPR se face prin **contact direct** cu Asociația (și, pentru aspecte tehnice, prin canalele puse la dispoziție de platformă, conform politicii publice).

## Drepturi GDPR (Art. 15–22) — orientare

- Acces / rectificare / ștergere / restricționare / opoziție: în primul rând prin **contact cu Asociația** (operator față de clientul final pentru comanda din magazin).
- **Export date**: în aplicația autentificată pentru utilizatori (`/settings` și fluxuri GDPR documentate în produs) — **nu** înlocuiește automat solicitările clientului anonim fără cont; acesta trebuie să identifice comanda prin canalele puse la dispoziție de Asociație.

## Recomandări (în afara codului)

- [ ] Definire perioadă **retenție** pentru comenzi și câmpuri derivate.
- [ ] **Contract operator–împuternicit** între Asociație și Zmeurel OS (sau document echivalent).
- [ ] Procedură formalizată pentru **cereri GDPR** de la clienți (inclusiv anonimi).
- [ ] Verificare **fiscală / TVA / facturare** cu avocat/contabil.
